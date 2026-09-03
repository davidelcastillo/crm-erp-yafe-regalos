# Domain: auth-login-ui — Delta

## Delta

**Capability modificada** — no existe spec base en `openspec/specs/auth-login-ui/spec.md`; el delta se define contra el comportamiento actual de `src/app/login/components/LoginForm.tsx` (verificado en disco). Cambios: (1) eliminar el bloque register "¿No tienes una cuenta? / Regístrate aquí" (líneas 135-143) por decisión del usuario (no existe register público), (2) convertir el link inerte "Olvidé mi contraseña" (`<a href="#">`, líneas 115-120) en navegación real a `/forgot-password`, (3) el checkbox `remember-me` (líneas 100-105) ya existe y queda conectado al `login()` (sin cambios de UI). `loginSchema` y el error genérico se mantienen intactos.

## Requirements

1. **Sin bloque register**: el sistema SHALL NOT renderizar el bloque "¿No tienes una cuenta? / Regístrate aquí" en `LoginForm.tsx`. La ruta `/register` SHALL NOT existir (el proxy redirige a no-admin y la ruta no se crea).
2. **Link de recuperación funcional**: el sistema SHALL reemplazar el `<a href="#">` por un `Link` (next/link) con `href="/forgot-password"` y texto "Olvidé mi contraseña", conservando las clases actuales `font-medium text-[#ff385c] hover:text-[#e00b41]`.
3. **Checkbox recordarme conectado**: el sistema SHALL mantener el checkbox con `name="remember-me"` y sus clases actuales (`h-5 w-5 text-[#ff385c] focus:ring-[#ff385c] border-gray-300 rounded`), de modo que su valor llegue al `login()` vía FormData (marcado → `remember-me='on'`); no se requieren cambios de UI.
4. **Validación intacta**: el sistema SHALL conservar `loginSchema` (email + mínimo 8 caracteres) y el error genérico (`'Invalid email or password'` / `'Credenciales inválidas'`) sin exponer si la cuenta existe.
5. **Estética STYLE.md preservada**: el resto de `LoginForm.tsx` (labels `text-[#6a6a6a]`, inputs foco Rausch, error `text-[#c13515]`, botón `bg-[#ff385c] hover:bg-[#e00b41]`, card `rounded-xl` en `login/page.tsx`) SHALL permanecer sin cambios.

## Scenarios

#### Scenario: El login muestra el link de recuperación funcional
- GIVEN `/login` renderizado sin sesión
- WHEN el usuario ve el formulario
- THEN el link "Olvidé mi contraseña" está presente con `href="/forgot-password"`
- AND al hacer click navega a `/forgot-password` (sin hash `#`)

#### Scenario: El login no muestra registro
- GIVEN `/login` renderizado
- THEN no existe el texto "¿No tienes una cuenta?" ni el link "Regístrate aquí"
- AND la visita a `/register` no renderiza un formulario de registro (ruta inexistente)

#### Scenario: Recordarme llega al login()
- GIVEN el usuario marca el checkbox "Recordarme" y envía credenciales válidas
- WHEN `handleSubmit` construye el FormData del form y llama a `login(formData)`
- THEN el FormData contiene `remember-me='on'`
- AND `login()` aplica la sesión de 7 días (ver `auth-session-persistence`)

#### Scenario: Error genérico sin enumeración
- GIVEN un email no registrado y una contraseña cualquiera
- WHEN el usuario envía el formulario
- THEN se muestra el error genérico de credenciales
- AND la respuesta no revela si el email existe