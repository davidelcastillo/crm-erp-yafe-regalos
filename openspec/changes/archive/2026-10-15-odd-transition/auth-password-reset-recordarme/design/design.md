# Design: Auth — Password Reset funcional, Recordarme y alineación STYLE.md

| Campo | Valor |
|---|---|
| **Change ID** | `auth-password-reset-recordarme` |
| **Preflight** | auto · hybrid (OpenSpec + Engram) · delivery_strategy: auto-chain · review_budget: 400 |
| **Stack** | Next.js 16.2.4 (App Router) · React 19.2.4 · TS strict · Supabase Auth · @supabase/ssr 0.12.4 · Zod 4 · Tailwind v4 + STYLE.md |
| **Contrato** | Proposal + specs delta `auth-password-reset`, `auth-session-persistence`, `auth-login-ui`, `branch-portal-login-ui`, `app-navigation`, `app-middleware` |

## Technical Approach

Cuatro tracks independientes y mergeables (auto-chain): (A) ciclo PKCE de reset (route handler nuevo + actions server), (B) control de duración de cookie de sesión desde el store de `createServerClient` (NO vía `cookieOptions.maxAge`, que el SDK pisa con 400 días), (C) cirugía de UI con tokens STYLE.md, (D) exclusiones del proxy.

### Capability `auth-password-reset` (nueva)

**Route handler `/auth/callback`** — `src/app/auth/callback/route.ts` (primer `route.ts` del proyecto):

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sanitizeNextPath } from '@/lib/auth/sanitize-next';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = sanitizeNextPath(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/forgot-password', request.url));
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  console.error('exchangeCodeForSession error:', error.message);
  return NextResponse.redirect(new URL('/forgot-password', request.url));
}
```

Decisiones: usar `request.nextUrl` (origin confiable tras proxy); cookies se escriben vía `createServerClient` + `cookies()` mutable en route handler; redirect 307; `exchangeCodeForSession` es la API correcta para el template Reset Password con PKCE.

**`sanitizeNextPath`** — módulo nuevo `src/lib/auth/sanitize-next.ts` (función pura):

```ts
const FALLBACK = '/reset-password';

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) return FALLBACK;
  if (!value.startsWith('/')) return FALLBACK;
  if (value.startsWith('//')) return FALLBACK;
  if (value.includes(':')) return FALLBACK;
  return value;
}
```

Casos: `/reset-password` ✓, `/login` ✓, `null`/`''` → fallback, `https://evil.example` → fallback, `//evil.example` → fallback, `javascript:alert(1)` → fallback, `/ruta:puerto` → fallback, `/reset-password?foo=bar` ✓ (query interna permitida).

**Páginas server**:
- `/forgot-password/page.tsx`: server component + `ForgotPasswordForm` (campo email, estados idle/sending/success, mensaje genérico anti-enumeración "Si el correo está registrado, te enviamos un enlace...", `pending` local).
- `/reset-password/page.tsx`: `export const dynamic = 'force-dynamic'`; `getUser()` sin sesión → `redirect('/forgot-password')`; con sesión → `ResetPasswordForm` (campo password `new-password`).

**Server actions** — `src/actions/auth.reset.ts`:

```ts
'use server';
import { createServerClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations/auth';
import type { ActionResult } from '@/actions/auth';

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? 'https';
  return `${proto}://${host}`;
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string | null;
  const result = forgotPasswordSchema.safeParse({ email });
  if (!result.success) return { success: false, error: 'Correo electrónico inválido' };
  try {
    const supabase = await createServerClient();
    const origin = await getOrigin();
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, { redirectTo });
    if (error) console.error('resetPasswordForEmail:', error.message);
    return { success: true }; // anti-enumeración
  } catch (err) {
    console.error('Unexpected error in requestPasswordReset:', err);
    return { success: true };
  }
}

export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const password = formData.get('password') as string | null;
  const result = resetPasswordSchema.safeParse({ password });
  if (!result.success) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.updateUser({ password: result.data.password });
    if (error) { console.error('updateUser:', error.message); return { success: false, error: 'No se pudo actualizar la contraseña' }; }
    return { success: true, redirectTo: '/login' };
  } catch (err) {
    console.error('Unexpected error in updatePassword:', err);
    return { success: false, error: 'Ocurrió un error inesperado' };
  }
}
```

**Validaciones** — `src/lib/validations/auth.ts`:

```ts
export const forgotPasswordSchema = z.object({ email: z.string().email('Correo electrónico inválido') });
export const resetPasswordSchema = z.object({ password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres') });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
```

### Capability `auth-session-persistence` (nueva)

**Hecho verificado**: `@supabase/ssr` 0.12.4 pisO SIEMPRE `cookieOptions.maxAge` con 400 días (`applyServerStorage` → `maxAge: DEFAULT_COOKIE_OPTIONS.maxAge`). El control real es el maxAge de la cookie `sb-<ref>-auth-token` (+chunks) en el store de la app. **Decisión: migrar el store a `getAll/setAll`** (patrón oficial, forma deprecada con warning).

**`src/lib/supabase/server.ts`**:

```ts
import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { DEFAULT_SESSION_MAX_AGE, resolveSessionMaxAge, deriveStorageKey } from '@/lib/supabase/session';

export async function createServerClient(sessionMaxAge?: number) {
  const cookieStore = await cookies();
  const storageKey = deriveStorageKey(process.env.NEXT_PUBLIC_SUPABASE_URL!);

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            const maxAge = resolveSessionMaxAge({ name, value, sessionMaxAge, storageKey });
            cookieStore.set({ name, value, ...(maxAge !== undefined ? { ...options, maxAge } : options) });
          }
        },
      },
    }
  );
}
```

**`src/lib/supabase/session.ts`** (módulo puro):

```ts
export const DEFAULT_SESSION_MAX_AGE = 60 * 60;        // 1 hora
export const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60;   // 7 días (604800 s)

export function deriveStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split('.')[0]}-auth-token`;
}

export function resolveSessionMaxAge(input: {
  name: string; value: string; sessionMaxAge?: number; storageKey: string;
}): number | undefined {
  if (!input.value) return undefined;                        // remove → passthrough
  if (!input.name.startsWith(input.storageKey)) return undefined; // otras cookies
  return input.sessionMaxAge ?? DEFAULT_SESSION_MAX_AGE;
}
```

Justificación: removes llegan con `value: ""` → passthrough conserva maxAge 0; `startsWith(storageKey)` cubre chunks `.0`/`.1`; storageKey derivado sin hardcodear el ref; verifier PKCE recibe maxAge (inerte, aceptado como nota).

**`login()` en `src/actions/auth.ts`**:

```ts
const remember = formData.get('remember-me') === 'on';
const supabase = await createServerClient(remember ? REMEMBER_ME_MAX_AGE : undefined);
// resto del flujo intacto
```

**`logout()`**: eliminar el set de la cookie muerta `sb-token` (línea 87); `signOut()` limpia las cookies reales vía setAll con value:""/maxAge:0.

### Capability `auth-login-ui` (modificada)

- Eliminar bloque register (135-143): `<p className="mt-4 ...">¿No tienes una cuenta? ... Regístrate aquí</p>`.
- Reemplazar `<a href="#">` (115-120) por `Link href="/forgot-password"` con clases `font-medium text-[#ff385c] hover:text-[#e00b41]`.
- Checkbox `remember-me` (100-105): sin cambios de UI.
- `loginSchema` y error genérico: intactos.

### Capability `branch-portal-login-ui` (modificada)

`PortalLoginForm.tsx` reemplazos: labels `text-gray-900` → `text-[#6a6a6a]` (:52/:68); inputs `focus:ring-indigo-600` → `focus:border-[#ff385c] focus:ring-[#ff385c]/20` (:61/:77); error `text-red-600` → `text-[#c13515]` (:83); botón `bg-indigo-600 hover:bg-indigo-700` + `focus:ring-indigo-500` → `bg-[#ff385c] hover:bg-[#e00b41]` + `focus:ring-[#ff385c]/50` (:90). Conservar `w-full`, `rounded-xl`, `shadow-sm`, `min-h-[44px]`, `touch-manipulation`, `ring-1 ring-inset ring-gray-300`, `autoComplete`, `disabled:opacity-50`, éxito `text-green-600`. `page.tsx` card `rounded-2xl` → `rounded-xl` (:20).

### Capability `app-navigation` (modificada)

`Navbar.tsx` early-return (16-18) + `/forgot-password`, `/reset-password`, `/auth/callback`; botones sesión (:39 logout, :45 login) → Rausch + `focus:ring-[#ff385c]/50`; logo (:30) sin cambios (deuda visual). `BottomNav.tsx` early-return (64-68) + mismas 3 rutas.

### Capability `app-middleware` (modificada)

`proxy.ts` isExcluded (39-46) + `/forgot-password`, `/reset-password`, `/auth/callback` (crítico PKCE). Gating existente intacto. `config.matcher` sin cambios.

## Data Flow

### Reset de contraseña (PKCE)

```
/login → click "Olvidé" → /forgot-password → requestPasswordReset(email)
  → getOrigin() (x-forwarded-host ?? host + x-forwarded-proto split(',')[0])
  → resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback?next=/reset-password })
  → SIEMPRE { success: true } (anti-enumeración)
→ email → /auth/callback?code=<pkce>&next=/reset-password (excluido del proxy)
  → sin code → 303 /forgot-password
  → exchangeCodeForSession(code) → error → /forgot-password | ok → cookies sesión + sanitizeNextPath → 307
→ /reset-password (server, force-dynamic) → getUser() sin sesión → redirect /forgot-password
  → con sesión → ResetPasswordForm → updatePassword → updateUser({password}) → { success, redirectTo: '/login' }
```

### Recordarme

```
LoginForm checkbox remember-me → FormData 'on' → login() → createServerClient(604800 | undefined)
→ signInWithPassword → setAll → resolveSessionMaxAge: value≠'' ∧ name.startsWith(storageKey)
  → maxAge: 604800 (ON) | 3600 (OFF) → Set-Cookie Max-Age
logout() → signOut() → setAll value:''/maxAge:0 → passthrough → cookie borrada (sb-token ya no se escribe)
```

## Component/File Changes

| Archivo | Acción |
|---|---|
| `src/app/auth/callback/route.ts` | Crear — GET: exchange PKCE + cookies + redirect sanitizado |
| `src/app/forgot-password/page.tsx` | Crear — server component card rounded-xl + metadata |
| `src/app/forgot-password/ForgotPasswordForm.tsx` | Crear — client form email, estados idle/sending/success, pending local |
| `src/app/reset-password/page.tsx` | Crear — server, force-dynamic, getUser() sin sesión → redirect |
| `src/app/reset-password/ResetPasswordForm.tsx` | Crear — client form password, updatePassword → /login |
| `src/actions/auth.reset.ts` | Crear — requestPasswordReset + updatePassword + getOrigin() |
| `src/lib/auth/sanitize-next.ts` | Crear — sanitizeNextPath (pura) |
| `src/lib/supabase/session.ts` | Crear — DEFAULT_SESSION_MAX_AGE, REMEMBER_ME_MAX_AGE, deriveStorageKey, resolveSessionMaxAge (puras) |
| `src/lib/validations/auth.ts` | Modificar — forgotPasswordSchema + resetPasswordSchema + tipos |
| `src/lib/supabase/server.ts` | Modificar — createServerClient(sessionMaxAge?); store getAll/setAll + override |
| `src/actions/auth.ts` | Modificar — login() lee remember-me; logout() sin sb-token |
| `src/app/login/components/LoginForm.tsx` | Modificar — sin register; Link /forgot-password |
| `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx` | Modificar — restyle Rausch |
| `src/app/sucursal/[branchId]/login/page.tsx` | Modificar — rounded-2xl → rounded-xl |
| `src/components/Navbar.tsx` | Modificar — early-return +3 rutas; botones Rausch; logo sin cambios |
| `src/components/BottomNav.tsx` | Modificar — early-return +3 rutas |
| `src/proxy.ts` | Modificar — isExcluded +3 rutas |
| `src/proxy.test.ts` | Modificar — 3 casos nuevos |
| `src/lib/auth/sanitize-next.test.ts` | Crear — tabla de casos |
| `src/lib/supabase/session.test.ts` | Crear — deriveStorageKey + resolveSessionMaxAge |
| `src/actions/auth.reset.test.ts` | Crear — actions con mock createServerClient |
| `src/app/auth/callback/route.test.ts` | Crear — route handler con mock exchange + redirects |
| `src/app/forgot-password/ForgotPasswordForm.test.tsx` | Crear (recomendado) — RTL |
| `src/app/reset-password/ResetPasswordForm.test.tsx` | Crear (recomendado) — RTL |
| Supabase dashboard | Manual — Site URL, Redirect URL `<origin>/auth/callback`, template Reset Password |

## Testing Strategy

- Unit pura: `sanitizeNextPath` (tabla), `deriveStorageKey` (sb-<ref>-auth-token), `resolveSessionMaxAge` (remove→undefined, otra cookie→undefined, prefijo+chunks→sessionMaxAge??3600).
- Proxy: `proxy.test.ts` 3 casos nuevos (rutas auth sin sesión → next, sin redirect); existentes intactos.
- Route handler: GET con code+next válido → 307 /reset-password; next malicioso → 307 /reset-password; sin code → /forgot-password; exchange error → /forgot-password.
- Actions: email inválido → error sin Supabase; válido → resetPasswordForEmail con redirectTo; anti-enumeración (success idéntico con y sin error); password <8 → error sin updateUser; válida → { success, redirectTo: '/login' }.
- RTL forms: ForgotPasswordForm (validación, envío, mensaje genérico); ResetPasswordForm (password corta, válida → router.push('/login')).
- Verificación manual E2E: inspección cookie Max-Age (ON 604800 / OFF 3600); logout limpia reales y no escribe sb-token.
- Comandos: `npm test` → `npm run build` → `npm run test:e2e` (si existen).

## Risks & Mitigations

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | Open redirect en `next` | sanitizeNextPath estricta; fallback /reset-password; tests tabla |
| 2 | Enumeración de cuentas | requestPasswordReset SIEMPRE { success: true }; error solo a console.error; form mensaje genérico |
| 3 | /reset-password sin sesión | getUser() server-side → redirect /forgot-password |
| 4 | maxAge vs refresh TTL (30-60d) | 7 días y 1 hora por debajo; constante documentada |
| 5 | Config Supabase manual | Checklist en verify; Redirect URL exacta `<origin>/auth/callback` (query `?next=` no requiere entrada adicional) |
| 6 | Verifier PKCE recibe maxAge | Inerte (sin token de sesión); aceptado, documentado |
| 7 | x-forwarded-proto multi-valor | split(',')[0] (más externo) |
| 8 | Regresión por getAll/setAll | Patrón oficial; proxy.test.ts + tests nuevos + verificación manual |
| 9 | Host header spoofing en getOrigin | Impacto acotado (Supabase valida Redirect URL); x-forwarded-host controlado por plataforma |
| 10 | useFormStatus en LoginForm (bug latente) | Forms nuevos usan pending local; LoginForm no se toca |
| 11 | Indigo residual (logo Navbar :30) | Deuda visual registrada |
| 12 | Drift rounded-xl vs token 8px | Deliberado, consistente con el proyecto |

## Open Questions

- [ ] Redirect 307 explícito o default (default 307 aceptado).
- [ ] Tests RTL forms: obligatorios o recomendados (recomendados).
- [ ] Confirmar en apply que Redirect URL acepta query `?next=` sin config adicional.