# Domain: app-middleware — Delta

## Delta

**Capability modificada** — modifica el delta existente `openspec/specs/app-middleware/spec.md` (auth routes en `isExcluded`), el comportamiento actual de `src/proxy.ts` y `src/middleware/branch.ts`. Cambios: (1) `decideBranchAccess` pasa a ser **GET-only puro sin role/claim** — `BranchAccessInput` se simplifica a `{ pathname, method }`, se eliminan las reglas `role`/`claim` y el middleware puro no toca DB; (2) el proxy **deja pasar anónimos a `/sucursal/*`** sin redirect a `/login` ni cookie `redirect-to` (el check real de visibilidad vive en la action del catálogo); (3) `isPortalLoginPath` se elimina de `isExcluded` y del flujo (el módulo `src/lib/supabase/branch.ts` desaparece, ver delta removed `branch-portal-login`); (4) el admin gating de rutas internas se mantiene intacto; (5) se corrigen los comentarios desactualizados (líneas 32-34 y 70-72).

## Requirements

1. **`decideBranchAccess` puro sin role/claim (MUST)**: `src/middleware/branch.ts` SHALL eliminar las reglas `role`/`claim` (hoy líneas 33-39) y simplificar `BranchAccessInput` a `{ pathname: string; method: string }`. Las reglas resultantes SHALL evaluarse en orden: `method !== 'GET'` → deny `{ allowed: false, reason: 'method' }`; pathname sin match de `^/sucursal/(\d+)` → deny `{ allowed: false, reason: 'branch' }`; en caso contrario → `{ allowed: true }`. La función SHALL seguir libre de imports de `next/server` y de acceso a BD.
2. **GET allow para anónimo y cualquier rol (MUST)**: un GET a una ruta `/sucursal/<id>/...` bien formada SHALL ser `allowed: true` sin importar sesión ni rol (anónimo, admin, staff, branch_user residual).
3. **Método no-GET deny (MUST)**: `decideBranchAccess` SHALL retornar `{ allowed: false, reason: 'method' }` para cualquier `method !== 'GET'` (POST, PUT, DELETE, etc.), evaluado antes que el match de URL.
4. **URL malformada deny (MUST)**: pathnames que no matcheen `^/sucursal/(\d+)` (p. ej. `/sucursal/abc/inventory`, `/sucursal/`) SHALL retornar `{ allowed: false, reason: 'branch' }`.
5. **Proxy: anónimos pasan a `/sucursal/*` (MUST)**: en `src/proxy.ts`, cuando `!user` y `!isExcluded`, el sistema SHALL NOT redirigir a `/login` ni setear la cookie `redirect-to` si `pathname.startsWith('/sucursal/')` — el request continúa (`NextResponse.next`) y la visibilidad la decide la action del catálogo (delta `external-branch-catalog`).
6. **Proxy: bloque con sesión en `/sucursal/*` (MUST)**: con usuario autenticado, `/sucursal/*` SHALL pasar por `decideBranchAccess({ pathname, method: request.method })` **sin** `getUserRole`/`getUserBranchId` y **sin** la exclusión `isPortalLoginPath`; `!allowed` → redirect a `/unauthorized`. GET a `/sucursal/<id>/inventory` con sesión SHALL ser `allowed`.
7. **`isPortalLoginPath` eliminado (MUST)**: el sistema SHALL eliminar `isPortalLoginPath` de `isExcluded` (hoy línea 45), del import de `@/lib/supabase/branch` (línea 7) y del bloque `/sucursal/*` con sesión (línea 73). `isExcluded` SHALL conservar el resto: `/login`, `/unauthorized`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/_next/`, `/favicon.ico`, `/images/`, `/public/`.
8. **Admin gating de rutas internas intacto (MUST)**: sin sesión, las rutas internas (`/dashboard`, `/productos`, etc.) SHALL seguir redirigiendo a `/login` con cookie `redirect-to`; con sesión no-admin SHALL seguir redirigiendo a `/unauthorized`; con rol `admin` SHALL continuar.
9. **POST anónimo a páginas `/sucursal/*` (SHALL)**: el proxy SHALL NOT redirigir ni denegar el POST anónimo (no hay guard de método en el proxy para anónimos); el framework SHALL responder el 405 correspondiente (las páginas no exponen handlers no-GET), y `decideBranchAccess` SHALL negar el método en los tests unitarios.
10. **Comentarios corregidos (SHOULD)**: los comentarios de `src/proxy.ts` (líneas 32-34 "portal login path…" y 70-72 "GET-only + branch_user") SHALL actualizarse para reflejar: `/sucursal/*` público en GET, sin login de portal.

## Scenarios

#### Scenario: GET anónimo allow
- GIVEN `decideBranchAccess({ pathname: '/sucursal/39/inventory', method: 'GET' })`
- WHEN se evalúa la función pura
- THEN retorna `{ allowed: true }` (sin sesión, sin role)

#### Scenario: GET allow sin importar el rol
- GIVEN `decideBranchAccess({ pathname: '/sucursal/5/inventory', method: 'GET' })` con sesión de rol `admin`
- WHEN se evalúa la función pura
- THEN retorna `{ allowed: true }` (ya no existe la regla `role`)

#### Scenario: POST deny
- GIVEN `decideBranchAccess({ pathname: '/sucursal/5/inventory', method: 'POST' })`
- WHEN se evalúa la función pura
- THEN retorna `{ allowed: false, reason: 'method' }`

#### Scenario: URL malformada deny
- GIVEN `decideBranchAccess({ pathname: '/sucursal/abc/inventory', method: 'GET' })`
- WHEN se evalúa la función pura
- THEN retorna `{ allowed: false, reason: 'branch' }` (el regex `^/sucursal/(\d+)` no matchea)

#### Scenario: Anónimo en `/sucursal/39/inventory` sin redirect (proxy)
- GIVEN un request GET a `/sucursal/39/inventory` sin cookies de sesión
- WHEN el proxy evalúa `!user && !isExcluded`
- THEN NO se redirige a `/login`
- AND NO se setea la cookie `redirect-to` y el request continúa (`NextResponse.next`)

#### Scenario: POST anónimo a `/sucursal/*` sin redirect
- GIVEN un request POST a `/sucursal/39/inventory` sin sesión
- WHEN el proxy evalúa el request
- THEN NO se redirige a `/login` (la página no define handler POST → 405 del framework)

#### Scenario: Con sesión en `/sucursal/*` malformado → `/unauthorized`
- GIVEN un request GET a `/sucursal/abc/inventory` con sesión válida
- WHEN el proxy evalúa `decideBranchAccess`
- THEN se redirige a `/unauthorized`

#### Scenario: Rutas internas siguen protegidas
- GIVEN un request GET a `/dashboard` sin sesión
- WHEN el proxy evalúa `!user && !isExcluded`
- THEN se setea la cookie `redirect-to` con `/dashboard` y se redirige a `/login`

#### Scenario: No-admin sigue excluido de internas
- GIVEN un request GET a `/dashboard` con sesión de rol `staff`
- WHEN el proxy evalúa el gating de rol
- THEN se redirige a `/unauthorized`

## Out of Scope

- **Cambios al matcher** de `proxy.ts` (`config.matcher`): solo se modifica la lógica de decisión.
- **Rate limiting o anti-abuso** del portal público: no se implementa.
- **RLS / políticas de datos**: sin cambios en Postgres.
- **Código muerto residual** (`isAuthorizedForBranch`, `getUserBranchId` en `src/lib/supabase/auth.ts`): deuda documentada, fuera de alcance.
- **Login central admin** (`/login`, `src/actions/auth.ts`): intacto; el manejo residual de `branch_user` en su redirect se conserva (deuda no bloqueante).