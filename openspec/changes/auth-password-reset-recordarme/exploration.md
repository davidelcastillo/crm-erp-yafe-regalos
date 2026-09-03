# Exploration: auth-password-reset-recordarme (alcance revisado)

## Contexto (verificado)

- Producción tiene 1 solo usuario: yafe.regalos@gmail.com (role admin, confirmado).
- Login funcional, estética STYLE.md ya aplicada en LoginForm/login page.
- **Register**: DECISIÓN DEL USUARIO = REMOVER el link "Regístrate aquí" del login (no crear register público). El proxy bloquea a todo no-admin; sin register público no hay hoyo de seguridad.
- Link "Olvidé mi contraseña" es href="#" inerte → hay que hacerlo funcional (password reset con Supabase Auth PKCE).
- Checkbox "Recordarme" es inerte → hay que hacerlo funcional (maxAge de cookie de sesión).
- PortalLoginForm (sucursal) sigue con estética indigo → alinear a STYLE.md.

## Hallazgos técnicos clave (exploración con evidencia)

### Password reset — flujo PKCE (forzado por @supabase/ssr 0.12.4)
/login → /forgot-password (email) → action `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/callback?next=/reset-password })` → email → /auth/callback (route handler NUEVO: exchangeCodeForSession + cookies + redirect) → /reset-password (requiere sesión) → action `updateUser({ password })` → /login.

Archivos: `src/app/auth/callback/route.ts` (PRIMER route.ts del proyecto), `src/app/forgot-password/page.tsx` + `ForgotPasswordForm.tsx`, `src/app/reset-password/page.tsx` + `ResetPasswordForm.tsx`, `src/actions/auth.reset.ts` (requestPasswordReset + updatePassword), validaciones nuevas en `src/lib/validations/auth.ts` (forgotPasswordSchema, resetPasswordSchema).

Config Supabase necesaria: Site URL = dominio prod; Redirect URL debe incluir exactamente `<origin>/auth/callback`; template "Reset Password" verificado.

### Recordarme — mecanismo real (crítico, verificado en node_modules)
- `cookieOptions.maxAge` NO funciona en @supabase/ssr 0.12.4 (lo pisa con DEFAULT_COOKIE_OPTIONS.maxAge = 400 días, cookies.ts:309-310/609-610).
- La duración real se controla por el maxAge de la cookie de sesión `sb-<ref>-auth-token` (+ chunks).
- Fix: `createServerClient(sessionMaxAge?: number)` en `src/lib/supabase/server.ts` → en el store set/setAll, si name.startsWith(storageKey) y no es remove → maxAge: sessionMaxAge ?? default.
- `login()` en `src/actions/auth.ts` lee `formData.get('remember-me') === 'on'` → 7 días vs 1 hora (o default).
- Opcional recomendado: migrar el store de get/set/remove (deprecado) a getAll/setAll.

### Estética pendiente
- `PortalLoginForm.tsx` (sucursal): botón indigo → Rausch; labels gray-900 → #6a6a6a; inputs ring-indigo → foco Rausch; error red-600 → #c13515.
- `sucursal/[branchId]/login/page.tsx`: card rounded-2xl → rounded-xl.
- `Navbar.tsx:45`: botón "Iniciar sesión" indigo → Rausch (último indigo visible).
- Convención del proyecto: rounded-xl en inputs/botones (drift deliberado vs token 8px).

### Proxy / chrome
- Agregar a isExcluded: /forgot-password, /reset-password, /auth/callback (crítico: sin esto rebotan a /login).
- Navbar/BottomNav: ocultar también en las rutas auth nuevas (forgot/reset) — /auth/* ya no muestra chrome porque son rutas server.

### Register: REMOVIDO
- Quitar el bloque "¿No tienes una cuenta? / Regístrate aquí" de LoginForm.tsx (líneas 135-143).
- No se crea /register.

## Archivos afectados (alcance final)

| Ruta | Acción |
|---|---|
| `src/app/login/components/LoginForm.tsx` | Quitar link register; link olvidé → /forgot-password |
| `src/app/forgot-password/page.tsx` + `ForgotPasswordForm.tsx` | Crear |
| `src/app/reset-password/page.tsx` + `ResetPasswordForm.tsx` | Crear |
| `src/app/auth/callback/route.ts` | Crear (primer route handler) |
| `src/actions/auth.reset.ts` | Crear (requestPasswordReset + updatePassword) |
| `src/lib/validations/auth.ts` | Agregar forgotPasswordSchema + resetPasswordSchema |
| `src/lib/supabase/server.ts` | Param sessionMaxAge + override maxAge en store (opcional getAll/setAll) |
| `src/actions/auth.ts` | login() lee remember-me; limpiar sb-token muerto en logout |
| `src/proxy.ts` | isExcluded: + /forgot-password, /reset-password, /auth/callback |
| `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx` + `page.tsx` | Restyle Rausch + rounded-xl |
| `src/components/Navbar.tsx` | Botón Iniciar sesión Rausch; ocultar en rutas auth |
| `src/components/BottomNav.tsx` | Ocultar en rutas auth (forgot/reset) |
| Supabase dashboard (config) | Site URL + Redirect URL /auth/callback + template Reset Password |

## Riesgos

- Callback con `next` → sanitizar (open redirect).
- Anti-enumeración: forgot-password responde genérico siempre.
- reset-password requiere sesión real server-side (el callback la dejó en cookies).
- maxAge del refresh token TTL es el techo server-side (30-60 días) — 7 días y 1 hora están por debajo.
- Config Supabase (Site URL/Redirect) es manual por el usuario — sin eso el email de reset no llega bien.