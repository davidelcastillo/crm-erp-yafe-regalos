# Domain: branch-portal-login-ui — Delta

## Delta

**Capability modificada** — no existe spec base en `openspec/specs/branch-portal-login-ui/spec.md`; el delta se define contra el comportamiento actual de `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx` y `page.tsx` (verificado en disco). Cambios: restyle exclusivamente estético para alinear a STYLE.md — botón submit `bg-indigo-600 hover:bg-indigo-700` → Rausch, labels `text-gray-900` → `text-[#6a6a6a]`, inputs `focus:ring-indigo-600` → foco Rausch, error `text-red-600` → `text-[#c13515]`, card `rounded-2xl` → `rounded-xl`. **Sin cambios de lógica**: `loginBranch` (schema, errores, validación de branch, redirect) se mantiene intacto.

## Requirements

1. **Botón submit Rausch**: el sistema SHALL reemplazar en `PortalLoginForm.tsx` las clases `bg-indigo-600 hover:bg-indigo-700` del botón por `bg-[#ff385c] hover:bg-[#e00b41]`, y el `focus:ring-indigo-500` por `focus:ring-[#ff385c]/50` (patrón del botón de `LoginForm`). Las clases estructurales existentes (`w-full`, `rounded-xl`, `shadow-sm`, `min-h-[44px]`, `touch-manipulation`, `disabled:opacity-50`) SHALL permanecer.
2. **Labels**: el sistema SHALL reemplazar `text-gray-900` por `text-[#6a6a6a]` en los labels "Correo electrónico" y "Contraseña".
3. **Inputs con foco Rausch**: el sistema SHALL reemplazar `focus:ring-indigo-600` por `focus:border-[#ff385c] focus:ring-[#ff385c]/20` en ambos inputs, conservando su estructura actual (`rounded-xl`, `ring-1 ring-inset ring-gray-300`, `min-h-[44px]`, `touch-manipulation`). El sistema SHALL NOT dejar clases indigo residuales (`focus:ring-indigo-*`, `ring-indigo-*`) en el formulario.
4. **Error Rausch**: el sistema SHALL reemplazar `text-red-600` por `text-[#c13515]` en el mensaje de error. El mensaje de éxito (`text-green-600`) SHALL permanecer.
5. **Card de la página**: el sistema SHALL reemplazar `rounded-2xl` por `rounded-xl` en la card de `src/app/sucursal/[branchId]/login/page.tsx` (convención del proyecto, consistente con `login/page.tsx`).
6. **Lógica intacta**: el sistema SHALL NOT modificar el comportamiento de `loginBranch` (misma validación con `loginSchema`, mismo error genérico, misma verificación de `branchId`/rol y descarte de sesión en caso de mismatch, mismo redirect a `/sucursal/<branchId>/inventory`).
7. **Atributos táctiles preservados** (mobile-first): el restyle SHALL NOT eliminar `min-h-[44px]`, `touch-manipulation` ni `autoComplete` de los inputs y el botón.

## Scenarios

#### Scenario: Portal de sucursal estilizado según STYLE.md
- GIVEN `/sucursal/5/login` renderizado
- WHEN el usuario inspecciona el formulario
- THEN la card usa `rounded-xl`, los labels son `text-[#6a6a6a]`, los inputs tienen foco `focus:border-[#ff385c] focus:ring-[#ff385c]/20`, el error es `text-[#c13515]` y el botón es `bg-[#ff385c] hover:bg-[#e00b41]`
- AND no queda ninguna clase indigo en el formulario ni en la card

#### Scenario: El restyle no altera el login del portal
- GIVEN un usuario branch válido para la sucursal 5
- WHEN envía credenciales correctas en el portal
- THEN `loginBranch` responde `{ success: true, redirectTo: '/sucursal/5/inventory' }` (comportamiento idéntico al previo al restyle)

#### Scenario: Error de credenciales en el portal
- GIVEN credenciales inválidas o de otra sucursal
- WHEN el usuario envía el formulario
- THEN se muestra el error genérico en color `text-[#c13515]`
- AND no se redirige al inventario ni se conserva una sesión de sucursal

#### Scenario: Objetivos táctiles preservados
- GIVEN el portal renderizado en un dispositivo móvil (viewport Android)
- WHEN el usuario interactúa con inputs y botón
- THEN los elementos conservan `min-h-[44px]` y `touch-manipulation` (sin regresión táctil por el restyle)

## Out of Scope

- **Logo de `Navbar.tsx:30`** (`text-indigo-600`): NO se modifica en esta entrega; deuda visual registrada para un cambio futuro de STYLE.md.
- **Radio de los botones del Navbar** (`rounded-md`): no se cambia (la propuesta solo fija colores Rausch).
- **Chrome en rutas de sucursal** (`/sucursal/*`): comportamiento existente (BottomNav oculto, Navbar visible según contexto) no se toca.
- **auth.branch.ts**: server action sin UI; no aplica restyle.