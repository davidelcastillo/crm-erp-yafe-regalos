# Proposal: Auth — Password Reset funcional, Recordarme y alineación STYLE.md

| Campo | Valor |
|---|---|
| **Change ID** | `auth-password-reset-recordarme` |
| **Fase SDD** | 2/8 — Proposal |
| **Fecha** | 2026-08-21 |
| **Preflight** | auto · hybrid (OpenSpec + Engram) · delivery_strategy: auto-chain · review_budget: 400 |
| **Stack** | Next.js 16.2.4 (App Router) · React 19.2.4 · TypeScript strict · Supabase Auth · @supabase/ssr 0.12.4 · Zod 4 · Tailwind v4 + STYLE.md |

## Intent

Pulir el flujo de autenticación del proyecto en cuatro frentes: (1) hacer **funcional el reset de contraseña** con el flujo PKCE forzado por @supabase/ssr (forgot → email → callback → reset → update), (2) hacer **funcional el checkbox "Recordarme"** controlando la duración real de la cookie de sesión vía `maxAge` en `createServerClient`, (3) **quitar el link de registro** del login (decisión del usuario: no existe register público), y (4) **alinear a STYLE.md** la estética pendiente en el portal de sucursal (PortalLoginForm y su página de login) y en el Navbar. El resultado es un login coherente, seguro y visualmente consistente: un único usuario admin en producción, sin superficie de registro público y con el ciclo completo de recuperación de acceso funcionando.

## Scope

### In Scope

- **Password reset completo**: ruta `/forgot-password` (+ `ForgotPasswordForm.tsx`), ruta `/reset-password` (+ `ResetPasswordForm.tsx`), route handler `/auth/callback` (primer `route.ts` del proyecto) que intercambia el code PKCE, setea cookies y redirige; server actions `requestPasswordReset` + `updatePassword` en `src/actions/auth.reset.ts`; esquemas `forgotPasswordSchema` + `resetPasswordSchema` en `src/lib/validations/auth.ts`.
- **Recordarme funcional**: parámetro `sessionMaxAge` en `createServerClient` (`src/lib/supabase/server.ts`) con override del `maxAge` en el store de cookies; `login()` en `src/actions/auth.ts` lee `remember-me` (7 días vs 1 hora por defecto); higiene del logout (limpiar la cookie muerta `sb-token`).
- **Quitar register del login**: eliminar el bloque "¿No tienes una cuenta? / Regístrate aquí" de `LoginForm.tsx` (líneas 135-143). No se crea `/register`.
- **Estética STYLE.md pendiente**: restyle de `PortalLoginForm.tsx` (botón/labels/inputs/error indigo → tokens Rausch/#6a6a6a/#c13515), sucursal login `page.tsx` (`rounded-2xl` → `rounded-xl`) y botones de sesión del Navbar (`Navbar.tsx:39` logout, `:45` login).
- **Proxy y chrome**: agregar `/forgot-password`, `/reset-password` y `/auth/callback` a `isExcluded` en `src/proxy.ts`; ocultar Navbar/BottomNav en las rutas auth nuevas.
- **Config Supabase (manual, por el usuario)**: Site URL, Redirect URL `<origin>/auth/callback` y template "Reset Password" verificado.

### Out of Scope

- **Register público**: no se crea la ruta ni la funcionalidad de auto-registro.
- **Gestión de usuarios admin**: CRUD de usuarios, backfill de claims o panel de administración.
- **OAuth social**: Google/GitHub/etc. no forman parte de este change.
- **RLS / políticas de seguridad de datos**: sin cambios en Postgres.
- **Fuentes globales**: no se cambia la familia tipográfica global; solo se aplican tokens de color/radio ya existentes en el proyecto.
- **Recordarme en el portal de sucursal**: `loginBranch` no tiene checkbox y conserva el maxAge por defecto.

## Capabilities

### `auth-password-reset` (nueva)

Flujo completo de recuperación de contraseña usando el intercambio de code PKCE forzado por @supabase/ssr.

**Contrato para sdd-spec:**
- Rutas: `/forgot-password` (página + `ForgotPasswordForm.tsx`, client), `/reset-password` (página + `ResetPasswordForm.tsx`, client), `/auth/callback` (`route.ts`, server).
- Secuencia: `/login` → `/forgot-password` (email) → action `requestPasswordReset(email, { redirectTo: <origin>/auth/callback?next=/reset-password })` → email de Supabase → `/auth/callback` (exchangeCodeForSession + set de cookies + redirect) → `/reset-password` (requiere sesión) → action `updatePassword(password)` → `/login`.
- Actions en `src/actions/auth.reset.ts` (server): `requestPasswordReset(formData): ActionResult` y `updatePassword(formData): ActionResult`.
- Validaciones en `src/lib/validations/auth.ts`: `forgotPasswordSchema` (email válido) y `resetPasswordSchema` (mín. 8 caracteres, consistente con `loginSchema`).
- **Anti-enumeración**: `requestPasswordReset` responde éxito genérico siempre (exista o no el email); no exponer si la cuenta existe.
- **Sanitización de `next`** en el callback: solo rutas internas relativas que empiecen con `/` y no con `//` ni contengan `:` — caso contrario, redirect a `/reset-password` (o `/login`).
- Comportamiento de `/reset-password` sin sesión: redirigir a `/forgot-password` (el token PKCE expira ~1 hora).

### `auth-session-persistence` (nueva)

Recordarme funcional controlando el maxAge real de la cookie de sesión.

**Contrato para sdd-spec:**
- `createServerClient(sessionMaxAge?: number)` en `src/lib/supabase/server.ts`: en el store (`set`/`setAll`), si `name.startsWith(storageKey)` y no es un remove, aplicar `maxAge: sessionMaxAge ?? DEFAULT_SESSION_MAX_AGE` (1 hora).
- Verificado en node_modules: `cookieOptions.maxAge` pasado al cliente se pisa con `DEFAULT_COOKIE_OPTIONS.maxAge` (400 días) — el control real es el maxAge de la cookie `sb-<ref>-auth-token` (+ chunks).
- `login()` en `src/actions/auth.ts` lee `formData.get('remember-me') === 'on'` → `sessionMaxAge = 7 días`; sin checkbox → default 1 hora.
- `logout()`: además de `signOut()`, dejar de setear la cookie muerta `sb-token` (vestigio pre-@supabase/ssr); las cookies reales las limpia el cliente de Supabase.
- Opcional recomendado: migrar el store de `get/set/remove` (deprecado) a `getAll/setAll`.
- El portal de sucursal (`loginBranch`) no tiene checkbox: usa el default (1 hora).

### `auth-login-ui` (modificada)

Login central alineado con las decisiones: sin register, con link de recuperación funcional y checkbox recordarme funcional.

**Contrato para sdd-spec:**
- `LoginForm.tsx`: eliminar el bloque register (135-143); cambiar el link "Olvidé mi contraseña" (`href="#"`, 115-120) por `Link`/`href="/forgot-password"`; el checkbox `remember-me` (100-105) ya existe y queda conectado a `login()` (no requiere cambios de UI).
- El `loginSchema` actual (email + min 8) se mantiene; el error de validación se mantiene genérico.

### `branch-portal-login-ui` (modificada)

Portal de sucursal alineado a STYLE.md.

**Contrato para sdd-spec:**
- `PortalLoginForm.tsx`: botón submit `bg-indigo-600 hover:bg-indigo-700` → `bg-[#ff385c] hover:bg-[#e00b41]` (Rausch); labels `text-gray-900` → `text-[#6a6a6a]`; inputs `focus:ring-indigo-600` → `focus:border-[#ff385c] focus:ring-[#ff385c]/20` (patrón de LoginForm); error `text-red-600` → `text-[#c13515]`.
- Sucursal login `page.tsx`: card `rounded-2xl` → `rounded-xl` (convención del proyecto).
- Sin cambios de lógica: `loginBranch` se mantiene.

### `app-navigation` (modificada)

Chrome de la app oculto en rutas auth y botones del Navbar en Rausch.

**Contrato para sdd-spec:**
- `Navbar.tsx`: ampliar el early-return (16-18) para ocultar también en `/forgot-password`, `/reset-password` y `/auth/callback`; botones de sesión (39 logout, 45 login) `bg-indigo-600 hover:bg-indigo-700` → Rausch.
- `BottomNav.tsx`: ampliar el early-return (64-68) con las mismas rutas auth nuevas.
- Nota a resolver en spec: el logo de `Navbar.tsx:30` (`text-indigo-600`) queda fuera del alcance declarado de la exploración — confirmar si entra en esta entrega o queda como deuda visual.

### `app-middleware` (modificada)

Proxy deja pasar las rutas auth nuevas sin sesión.

**Contrato para sdd-spec:**
- `src/proxy.ts` `isExcluded` (39-46): agregar `pathname === '/forgot-password'`, `pathname === '/reset-password'` y `pathname === '/auth/callback'`.
- Crítico: sin estas exclusiones, un usuario sin sesión que llega al link del email rebota a `/login` y el flujo PKCE se rompe.

## Approach

Se entrega como **auto-chain**: tracks independientes, cada uno revisable y mergeable por separado.

### Track A — Password reset (núcleo del change)

1. `src/lib/validations/auth.ts`: agregar `forgotPasswordSchema` y `resetPasswordSchema`.
2. `src/actions/auth.reset.ts`: `requestPasswordReset` (valida email → `resetPasswordForEmail(email, { redirectTo })` → éxito genérico siempre) y `updatePassword` (valida password → `updateUser({ password })`).
3. `src/app/auth/callback/route.ts`: leer `code` y `next` de la query; sanitizar `next`; `exchangeCodeForSession(code)`; set de cookies (via `createServerClient`); redirect a `next` validado o `/reset-password`.
4. `src/app/forgot-password/page.tsx` + `ForgotPasswordForm.tsx`: formulario de email con estado success genérico (anti-enumeración).
5. `src/app/reset-password/page.tsx` + `ResetPasswordForm.tsx`: verificación de sesión server-side (`getUser`); sin sesión → redirect `/forgot-password`; con sesión → form de nueva contraseña que llama `updatePassword` y redirige a `/login`.
6. Config Supabase (manual, checklist en verify): Site URL = dominio prod; Redirect URL exacta `<origin>/auth/callback`; template "Reset Password".

### Track B — Recordarme

1. `src/lib/supabase/server.ts`: `createServerClient(sessionMaxAge?)`; en el store, si `name.startsWith(storageKey)` y no es remove → `maxAge: sessionMaxAge ?? 60 * 60` (1 hora). Opcional: migrar a `getAll/setAll`.
2. `src/actions/auth.ts` `login()`: `const remember = formData.get('remember-me') === 'on'` → `sessionMaxAge: remember ? 7 * 24 * 60 * 60 : undefined`.
3. `logout()`: quitar el set de `sb-token` muerta; dejar que `signOut()` limpie las cookies reales.
4. `loginBranch` (auth.branch.ts): sin cambios de lógica — usa el default.

### Track C — UI

1. `LoginForm.tsx`: borrar bloque register (135-143); link "Olvidé mi contraseña" → `/forgot-password`.
2. `PortalLoginForm.tsx` + sucursal login `page.tsx`: restyle Rausch y `rounded-xl`.
3. `Navbar.tsx`: botones de sesión Rausch; early-return ampliado. `BottomNav.tsx`: early-return ampliado.

### Track D — Proxy

1. `src/proxy.ts`: `isExcluded` suma las 3 rutas auth nuevas.
2. Verificar en `proxy.test.ts` los casos nuevos (rutas auth accesibles sin sesión; rutas internas siguen protegidas).

## Affected Areas

| Archivo / Recurso | Impacto | Descripción |
|---|---|---|
| `src/app/forgot-password/page.tsx` + `ForgotPasswordForm.tsx` | Nuevo | Solicitud de reset por email; respuesta genérica anti-enumeración. |
| `src/app/reset-password/page.tsx` + `ResetPasswordForm.tsx` | Nuevo | Nueva contraseña; exige sesión (redirect a forgot si no la hay). |
| `src/app/auth/callback/route.ts` | Nuevo | Primer route handler del proyecto; exchange PKCE + cookies + redirect sanitizado. |
| `src/actions/auth.reset.ts` | Nuevo | Server actions `requestPasswordReset` y `updatePassword`. |
| `src/lib/validations/auth.ts` | Modificado | `forgotPasswordSchema` + `resetPasswordSchema`. |
| `src/lib/supabase/server.ts` | Modificado | `createServerClient(sessionMaxAge?)` + override maxAge en store (opcional getAll/setAll). |
| `src/actions/auth.ts` | Modificado | `login()` lee remember-me; logout sin cookie muerta `sb-token`. |
| `src/app/login/components/LoginForm.tsx` | Modificado | Sin bloque register; link olvidé → /forgot-password. |
| `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx` | Modificado | Restyle Rausch/#6a6a6a/#c13515. |
| `src/app/sucursal/[branchId]/login/page.tsx` | Modificado | Card `rounded-2xl` → `rounded-xl`. |
| `src/components/Navbar.tsx` | Modificado | Botones sesión Rausch; oculto en rutas auth nuevas (logo indigo:30 a confirmar en spec). |
| `src/components/BottomNav.tsx` | Modificado | Oculto en rutas auth nuevas. |
| `src/proxy.ts` | Modificado | `isExcluded` + `/forgot-password`, `/reset-password`, `/auth/callback`. |
| `src/proxy.test.ts` | Modificado | Casos de exclusión de las rutas auth nuevas. |
| Supabase dashboard (config manual) | Manual | Site URL, Redirect URL `/auth/callback`, template "Reset Password". |

## Risks

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **Open redirect** en `/auth/callback` vía parámetro `next` (el email lo puede manipular el atacante) | Sanitizar: solo rutas internas relativas (`/` inicial, sin `//`, sin `:`); fallback a `/reset-password`. |
| 2 | **Enumeración de cuentas** en `/forgot-password` (respuesta distinta si el email existe) | Respuesta genérica idéntica siempre; log server-side únicamente. |
| 3 | **`/reset-password` sin sesión** — el callback deja la sesión en cookies; si expira (PKCE ~1 hora) o el usuario abre el link en otro dispositivo, el update falla | Verificación server-side de `getUser()`; redirect a `/forgot-password` con mensaje de re-solicitud. |
| 4 | **maxAge vs refresh token TTL** — el techo real es el TTL server-side del refresh token (30-60 días); 7 días y 1 hora están por debajo, pero un cambio futuro del TTL impacta el recordarme | Documentar la relación; no superar 30 días en la constante de 7 días. |
| 5 | **Config Supabase manual** (Site URL / Redirect URL / template) — sin ella el email no llega o el callback 404 | Checklist explícito en verify; verificación manual por el usuario antes de merge. |
| 6 | **Convención `rounded-xl` vs token `rounded.sm` (8px)** — drift deliberado del proyecto en inputs/botones | Mantener `rounded-xl` consistente en las nuevas rutas auth (forgot/reset) y en la card de sucursal. |
| 7 | **Indigo residual** — `Navbar.tsx:30` (logo) y `auth.branch.ts` siguen con indigo fuera del alcance declarado | Confirmar en spec si el logo entra en esta entrega; registrar deuda visual si no. |

## Success Criteria

- [ ] Desde `/login`, "Olvidé mi contraseña" navega a `/forgot-password`.
- [ ] `requestPasswordReset` envía el email con link a `<origin>/auth/callback?next=/reset-password`; la respuesta es genérica con email existente e inexistente (anti-enumeración verificada).
- [ ] `/auth/callback` intercambia el code, setea las cookies de sesión y redirige a `/reset-password`; `next` externo es rechazado (redirect a `/reset-password`).
- [ ] `/reset-password` con sesión permite actualizar la contraseña; sin sesión redirige a `/forgot-password`.
- [ ] Con la nueva contraseña se puede iniciar sesión en `/login` (y en el portal de sucursal si aplica al mismo usuario).
- [ ] Checkbox "Recordarme" ON → cookie `sb-<ref>-auth-token` con maxAge 7 días; OFF → 1 hora (verificado por inspección de cookie).
- [ ] `logout()` limpia las cookies de sesión reales; la cookie muerta `sb-token` ya no se escribe.
- [ ] `LoginForm` no muestra el bloque "Regístrate aquí"; no existe `/register`.
- [ ] `PortalLoginForm` y sucursal login `page.tsx` sin indigo y con `rounded-xl`; Navbar sin indigo en botones de sesión.
- [ ] `/forgot-password`, `/reset-password` y `/auth/callback` accesibles sin sesión (proxy) y sin chrome (Navbar/BottomNav ocultos).
- [ ] `npm test` pasa (incluye `proxy.test.ts` actualizado) y `npm run build` sin errores de TypeScript strict.
- [ ] Config Supabase verificada: Site URL, Redirect URL `/auth/callback` y template "Reset Password" (checklist manual cumplido).