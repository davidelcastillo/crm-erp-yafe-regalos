# product-soft-delete — Delta (Modified)

## Delta

- **MODIFIED** "Toggle Product Active Status": la UI reemplaza el borrado físico por botones "Desactivar" (DeleteButton e InventarioCard) que llaman `toggleProductActive({ id, active: false })` con confirmación SweetAlert2.
- **MODIFIED** "Exclude Inactive Products from Selectors": `getProducts`/`getActiveProducts` filtran `active: true` y, con `branchId`, `inventory: { some: { branchId } }`.
- `deleteProduct` se mantiene exportado (compatibilidad de tests) pero deja de usarse en UI.

## MODIFIED Requirements

### Requirement: Toggle Product Active Status

La UI MUST proveer botones "Desactivar" (en productos e inventario) que invocan la Server Action `toggleProductActive({ id, active: false })` tras confirmación SweetAlert2. La reactivación SHALL también confirmarse con SweetAlert2.
(Previously: solo se definía la Server Action; la UI ejecutaba borrado físico.)

#### Scenario: Desactivar producto desde productos

- GIVEN un producto activo con id=5
- WHEN el admin pulsa "Desactivar" y confirma SweetAlert2
- THEN `toggleProductActive({ id: 5, active: false })` se ejecuta
- AND el producto queda con active=false
- AND los registros BranchInventory persisten sin cambios

#### Scenario: Desactivar desde inventario

- GIVEN un producto activo visible en `/inventario`
- WHEN el admin pulsa "Desactivar" y confirma
- THEN el producto deja de listarse en inventario activo

#### Scenario: Cancelar desactivación

- GIVEN el diálogo SweetAlert2 abierto
- WHEN el admin cancela
- THEN `toggleProductActive` NO se invoca
- AND el producto permanece activo

### Requirement: Exclude Inactive Products from Selectors

Todos los selectores de producto en compras, ventas, movimientos e inventario MUST excluir productos con active=false por defecto. `getProducts` y `getActiveProducts` MUST añadir `where: { active: true }`; si se pasa `branchId`, MUST filtrar además por `inventory: { some: { branchId } }`.
(Previously: la exclusión era solo conceptual en selectores; no había filtro active/branch en getProducts.)

#### Scenario: Selector oculta inactivos

- GIVEN Producto A (active=true) y Producto B (active=false)
- WHEN se abre un selector de producto en compras
- THEN solo A aparece

#### Scenario: getProducts con branchId excluye sin inventario

- GIVEN Producto C sin fila en BranchInventory de Sucursal 1
- WHEN `getProducts(branchId = S1)`
- THEN C NO aparece en el resultado

## Acceptance Criteria

- [ ] No hay botón de borrado físico en productos ni inventario; solo "Desactivar"
- [ ] `getProducts()` sin branchId excluye inactivos
- [ ] `getProducts(branchId)` excluye inactivos y productos sin fila BranchInventory en esa sucursal
- [ ] `deleteProduct` sigue exportado y sus tests pasan

## Notes

- Semántica del filtro por sucursal: presencia de fila en `BranchInventory`. Para exigir stock>0, cambiar la cláusula a `inventory: { some: { branchId, stock: { gt: 0 } } }`.
- `deleteProduct` se conserva solo para compatibilidad de tests; la UI no lo usa.
