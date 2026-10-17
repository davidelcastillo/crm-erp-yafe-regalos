# inventory-ui — Delta (Modified)

## Delta

- **MODIFIED** "Inventory Page with Filters": filtros funcionales sin stale-closure (cada `onChange` envía el valor recién calculado); link "Ver inactivos" → `/inventario/inactivos`.
- **MODIFIED** "Move Stock Button" → "Move Stock Modal (3 pasos)": origen → producto (`getBranchInventory`) → cantidad + destino (`moveStockBetweenBranches`), validando cantidad ≤ stock.
- **ADDED** "Edit Inventory with Category": `CategorySelector` en edición (`updateProductExtended` con categoryId); stock con `adjustProductStock`.

## MODIFIED Requirements

### Requirement: Inventory Page with Filters

El sistema MUST renderizar `/inventario` (admin-only) con productos y su stock por sucursal. Los filtros (sucursal, categoría) SHALL aplicar el valor recién seleccionado en cada `onChange`, sin depender de estado interno desactualizado. La página SHALL incluir un link "Ver inactivos" a `/inventario/inactivos`.
(Previously: los filtros existían pero sufrían stale-closure — no filtraban.)

#### Scenario: Filtrar por sucursal filtra productos

- GIVEN productos con stock en S1 y S2
- WHEN el admin selecciona "S1" en el filtro de sucursal
- THEN la lista se re-filtra tomando S1 como rama activa
- AND productos sin fila en S1 quedan excluidos

#### Scenario: Filtrar por categoría

- GIVEN productos en categorías "Electronics" y "Food"
- WHEN el admin selecciona "Electronics"
- THEN solo los productos electrónicos se muestran

#### Scenario: Link a inactivos

- GIVEN el admin en `/inventario`
- THEN ve y puede pulsar "Ver inactivos" → `/inventario/inactivos`

### Requirement: Move Stock Modal (3 pasos)

El sistema MUST proveer `MoveStockModal` con flujo de 3 pasos: (1) seleccionar sucursal origen, (2) elegir producto vía `getBranchInventory(origen)` mostrando stock disponible, (3) cantidad + sucursal destino, confirmar con `moveStockBetweenBranches`. La cantidad SHALL validarse ≤ stock disponible antes del submit.
(Previously: el modal operaba con productId=0, sin cargar productos reales de la sucursal.)

#### Scenario: Mover stock con producto real

- GIVEN Producto A con stock 10 en S1
- WHEN el admin: origen S1 → producto A (stock 10) → cantidad 3 → destino S2 → confirmar
- THEN `moveStockBetweenBranches` mueve 3 unidades
- AND S1 queda con 7 y S2 con +3

#### Scenario: Cantidad mayor al stock bloqueada

- GIVEN Producto A con stock 2 en S1
- WHEN el admin intenta mover 5 unidades
- THEN el submit se bloquea con validación de stock

## ADDED Requirements

### Requirement: Edit Inventory with Category

La edición de un producto desde `/inventario` MUST incluir un `CategorySelector` que se guarda con `updateProductExtended` (categoryId). El ajuste de stock SHALL usar `adjustProductStock`.

#### Scenario: Cambiar categoría desde inventario

- GIVEN un producto con categoría "Electronics"
- WHEN el admin lo edita y selecciona "Food"
- THEN `updateProductExtended` persiste categoryId de Food

#### Scenario: Ajustar stock manualmente

- GIVEN un producto con stock 5 en S1
- WHEN el admin ajusta +2
- THEN `adjustProductStock` deja el stock en 7

## Acceptance Criteria

- [ ] Los filtros de sucursal/categoría re-filtran en cada cambio (sin closure obsoleto)
- [ ] MoveStockModal lista productos reales por origen y bloquea cantidad > stock
- [ ] Categoría editable y persistida desde inventario
- [ ] Link "Ver inactivos" funcional

## Notes

- `BranchSelector` se usa en modo controlado (`value`/`onChange`) en inventario para evitar doble fuente de verdad con BranchContext.
