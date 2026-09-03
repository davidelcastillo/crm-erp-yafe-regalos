# Domain: auth-password-reset — Delta

## Delta

**Nueva capability** — no existe spec base en `openspec/specs/auth-password-reset/spec.md`. Esta spec define desde cero el flujo completo de recuperación de contraseña sobre Supabase Auth con intercambio de code PKCE (forzado por @supabase/ssr 0.12.4). El sistema actual no tiene ninguna ruta de reset: el link "Olvidé mi contraseña" del login es `href="#"` inerte y no existe route handler en el proyecto.

Secuencia objetivo: `/login` → `/forgot-password` (email) → server action `requestPasswordReset` → email de Supabase con link a `<origin>/auth/callback?next=/reset-password` → route handler `/auth/callback` (intercambia el code, setea cookies, redirige) → `/reset-password` (exige sesión) → server action `updatePassword` → `/login`.

## Requirements

1. **Ruta `/forgot-password`**: el sistema SHALL proveer una página server (`src/app/forgot-password/page.tsx`) que renderice un formulario client (`ForgotPasswordForm.tsx`) con un único campo `email` (type `email`, `autoComplete="email"`, `required`) y un botón de envío, siguiendo el patrón visual de la página de login (card `rounded-xl`, tokens STYLE.md, sin chrome).
2. **Esquema `forgotPasswordSchema`**: el sistema SHALL agregar en `src/lib/validations/auth.ts` el esquema `z.object({ email: z.string().email(...) })` que valide un email bien formado; el mensaje de error SHALL ser el mismo estilo del proyecto (`'Correo electrónico inválido'`).
3. **Server action `requestPasswordReset(formData: FormData): Promise<ActionResult>`** en `src/actions/auth.reset.ts`: SHALL validar el email con `forgotPasswordSchema`; si la validación falla SHALL devolver `{ success: false, error: <mensaje genérico> }` sin invocar a Supabase. Si el email es válido SHALL llamar a `supabase.auth.resetPasswordForEmail(email, { redirectTo })` donde `redirectTo` es la URL absoluta `<origin>/auth/callback?next=/reset-password` (el origin derivado de la URL del request).
4. **Anti-enumeración**: `requestPasswordReset` SHALL devolver SIEMPRE una respuesta de éxito genérica idéntica (mismo status, mismo cuerpo) exista o no el email en `auth.users`; el resultado real de Supabase (éxito/error) SHALL registrarse únicamente en logs del servidor y MUST NOT exponerse en la respuesta al cliente.
5. **Route handler `/auth/callback`** (`src/app/auth/callback/route.ts`, primer `route.ts` del proyecto): SHALL leer `code` y `next` de `searchParams`; si falta `code` SHALL redirigir a `/forgot-password`. SHALL ejecutar `exchangeCodeForSession(code)` y, con el cliente server de Supabase, setear las cookies de sesión en la respuesta. SHALL redirigir (303/307) a `next` validado o, en su defecto, a `/reset-password`.
6. **Sanitización de `next`** (anti open redirect): el sistema SHALL aceptar `next` únicamente si es una ruta interna relativa: comienza con exactamente un `/`, NO comienza con `//` y NO contiene el carácter `:`. Cualquier otro valor (URL absoluta, `//host`, `javascript:`, etc.) SHALL redirigir a `/reset-password`. `next` ausente o vacío SHALL redirigir a `/reset-password`.
7. **Ruta `/reset-password`**: el sistema SHALL proveer una página server (`src/app/reset-password/page.tsx`) que verifique la sesión server-side con `getUser()`; sin sesión válida SHALL redirigir a `/forgot-password` (el token PKCE expira en ~1 hora); con sesión SHALL renderizar un formulario client (`ResetPasswordForm.tsx`) con un campo `password` (type `password`, `autoComplete="new-password"`, `required`).
8. **Esquema `resetPasswordSchema`**: el sistema SHALL agregar en `src/lib/validations/auth.ts` el esquema `z.object({ password: z.string().min(8, ...) })`, consistente con `loginSchema` (mínimo 8 caracteres).
9. **Server action `updatePassword(formData: FormData): Promise<ActionResult>`** en `src/actions/auth.reset.ts`: SHALL validar la contraseña con `resetPasswordSchema`; si falla SHALL devolver `{ success: false, error: <mensaje genérico> }` sin invocar a Supabase; si es válida SHALL llamar a `supabase.auth.updateUser({ password })` y, en caso de éxito, SHALL devolver `{ success: true, redirectTo: '/login' }`.
10. **Config Supabase (manual, checklist para verify)**: MUST estar verificada en el dashboard — Site URL = dominio de producción; Redirect URL que incluya exactamente `<origin>/auth/callback`; template "Reset Password" habilitado. Sin esto el email no llega o el callback responde 404.

## Scenarios

#### Scenario: Solicitud de reset con email existente
- GIVEN un email registrado en `auth.users`
- WHEN el usuario envía el formulario de `/forgot-password` con ese email
- THEN `requestPasswordReset` devuelve la respuesta genérica de éxito
- AND Supabase envía el email con link a `<origin>/auth/callback?next=/reset-password`

#### Scenario: Solicitud de reset con email inexistente (anti-enumeración)
- GIVEN un email NO registrado en `auth.users`
- WHEN el usuario envía el formulario de `/forgot-password` con ese email
- THEN `requestPasswordReset` devuelve la MISMA respuesta genérica de éxito (idéntico status y cuerpo)
- AND la diferencia (email no enviado) solo queda en logs del servidor

#### Scenario: Email malformado en forgot
- GIVEN el campo email con valor inválido (p. ej. `"abc"`)
- WHEN el usuario envía el formulario
- THEN la validación Zod falla y se muestra el error de validación
- AND `resetPasswordForEmail` NO se invoca

#### Scenario: Callback con `next` válido
- GIVEN el usuario llega a `/auth/callback?code=<pkce-code>&next=/reset-password` desde el email
- WHEN el route handler ejecuta `exchangeCodeForSession(code)`
- THEN las cookies de sesión se setean en la respuesta y se redirige a `/reset-password`

#### Scenario: Callback con `next` malicioso (open redirect bloqueado)
- GIVEN el usuario llega a `/auth/callback?code=<pkce-code>&next=https://evil.example` (o `next=//evil.example` o `next=/ruta:puerto`)
- WHEN el route handler procesa el request
- THEN el intercambio PKCE se completa pero la redirección va a `/reset-password`
- AND el navegador NUNCA es redirigido al host externo

#### Scenario: Callback sin `code`
- GIVEN el usuario visita `/auth/callback` sin parámetro `code` (o con `code` vacío)
- WHEN el route handler procesa el request
- THEN se redirige a `/forgot-password`

#### Scenario: `/reset-password` sin sesión
- GIVEN el usuario abre `/reset-password` sin cookies de sesión válidas (token expirado o link abierto en otro dispositivo)
- WHEN la página server verifica la sesión con `getUser()`
- THEN se redirige a `/forgot-password` para re-solicitar el reset

#### Scenario: `/reset-password` con sesión
- GIVEN el usuario llega con sesión válida (cookies seteadas por el callback)
- WHEN se accede a `/reset-password`
- THEN la página renderiza `ResetPasswordForm` con el campo de nueva contraseña

#### Scenario: Actualización de contraseña exitosa → login
- GIVEN una sesión válida en `/reset-password` y una nueva contraseña de al menos 8 caracteres
- WHEN el usuario envía el formulario
- THEN `updatePassword` llama a `updateUser({ password })`, devuelve `{ success: true, redirectTo: '/login' }`
- AND el usuario puede iniciar sesión en `/login` con la nueva contraseña

#### Scenario: Contraseña nueva demasiado corta
- GIVEN una nueva contraseña de menos de 8 caracteres
- WHEN el usuario envía el formulario
- THEN la validación Zod falla y se muestra el error genérico
- AND `updateUser` NO se invoca

## Out of Scope

- **Register público**: no se crea `/register` ni auto-registro (decisión de usuario).
- **Gestión de usuarios admin**: CRUD de usuarios, backfill de claims o panel de administración.
- **OAuth social**: Google/GitHub/etc. no forman parte de este change.
- **RLS / políticas de datos**: sin cambios en Postgres.
- **Recordarme en el portal de sucursal**: el portal conserva su flujo actual (ver `auth-session-persistence`).
- **Reintentos/rate limiting de emails**: no se implementa throttling propio; se confía en las protecciones de Supabase Auth.
- **Cambio de email u otros datos del usuario**: `updatePassword` solo actualiza la contraseña.