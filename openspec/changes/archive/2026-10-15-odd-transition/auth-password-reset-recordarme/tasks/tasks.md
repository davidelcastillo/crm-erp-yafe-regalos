# Tasks: Auth — Password Reset funcional, Recordarme y alineación STYLE.md

## Metadata

| Campo | Valor |
|---|---|
| **Change ID** | `auth-password-reset-recordarme` |
| **Preflight** | auto · hybrid (OpenSpec + Engram) · delivery_strategy: auto-chain · review_budget: 400 · chain_strategy: feature-branch-chain |
| **Contrato design** | `openspec/changes/auth-password-reset-recordarme/design/design.md` (fuente principal; tracks A/B/C/D) |
| **Contrato specs** | `auth-password-reset`, `auth-session-persistence`, `auth-login-ui`, `branch-portal-login-ui`, `app-navigation`, `app-middleware` |
| **Stack** | Next.js 16.2.4 (App Router) · React 19.2.4 · TS strict · Supabase Auth · @supabase/ssr 0.12.4 · Zod 4 · Tailwind v4 + STYLE.md |
| **TDD** | `strict_tdd: true` → cada tarea de producción va precedida por su test RED |
| **Nota proyecto** | Integración/E2E no disponibles (config.yaml); `package.json` no tiene script `test:e2e` → verificación E2E manual |

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–700 (≈9 archivos nuevos + ≈12 modificados + ≈7 tests nuevos) |
| 400-line budget risk | Alto |
| Chained PRs recommended | Sí |
| Suggested split | PR 1 (Track D + B) → PR 2 (Track C) → PR 3 (Track A) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
```

**Decision needed before apply: No** — `delivery_strategy: auto-chain` ya resuelta en preflight; el orquestador procede con el primer slice (PR 1) sin consultar.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 — Track D + B | Proxy excluye 3 rutas auth; recordarme funcional: `session.ts`, `server.ts` migrado a `getAll/setAll` con override, `login()` lee remember-me, `logout()` sin cookie muerta | PR 1 | `npx jest src/proxy.test.ts src/lib/supabase/session.test.ts` | login ON/OFF + inspección cookie Max-Age 604800/3600 | Revertir proxy.ts, session.ts, server.ts, auth.ts + tests |
| U2 — Track C | UI STYLE.md: LoginForm sin register + Link forgot; PortalLoginForm + sucursal page restyle; Navbar/BottomNav early-return +3 rutas + botones Rausch | PR 2 | `npx jest src/components/Navbar.test.tsx src/components/BottomNav.test.ts` | Navegación manual /login, /sucursal/5/login, /dashboard, /forgot-password | Revertir LoginForm, PortalLoginForm, page.tsx, Navbar, BottomNav |
| U3 — Track A | Password reset completo: schemas, auth.reset.ts, route handler callback con sanitizeNextPath, páginas + forms, 4 tests | PR 3 | `npm test` + `npx tsc --noEmit` | E2E manual forgot → email → callback → reset → login (requiere 5.1) | Borrar archivos nuevos + revertir validations/auth.ts |

## Fase 1: Fundación pura + middleware (Track D — PR 1)

**1.1 `src/lib/auth/sanitize-next.ts` — `sanitizeNextPath` + test tabla**
Desc: módulo puro `sanitizeNextPath(value: string | null | undefined): string`: FALLBACK='/reset-password'; aceptar solo rutas internas relativas (/ inicial, NO //, NO :). Sin imports de Next.
AC: `sanitize-next.test.ts` (RED) verde: /reset-password→igual; /login→igual; null/''→fallback; https://evil.example→fallback; //evil.example→fallback; javascript:alert(1)→fallback; /ruta:puerto→fallback; /reset-password?foo=bar→conservado.
Riesgos: Open redirect si regla laxa.
Deps: — (consumida por 3.2).

**1.2 `src/lib/supabase/session.ts` — constantes + `deriveStorageKey` + `resolveSessionMaxAge` + tests**
Desc: módulo puro: DEFAULT_SESSION_MAX_AGE=3600, REMEMBER_ME_MAX_AGE=604800, deriveStorageKey(url)→sb-<ref>-auth-token (del hostname), resolveSessionMaxAge({name,value,sessionMaxAge,storageKey}): value===''→undefined; !startsWith(storageKey)→undefined; else sessionMaxAge??3600.
AC: session.test.ts (RED) verde: deriveStorageKey correcto; remove→undefined; redirect-to→undefined; token sin arg→3600; chunk .0→3600; con 604800→604800.
Riesgos: chunks fuera del override; cota 30 días.
Deps: — (consumida por 2.1, 2.2).

**1.3 `src/proxy.ts` — `isExcluded` + 3 rutas + `proxy.test.ts` 3 casos**
Desc: agregar en isExcluded (39-46) `/forgot-password`, `/reset-password`, `/auth/callback`. NO tocar matcher ni gating.
AC: proxy.test.ts (RED) 3 casos: rutas auth sin sesión → NextResponse.next sin redirect; los 4 casos existentes siguen pasando.
Riesgos: sin exclusiones el PKCE se rompe; no debilitar gating.
Deps: — (verificación con mocks existentes).

## Fase 2: Recordarme — session persistence (Track B — PR 1)

**2.1 `src/lib/supabase/server.ts` — migrar store a `getAll/setAll` + `createServerClient(sessionMaxAge?)`**
Desc: migrar store deprecado (12-22) a getAll/setAll; firma opcional sessionMaxAge; en setAll aplicar resolveSessionMaxAge con storageKey derivado; createServiceClient() intacto.
AC: npm test verde (proxy.test.ts y auth.branch.test.ts mockean este módulo); imports de session.ts; call sites sin arg → default 1h.
Riesgos: regresión global por migración (proxy, login, loginBranch, logout, getUser); SDK pisa maxAge con 400 días (verificado 0.12.4); verifier PKCE recibe maxAge inerte.
Deps: 1.2.

**2.2 `src/actions/auth.ts` — `login()` lee remember-me + `logout()` sin `sb-token`**
Desc: login() (31): remember=formData.get('remember-me')==='on' → createServerClient(remember?REMEMBER_ME_MAX_AGE:undefined); logout() (87): eliminar set de sb-token.
AC: diff revisado; login pasa override solo con 'on'; logout no referencia sb-token; ActionResult conservado; verificación manual cookie.
Riesgos: romper ActionResult (contrato con 3.1); checkbox ya existe (LoginForm 100-105).
Deps: 2.1, 1.2.

**2.3 `src/lib/validations/auth.ts` — `forgotPasswordSchema` + `resetPasswordSchema` + tipos**
Desc: forgotPasswordSchema (email), resetPasswordSchema (password min 8) + tipos ForgotPasswordValues/ResetPasswordValues; loginSchema intacto.
AC: auth.test.ts (RED) verde: email inválido falla, válido pasa; password <8 falla, ≥8 pasa; 3 casos loginSchema existentes verdes.
Riesgos: mensajes consistentes con el estilo.
Deps: — (consumida por 3.1).

## Fase 3: Password reset — Track A (PR 3)

**3.1 `src/actions/auth.reset.ts` — `requestPasswordReset` + `updatePassword` + `getOrigin`** ✅ (PR3)
Desc: 'use server'; getOrigin() privado (x-forwarded-host??host + proto split(',')[0]??'https'); requestPasswordReset → valida forgotPasswordSchema → resetPasswordForEmail(email,{redirectTo:<origin>/auth/callback?next=/reset-password}) → SIEMPRE {success:true}; updatePassword → valida resetPasswordSchema → updateUser({password}) → {success:true,redirectTo:'/login'} o error genérico.
AC: ver 3.5; firma Promise<ActionResult>; error updateUser → {success:false,error:'No se pudo actualizar la contraseña'}.
Riesgos: enumeración (respuesta idéntica); proto multi-valor (primer valor); host spoofing acotado.
Deps: 2.3, 2.1.

**3.2 `src/app/auth/callback/route.ts` — route handler + test** ✅ (PR3)
Desc: primer route.ts; force-dynamic; GET(request): code+next de searchParams; next=sanitizeNextPath(next); sin code → 307 /forgot-password; createServerClient()+exchangeCodeForSession(code); éxito → redirect next validado; error → console.error + /forgot-password.
AC: route.test.ts (RED; mock server client; sanitizeNextPath real): code+next=/reset-password→307; next=https://evil.example→307 /reset-password; sin code→/forgot-password; exchange error→/forgot-password.
Riesgos: open redirect (sanitizar ANTES); 307 default aceptado; proxy ya lo deja pasar (1.3).
Deps: 1.1, 2.1.

**3.3 `/forgot-password` — `page.tsx` + `ForgotPasswordForm.tsx` + test RTL** ✅ (PR3)
Desc: page server (card rounded-xl + metadata); form client: email type=email autoComplete required, estados idle/sending/success, pending local (NO useFormStatus), mensaje genérico anti-enumeración.
AC: ForgotPasswordForm.test.tsx (RED; mock auth.reset): email inválido → error sin llamar action; válido → llama requestPasswordReset y muestra mensaje genérico; no revela si email existe.
Riesgos: enumeración; pending local evita bug useFormStatus.
Deps: 2.3, 3.1, 4.3, 1.3.

**3.4 `/reset-password` — `page.tsx` + `ResetPasswordForm.tsx` + test RTL** ✅ (PR3)
Desc: page server force-dynamic; getUser() sin sesión → redirect('/forgot-password'); con sesión → form; ResetPasswordForm: password type=password autoComplete=new-password required, pending local, updatePassword → router.push('/login').
AC: ResetPasswordForm.test.tsx (RED; mock action + useRouter): password <8 → error sin action; válida → updatePassword + router.push('/login'); redirect server-side sin sesión verificado manual.
Riesgos: PKCE ~1h expira; link en otro dispositivo.
Deps: 3.1, 3.2, 4.3, 1.3.

**3.5 `src/actions/auth.reset.test.ts` — actions con mock createServerClient** ✅ (PR3)
Desc: test unitario (patrón auth.branch.test.ts: mock @/lib/supabase/server + next/headers para getOrigin).
AC: (RED) email inválido → {success:false} sin resetPasswordForEmail; válido → resetPasswordForEmail(email,{redirectTo:'https://app.example.com/auth/callback?next=/reset-password'}) y {success:true}; con error de Supabase → MISMA respuesta {success:true} (anti-enumeración); password <8 → error sin updateUser; válida → updateUser + {success:true,redirectTo:'/login'}; updateUser error → {success:false}.
Riesgos: redirectTo exacto con origin mock; Redirect URL acepta query.
Deps: 3.1.

## Fase 4: UI STYLE.md — Track C (PR 2)

**4.1 `src/app/login/components/LoginForm.tsx` — quitar register + Link forgot**
Desc: eliminar bloque register (135-143); reemplazar <a href="#"> (115-120) por Link href="/forgot-password" con clases font-medium text-[#ff385c] hover:text-[#e00b41]; NO tocar checkbox remember-me (100-105) ni useFormStatus.
AC: sin "¿No tienes una cuenta?" ni "Regístrate aquí"; link olvidé → /forgot-password; no se crea /register; loginSchema y error intactos.
Riesgos: tocar useFormStatus rompe disabled (no tocar).
Deps: — (UI pura).

**4.2 `PortalLoginForm.tsx` + sucursal login `page.tsx` — restyle Rausch**
Desc: labels → text-[#6a6a6a] (:52/:68); inputs focus:ring-indigo-600 → focus:border-[#ff385c] focus:ring-[#ff385c]/20 conservando ring-1 ring-inset ring-gray-300 min-h-[44px] touch-manipulation (:61/:77); error → text-[#c13515] (:83); botón → bg-[#ff385c] hover:bg-[#e00b41] + focus:ring-[#ff385c]/50 (:90) conservando w-full rounded-xl shadow-sm min-h-[44px] touch-manipulation disabled:opacity-50; page.tsx card rounded-2xl → rounded-xl (:20). Lógica loginBranch intacta.
AC: cero indigo residual; atributos táctiles preservados; auth.branch.test.ts verdes.
Riesgos: regresión táctil si se pierde min-h/touch-manipulation.
Deps: —.

**4.3 `Navbar.tsx` + `BottomNav.tsx` — early-return +3 rutas + botones Rausch**
Desc: Navbar early-return (16-18) + /forgot-password, /reset-password, /auth/callback; botones sesión (:39,:45) → Rausch + focus:ring-[#ff385c]/50 (conservar rounded-md); logo (:30) SIN cambios (deuda visual); BottomNav early-return (64-68) + 3 rutas.
AC: Navbar.test.tsx y BottomNav.test.ts (RED): rutas auth nuevas → render vacío; /dashboard sigue con chrome; botones sin indigo; casos existentes verdes.
Riesgos: ocultar chrome en rutas equivocadas.
Deps: —.

## Fase 5: Cierre

**5.1 Checklist manual — Config Supabase (usuario)**
Desc: dashboard Supabase: Site URL = dominio prod; Redirect URL exacta <origin>/auth/callback (query ?next= no requiere entrada adicional); template Reset Password habilitado.
AC: confirmado por el usuario antes del merge del tracker.
Riesgos: sin config el email no llega o callback 404.
Deps: PR 3.

**5.2 Suite completa + verificación E2E manual**
Desc: npm test, npx tsc --noEmit, npm run lint, npm run build; E2E manual forgot → email → callback → reset → login; cookie Max-Age ON/OFF; logout sin sb-token; next malicioso rechazado.
AC: suite 100% verde (incluye proxy.test.ts + 6 tests nuevos); build exitoso; checklist 5.1; success criteria de proposal.
Riesgos: build si server component exige dynamic (ya cubierto 3.2/3.4).
Deps: todas.

## Delivery Plan

- Estrategia: auto-chain + feature-branch-chain. Tracker `feature/auth-password-reset-recordarme` (draft, no-merge — único que mergea a main). PR 1 (base=tracker) U1; PR 2 (base=PR1) U2; PR 3 (base=PR2) U3. Si un PR hijo muestra el diff del padre → retarget/rebase.
- Commits (conventional, tests junto al código):
  - PR1: `feat(middleware): excluir rutas auth del proxy` / `feat(auth): módulo de sesión puro con maxAge (session.ts)` / `feat(auth): store getAll/setAll + createServerClient(sessionMaxAge)` / `feat(auth): login lee remember-me y logout sin sb-token`
  - PR2: `style(login): quitar bloque register y link funcional a /forgot-password` / `style(portal): restyle Rausch login de sucursal` / `style(nav): ocultar chrome en rutas auth y botones Rausch`
  - PR3: `feat(auth): sanitizeNextPath y schemas forgot/reset` / `feat(auth): server actions requestPasswordReset y updatePassword` / `feat(auth): route handler /auth/callback con exchange PKCE` / `feat(auth): páginas forgot-password y reset-password + forms`
- Orden merge: PR1 → PR2 → PR3; tracker a main tras sdd-verify + checklist 5.1.

## Key Learnings

1. El control real de duración de sesión en @supabase/ssr 0.12.4 es el maxAge de la cookie en el store (el SDK pisa cookieOptions.maxAge con 400 días).
2. El proyecto no tiene tests E2E automatizados → verificación PKCE manual.
3. proxy.test.ts ya mockea @/lib/supabase/server → aísla la migración getAll/setAll.
4. ActionResult de src/actions/auth.ts es el contrato compartido que auth.reset.ts debe importar.
5. Forms nuevos usan pending local (useFormStatus en LoginForm es bug latente documentado).