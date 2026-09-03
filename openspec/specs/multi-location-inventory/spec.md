# Domain: multi-location-inventory — Delta

## Delta

La action `getProductsWithBranchStock` (src/app/actions/inventory.ts:206-258) deja de tratar `branchId` como un filtro decorativo. Hoy el filtro real de productos por sucursal está encerrado dentro de `if (opts.onlyWithStock)` (líneas 212-219) y `branchId` solo afecta al `include.inventory` (línea 239); la página nunca envía `onlyWithStock`, por lo que la sucursal nunca reduce la lista de productos. Este delta mueve el filtro de sucursal al `where` raíz, lo independiza de `onlyWithStock`, y mantiene el scoping del `include.inventory` para que las columnas por sucursal y el total por sucursal sigan siendo correctos. No se modifican los requisitos de tracking de stock ni la validación de stock de la spec base.

## Requirements

1. **Filtro de sucursal a nivel `where` (SHALL)** — Cuando `getProductsWithBranchStock` reciba `branchId`, la consulta SHALL filtrar productos a nivel `where` con `where.inventory = { some: { branchId } }`. El producto SHALL devolverse si tiene al menos una fila `BranchInventory` en esa sucursal, incluyendo filas con stock 0. Este filtro SHALL aplicarse independientemente de que `onlyWithStock` esté presente, ausente o sea `false`.

2. **`onlyWithStock` como toggle ortogonal (SHALL)** — Cuando `onlyWithStock` sea `true`, el filtro SHALL añadir `stock: { gt: 0 }` al predicado `some` del `where.inventory`, componiendo en AND con el `branchId` ya presente. `onlyWithStock` SHALL seguir siendo combinable con `branchId`, `categoryId` y `search`, y NO SHALL cambiar el comportamiento cuando `branchId` no está presente.

3. **Scoping del `include.inventory` por sucursal (SHALL)** — El `include.inventory` SHALL continuar filtrando por `branchId` cuando este se provea (`where: { branchId }` en el include), de modo que cada producto exponga únicamente la fila de inventario de la sucursal filtrada y `sumStock` / las columnas por sucursal reflejen solo esa sucursal. Cuando `branchId` sea `null`, el include SHALL conservar el comportamiento actual (todas las filas, ordenadas por `branchId` asc).

4. **Composición AND sin superposición (SHALL)** — `branchId`, `categoryId` y `search` SHALL componer en AND. El predicado de sucursal del `where` raíz SHALL coexistir con `categoryId`, con la búsqueda `OR` (nombre, código, descripción, categoría) y con `active` (cuando `activeOnly` no sea `false`), sin reemplazar ni anular ninguno de ellos.

5. **Contrato de salida sin cambios (SHALL)** — La firma de la action (`filters?: unknown`), el schema de entrada (`getProductsWithBranchStockSchema`) y el retorno `{ success, data }` con `parseArray(products)` SHALL permanecer intactos para no romper callers (page.tsx, InventarioList) ni los tests existentes.

## Scenarios

#### Scenario: Filtro AND combinado (branchId + categoryId + search)

- GIVEN la sucursal B1 con stock del producto "Cable HDMI" y "Leche", y la categoría "Electronics"
- WHEN se consulta `getProductsWithBranchStock({ branchId: 1, categoryId: 5, search: "cable" })`
- THEN solo se devuelven los productos que tienen fila de inventario en B1, pertenecen a la categoría 5 y coinciden con "cable"
- AND el producto "Leche" NO SHALL aparecer aunque tenga stock en B1

#### Scenario: Producto con stock 0 aparece filtrando por sucursal sin `onlyWithStock`

- GIVEN el producto X con stock 0 en B1 y stock 5 en B2
- WHEN se consulta `getProductsWithBranchStock({ branchId: 1 })` (sin `onlyWithStock`)
- THEN X SHALL devolverse
- AND su `include.inventory` SHALL contener solo la fila B1 con stock 0

#### Scenario: `onlyWithStock` excluye el producto con stock 0

- GIVEN el mismo producto X con stock 0 en B1
- WHEN se consulta `getProductsWithBranchStock({ branchId: 1, onlyWithStock: true })`
- THEN X SHALL ser excluido del resultado
- AND el producto Y con stock > 0 en B1 SHALL permanecer

#### Scenario: Scoping del include por sucursal

- GIVEN el producto P con filas de inventario en B1 (stock 7) y B2 (stock 3)
- WHEN se consulta `getProductsWithBranchStock({ branchId: 1 })`
- THEN el `include.inventory` de P SHALL contener únicamente la fila de B1
- AND el stock mostrado para P en la columna B1 SHALL ser 7, no 10

#### Scenario: Sin branchId conserva el comportamiento actual

- GIVEN productos con stock en B1 y B2
- WHEN se consulta `getProductsWithBranchStock({})`
- THEN todos los productos SHALL devolverse con todas sus filas de inventario
- AND el filtro de sucursal SHALL NOT aplicarse en el `where` raíz

## Out of Scope

- No se modifican las operaciones de mutación de stock (`moveStockBetweenBranches`, `assignStock`, `adjustStock`).
- No se cambia el modelo de datos (`BranchInventory`, `Branch`, `Product`) ni se crean migraciones Prisma.
- No se alteran los requisitos base "Per-Branch Stock Tracking", "Stock Validation on Operations" ni "Default Branch Seed".
- No se tocan las rutas del portal externo (`/sucursal/*`).