# Proposal: Correcciones UI Fase 3 — Navegación, Soft-delete y Modales Funcionales

## Intent

Resolver los 10 puntos de usabilidad reportados tras la Fase 3: filtros que no filtran, eliminación física en vez de soft-delete, modal de venta sin selector de sucursal, MoveStockModal sin selector de producto (productId siempre 0), sucursales escondidas en el menú "Más", sin link a `/inventario/inactivos`, edición de inventario sin categoría, y selector de sucursal por línea de compra sin cargar. Todo el soporte de datos ya existe (`Product.active`, `Category`, `BranchInventory`, `toggleProductActive`, `updateProductExtended`, `adjustProductStock`, `moveStockBetweenBranches`) — el trabajo es de wiring y UI, no de esquema.

## Scope

### In Scope
- BottomNav: Sucursales como ítem normal (fuera de "Más"); icono de ventas se mantiene (signo de dólar con círculo).
- Soft-delete: botones "Desactivar" con `toggleProductActive` + SweetAlert2 en productos e inventario.
- Filtros: `getProducts` filtra por sucursal (`inventory: { some: { branchId } }`) y por `active: true`; `InventoryFilters` sin stale-closure.
- Venta: `BranchSelector` controlado obligatorio en `AddSaleButton`; sucursal pasada a `registerSale`.
- MoveStockModal: flujo 3 pasos origen → producto (`getBranchInventory`) → destino (`moveStockBetweenBranches`).
- Inventario: edición con `CategorySelector` (`updateProductExtended`) + ajuste de stock (`adjustProductStock`).
- Inventario page: link a `/inventario/inactivos`.
- Compras: garantizar que `useBranch().branches` esté poblado antes de renderizar el selector por línea.

### Out of Scope
- Cambio del icono de ventas (decisión: mantener el actual).
- Selector global de sucursal en compras (se mantiene split por línea).
- Wizard de venta multi-paso del change anterior `fix-fase3-ui` (se descarta; AddSaleButton sigue activo).
- Migraciones de esquema (ninguna necesaria).

## Capabilities

> Contrato con sdd-spec. Investigado en `openspec/specs/`.

### New Capabilities
- `app-navigation`: Sucursales como ítem primario del BottomNav; link a `/inventario/inactivos`; icono de ventas estable (dólar con círculo).

### Modified Capabilities
- `product-soft-delete`: "Desactivar" reemplaza el borrado físico en UI (usa `toggleProductActive`); `getProducts`/`getActiveProducts` filtran `active: true`.
- `multi-location-inventory`: `getProducts(branchId)` filtra por presencia en `BranchInventory`; nueva server action `getBranchInventory(branchId)` (devuelve `{productId, nombre, stock}`).
- `inventory-ui`: filtros funcionales, MoveStockModal 3 pasos, edición con categoría, link a inactivos.
- `sale-with-branch`: selector de sucursal controlado obligatorio en el modal de venta.
- `purchase-with-branch-split`: carga garantizada de sucursales en el selector por línea.

## Approach

### Track A — Navegación
- Mover "Sucursales" de `overflowItems` a `navItems` en `BottomNav.tsx`; actualizar `BottomNav.test.ts` (7 links, sin botón "Más").
- Agregar link "Ver inactivos" en `inventario/page.tsx` → `/inventario/inactivos`.

### Track B — Soft-delete y filtros activos
- `DeleteButton.tsx` y `InventarioCard.tsx`: renombrar a "Desactivar", SweetAlert2 de confirmación, llamar `toggleProductActive({ id, active: false })`.
- `getProducts` y `getActiveProducts`: añadir `where: { active: true }` y, si `branchId`, `inventory: { some: { branchId } }` (semántica: presencia de fila; ajustable a `stock: { gt: 0 }`).
- Mantener `deleteProduct` exportado para compatibilidad de tests, sin uso en UI.

### Track C — Filtros y modales
- `InventoryFilters.tsx`: eliminar `handleChange()` stale-closure; cada `onChange` envía el valor recién calculado (branches/categorías, no depender de estado interno).
- `AddSaleButton.tsx`: `BranchSelector` controlado (`value`/`onChange`) como paso 1 obligatorio; usar esa sucursal en `registerSale` y `ProductSearch`.
- Nueva `getBranchInventory(branchId)` en `actions/branch.ts` (o `product.ts`): lista `{productId, nombre, stock}` para la sucursal.
- `MoveStockModal.tsx`: 3 pasos — (1) origen, (2) productos vía `getBranchInventory` con stock disponible, (3) cantidad + destino, confirmar con `moveStockBetweenBranches` (guardar stock actual en el item para validar cantidad).
- `InventarioCard.tsx`: añadir `CategorySelector` en edición, guardar con `updateProductExtended` (categoryId); mantener `adjustProductStock` para stock.
- `AddPurchaseButton.tsx`: guard `if (!ready) return <Cargando.../>` antes de renderizar los selects de sucursal por línea.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/BottomNav.tsx` | Modified | Sucursales como ítem normal; sin overflow |
| `src/components/BottomNav.test.ts` | Modified | 7 links, sin "Más" |
| `src/app/actions/product.ts` | Modified | Filtro branch+active en getProducts; exportar getBranchInventory |
| `src/app/actions/branch.ts` | Modified | getBranchInventory (nueva) |
| `src/app/productos/components/DeleteButton.tsx` | Modified | "Desactivar" + SweetAlert2 |
| `src/app/inventario/components/InventoryFilters.tsx` | Modified | Sin stale-closure |
| `src/app/inventario/components/InventarioCard.tsx` | Modified | Desactivar + CategorySelector + stock |
| `src/app/inventario/components/MoveStockModal.tsx` | Modified | Flujo 3 pasos con producto |
| `src/app/inventario/page.tsx` | Modified | Link a inactivos |
| `src/app/ventas/components/AddSaleButton.tsx` | Modified | BranchSelector obligatorio |
| `src/app/compras/components/AddPurchaseButton.tsx` | Modified | Guard de carga de sucursales |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Semántica filtro por sucursal (presencia vs stock>0) | Med | Decisión de configuración: usar `inventory: { some: { branchId } }`; cambiar cláusula `where` es trivial |
| Tests de `deleteProduct` físico siguen existiendo | Med | Mantener `deleteProduct` sin uso en UI; tests pasan igual |
| Doble fuente de verdad de sucursal (BranchContext + filtro local) | Med | Usar modo controlado (`value`/`onChange`) de BranchSelector en cada página |
| MoveStockModal sin stock disponible del item | Med | `getBranchInventory` devuelve stock; validar cantidad ≤ stock antes de submit |

## Rollback Plan

- UI por archivo: revertir el componente específico (sin dependencias entre tracks).
- Server actions: `getProducts` conserva firma; quitar cláusulas `where` nuevas para volver al comportamiento previo.
- No hay migraciones; rollback es revertir commits de UI/actions.

## Dependencies

- Existentes: `toggleProductActive`, `getActiveProducts`, `getInactiveProducts`, `updateProductExtended`, `adjustProductStock`, `moveStockBetweenBranches`, `getProductsWithBranchStock`, `BranchSelector` (modo controlado ya implementado), `CategorySelector`.
- Nueva: `getBranchInventory(branchId)`.

## Success Criteria

- [ ] Sucursales visibles como ítem primario del BottomNav; sin botón "Más" (test actualizado).
- [ ] Link a `/inventario/inactivos` presente en inventario.
- [ ] "Desactivar" en productos e inventario usa `toggleProductActive` con confirmación; el producto aparece en inactivos.
- [ ] `getProducts`/selectores excluyen inactivos y productos sin inventario en la sucursal seleccionada.
- [ ] Venta imposible sin sucursal seleccionada en el modal.
- [ ] MoveStockModal permite elegir producto real por sucursal y valida stock.
- [ ] Categoría editable desde inventario; stock ajustable.
- [ ] Selector de sucursal por línea en compras muestra sucursales cargadas.
- [ ] Tests unitarios (BottomNav, productos, inventario) en verde.
