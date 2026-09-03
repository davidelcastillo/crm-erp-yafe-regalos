# Domain: external-branch-catalog — Delta

## Delta

**Capability modificada** — no existe spec base en `openspec/specs/external-branch-catalog/spec.md`; el delta se define contra el comportamiento actual de `src/app/actions/inventory.external.ts` y `src/app/sucursal/[branchId]/inventory/page.tsx` (verificado en disco). Cambios: (1) el catálogo pasa de "pensado para branch_user" a **GET público condicionado**: solo sucursales `isPublic === true && isActive === true` exponen inventario; (2) fix obligatorio de un bug pre-existente — hoy se sirven sucursales inactivas y productos inactivos (la query no filtra `Branch.isActive` ni `Product.active`); (3) sucursal inexistente, no pública o inactiva devuelven **el mismo resultado** (`notFound`) para no filtrar existencia; (4) la página elimina el guard `getUserBranchId` y el comentario falso. La acción no distingue roles: el check `isPublic`/`isActive` aplica también a admins autenticados (cambio intencional).

## Requirements

1. **Check de visibilidad en la action (MUST)**: `getExternalBranchInventory` SHALL buscar la `Branch` por `branchId` y SHALL retornar `{ success: false }` si la sucursal no existe, `!isPublic` o `!isActive`. La página ya mapea `!success → notFound()`; no se debe crear una ruta de error distinta.
2. **Mismo resultado sin leak (MUST)**: para sucursal inexistente, no pública o inactiva, el resultado SHALL ser idéntico (`success: false` → `notFound`), sin mensajes ni códigos que distingan el motivo. El check SHALL aplicar a todos los roles (admin incluido).
3. **Filtro `Product.active` (MUST)**: la query de productos SHALL añadir `active: true` al `where` raíz, conservando `inventory.some({ branchId })`, el scoping del `include.inventory` por `branchId` y `orderBy: { name: 'asc' }`. Los productos inactivos con stock en la sucursal SHALL NOT aparecer.
4. **Contrato de salida (MUST)**: el catálogo SHALL exponer únicamente `{ code, name, stock, price }` por producto. El sistema SHALL NOT exponer `id`, `authUserId`, `email` ni cualquier otro dato sensible de la sucursal o del producto.
5. **Inventario vacío preservado (MUST)**: una sucursal pública y activa sin filas `BranchInventory` para sus productos SHALL retornar `{ success: true, data: [] }` (la página muestra "No hay productos…", **no** `notFound`). `branchId` no entero positivo (zod) SHALL retornar `success: false` → `notFound`.
6. **Página externa (MUST)**: `src/app/sucursal/[branchId]/inventory/page.tsx` SHALL eliminar el import y el guard de `getUserBranchId` (líneas 3, 24-31) y SHALL corregir el comentario falso de la línea 28 ("admins pueden ver cualquier sucursal" — falso: el middleware niega admins). SHALL mantener `notFound()` para `branchId` NaN y `!success`, y `export const dynamic = 'force-dynamic'`.

## Scenarios

#### Scenario: Anónimo ve el catálogo de una sucursal pública y activa
- GIVEN una Branch con `isPublic = true`, `isActive = true` y productos activos con stock
- WHEN un usuario anónimo hace GET a `/sucursal/<id>/inventory`
- THEN la página SHALL renderizar el catálogo con `code, name, stock, price` por producto, ordenado por nombre
- AND no se requiere sesión ni redirect a `/login`

#### Scenario: Sucursal no pública → notFound
- GIVEN una Branch con `isPublic = false` y `isActive = true`
- WHEN se solicita `/sucursal/<id>/inventory` (anónimo o autenticado)
- THEN la action SHALL retornar `{ success: false }` y la página SHALL devolver `notFound()`

#### Scenario: Sucursal inactiva → notFound
- GIVEN una Branch con `isPublic = true` e `isActive = false`
- WHEN se solicita `/sucursal/<id>/inventory`
- THEN la action SHALL retornar `{ success: false }` y la página SHALL devolver `notFound()` (idéntico al caso no-pública)

#### Scenario: Sucursal inexistente → notFound
- GIVEN un `branchId` sin Branch asociada
- WHEN se solicita `/sucursal/<id>/inventory`
- THEN la action SHALL retornar `{ success: false }` y la página SHALL devolver `notFound()` (mismo resultado que los dos casos anteriores — sin leak de existencia)

#### Scenario: Productos inactivos excluidos
- GIVEN una sucursal pública y activa con el producto A (activo, stock 5) y el producto B (inactivo, stock 8)
- WHEN se solicita el catálogo
- THEN solo A SHALL aparecer
- AND B SHALL NOT aparecer aunque tenga stock

#### Scenario: Admin autenticado en sucursal no pública
- GIVEN una Branch no pública y un admin con sesión válida
- WHEN se solicita `/sucursal/<id>/inventory`
- THEN la action SHALL retornar `{ success: false }` (el check `isPublic`/`isActive` no distingue roles)
- AND la página SHALL devolver `notFound()`

#### Scenario: Branch pública sin inventario
- GIVEN una sucursal pública y activa sin productos con fila de inventario
- WHEN se solicita el catálogo
- THEN la action SHALL retornar `{ success: true, data: [] }`
- AND la página SHALL renderizar el estado vacío ("No hay productos…") sin 404

## Out of Scope

- **Catalog management** (CRUD del catálogo) y **paginación**: no se tocan.
- **Otras rutas bajo `/sucursal/*`**: solo se modifica `inventory`.
- **RLS en Supabase**: pendiente de seguridad independiente.
- **Rate limiting / anti-abuso** del endpoint público: no se implementa.