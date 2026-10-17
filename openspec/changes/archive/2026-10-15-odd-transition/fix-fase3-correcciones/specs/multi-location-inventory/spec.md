# multi-location-inventory — Delta (Modified)

## Delta

- **ADDED** "Branch Inventory Query": nueva Server Action `getBranchInventory(branchId)` que devuelve `[{ productId, nombre, stock }]` para la sucursal; `getProducts(branchId)` filtra por presencia de fila en `BranchInventory`.
- Requerimientos existentes (Per-Branch Stock Tracking, Stock Validation on Operations, Default Branch Seed) sin cambios.

## ADDED Requirements

### Requirement: Branch Inventory Query

El sistema MUST proveer la Server Action `getBranchInventory(branchId)` que devuelve una lista `{ productId, nombre, stock }` de productos con fila en `BranchInventory` de la sucursal, con su stock disponible. `getProducts(branchId)` MUST filtrar por `inventory: { some: { branchId } }` (semántica de presencia de fila).

#### Scenario: Listar inventario de sucursal

- GIVEN Producto A con stock 10 en S1 y Producto B sin fila en S1
- WHEN `getBranchInventory(S1)`
- THEN devuelve A con stock=10
- AND NO incluye B

#### Scenario: getProducts filtra por sucursal

- GIVEN Producto A con fila en S1 y Producto C con fila solo en S2
- WHEN `getProducts(branchId = S1)`
- THEN solo A aparece

## Acceptance Criteria

- [ ] `getBranchInventory(branchId)` devuelve `{productId, nombre, stock}` con stock real
- [ ] `getProducts(branchId)` excluye productos sin fila BranchInventory en esa sucursal
- [ ] Sin `branchId`, `getProducts` NO aplica el filtro de sucursal

## Notes

- Presencia de fila vs stock>0: si se desea listar solo cuando stock>0, cambiar la cláusula `where` a `inventory: { some: { branchId, stock: { gt: 0 } } }` (decisión de configuración, cambio trivial).
