# Design: Correcciones UI Fase 3 (fix-fase3-correcciones)

## Technical Approach

Wiring/UI-only, sin esquema ni cambios de contrato en acciones core. Verificado contra código: `registerSale` exige `branchId` (sale.ts:19-21); `moveStockBetweenBranches`, `adjustProductStock`, `toggleProductActive`, `updateProductExtended`, `createPurchaseWithBranchSplit` ya existen intactos. Única action nueva: `getBranchInventory`. Tracks del proposal: A navegación, B soft-delete+filtros, C filtros y modales.

## Architecture Decisions

| # | Opción | Tradeoff | Decisión |
|---|--------|----------|----------|
| D1 | Filtro sucursal: presencia vs stock>0 | presencia incluye stock 0 | `inventory: { some: { branchId } }`; swap a `{ branchId, stock: { gt: 0 } }` trivial |
| D2 | searchProducts | spec nombra getProducts/getActiveProducts; selectores también deben excluir inactivos | añadir `active: true` al `where` |
| D3 | Ubicación getBranchInventory | branch.ts vs product.ts | `branch.ts` (scope sucursal) |
| D4 | InventoryFilters | estado interno vs controlado | **controlado** (sin useState): cada onChange computa y emite el valor nuevo → mata stale-closure y doble fuente |
| D5 | Sucursal en inventario page | uncontrolled escribe BranchContext | controlado `value={branchId}` `onChange={setBranchId}` |
| D6 | MoveStockModal | prop productId (hoy 0) vs selección por paso | eliminar `productId`; producto elegido en paso 2 vía `getBranchInventory` |
| D7 | Venta: fuente de sucursal | context vs estado local | estado local `selectedBranchId` sembrado desde context; BranchSelector controlado |
| D8 | Compras: split grid | proposal: solo guard; spec re-exige grid (base) | cubrir ambos: guard `!ready` + grid con suma validada (ver Q1) |
| D9 | BottomNavMasMenu.tsx | muerto vs borrar | borrar (git preserva historial) |
| D10 | deleteProduct | romper tests vs mantener | mantener exportado, sin uso en UI |

## Data Flow

```
Venta:  BranchSelector(value,onChange) → selectedBranchId → registerSale({branchId})
        └─ acota ProductSearch(branchId) → searchProducts({query, branchId})
Stock:  MoveStockModal paso1 origen → useBranchInventory(origen) → getBranchInventory
        → item {productId,nombre,stock} → paso3 qty≤stock → moveStockBetweenBranches
Compra: !ready → "Cargando..." ; split grid: sumaSplits vs qty línea → createPurchaseWithBranchSplit
SoftDel:"Desactivar" → Swal confirm → toggleProductActive({id,active:false}) → revalidatePath 3 rutas
```

## app-navigation

- **BottomNav.tsx**: añadir `{ href:"/sucursales", label:"Sucursales", icon:BranchesIcon }` (SVG storefront nuevo) a `navItems` → 7 ítems. Eliminar botón "Más", estado `isOverflowOpen` e import/uso de `MasMenu`. Sin cambios de props.
- **BottomNav.test.ts**: assert 7 links; `queryByRole("button",{name:/más/i})` nulo; eliminar test de menú overflow.
- **inventario/page.tsx**: link "Ver inactivos" → `/inventario/inactivos` (header).
- Cache: N/A (navegación). E2E: tap "Sucursales".

## product-soft-delete

- **DeleteButton.tsx**: "Eliminar"→"Desactivar". Props `{ productId }` igual. Click → Swal confirm ("¿Desactivar producto?") → `toggleProductActive({ id: productId, active: false })` → ok: `router.refresh()`; error: Swal con `result.error`. Estado `pending` deshabilita botón.
- **InventarioCard.tsx**: `handleDelete` → toggleProductActive + Swal + reload. Edición: estado `localCategoryId` (init `product.categoryId ?? null`); `handleSave` usa `updateProductExtended({ id, name, description, price, categoryId })`.
- **actions/product.ts**: `getProducts` → `where: { active: true, ...(branchId ? { inventory: { some: { branchId } } } : {}) }` (hoy sin `where`). `getActiveProducts` → mover `inventory: { some: { branchId } }` al `where` (hoy solo filtra include). `searchProducts` → `where: { active: true, OR: [...] }`. `deleteProduct` intacto.
- Errores: actions devuelven `{success:false,error}`; Swal lo muestra.

## multi-location-inventory

- **Nueva action** en `branch.ts`: `getBranchInventory(branchId: number)` → `prisma.branchInventory.findMany({ where: { branchId, product: { active: true } }, include: { product: { select: { id, name } } }, orderBy: { product: { name: "asc" } } })` mapeado a `{ productId, nombre, stock }`. Read-only (sin revalidatePath). Errores: try/catch → "Error al obtener el inventario de la sucursal".
- **Nuevo hook** `src/hooks/useBranchInventory.ts`: `useBranchInventory(branchId: number | null)` → `{ products, loading, error, reload }`; efecto re-dispara al cambiar branchId; flag de cancelación.

## inventory-ui

- **InventoryFilters.tsx**: quitar `useState`; selects leen props; cada `onChange` computa `next = val === "" ? null : Number(val)` y llama `onFilterChange(nextBranchId, nextCategoryId)`. Contrato de props sin cambio.
- **inventario/page.tsx**: `BranchSelector value={branchId} onChange={setBranchId}`; `loadProducts` pasa `activeOnly: true` a `getProductsWithBranchStock` (rama filtros) para consistencia con getProducts; quitar estado `moveStockProductId`.
- **MoveStockModal.tsx**: props `{ open, onClose, branches, onConfirm }`. Estado: `step(1|2|3)`, `sourceBranchId`, `selectedProduct`, `destBranchId`, `quantity`, `pending`, `error`. Paso1 origen → paso2 `useBranchInventory` (spinner "Cargando productos..."; vacío → "Sin productos en esta sucursal") → paso3 cantidad+destino; validar `qty ≤ selectedProduct.stock` y origen≠destino antes de submit → `moveStockBetweenBranches({ productId, sourceBranchId, destBranchId, quantity, performedBy: "admin" })` → ok: `onConfirm()` recarga lista; error inline/Swal. Botón "Moviendo...".
- **InventarioCard.tsx**: `CategorySelector` en edición; stock con `adjustProductStock` (delta, solo si branchId activo).
- Cache (ya existente): `adjustProductStock` → /inventario,/compras,/ventas,/productos; `moveStockBetweenBranches` → /inventario,/movimientos; `updateProductExtended` → /productos,/productos/[id],/inventario,/inventario/inactivos.

## sale-with-branch

- **AddSaleButton.tsx**: estado local `selectedBranchId` sembrado desde `useBranch().branchId` (effect al `ready`). Paso 1 obligatorio en modal: `<BranchSelector value={selectedBranchId} onChange={setSelectedBranchId} hideAllOption label="Sucursal de venta" />` (controlado; no escribe BranchContext). Gates: `addItem`, `openProductSearch`, `handleSubmit` → si `!selectedBranchId`: Swal "Debe seleccionar una sucursal", return. `registerSale({ ...items, branchId: selectedBranchId, ... })`; `ProductSearch branchId={selectedBranchId}` acota búsqueda+stock. Loading "Registrando...".
- Cache: `registerSale` ya revalida /ventas,/inventario,/clientes + `router.refresh()`.

## purchase-with-branch-split

- **AddPurchaseButton.tsx**: (1) guard: `if (!ready)` el modal muestra "Cargando sucursales..." sin selects de sucursal. (2) Split grid por línea: al elegir producto, `branches.map` con input de cantidad por sucursal + total acumulado; estado `lineSplits: Record<itemId, Record<branchId, qty>>`. Validación client: suma > qty línea → bloquear submit + "La suma supera el total"; suma < qty → "La suma debe cubrir el total". Submit arma `items` (una entrada por split) → `createPurchaseWithBranchSplit` (contrato intacto).
- Cache: action ya revalida /compras,/inventario,/movimientos + `router.refresh()`.

## File Changes

| Archivo | Acción | Cambio |
|---|---|---|
| src/components/BottomNav.tsx | Modify | 7 navItems; sin "Más" |
| src/components/BottomNavMasMenu.tsx | Delete | código muerto |
| src/components/BottomNav.test.ts | Modify | 7 links, sin botón Más |
| src/app/actions/product.ts | Modify | filtros active+branch en getProducts/getActiveProducts/searchProducts |
| src/app/actions/branch.ts | Modify | nueva getBranchInventory |
| src/hooks/useBranchInventory.ts | Create | hook de carga por sucursal |
| src/app/productos/components/DeleteButton.tsx | Modify | Desactivar + Swal + toggleProductActive |
| src/app/inventario/components/InventoryFilters.tsx | Modify | controlado, sin stale-closure |
| src/app/inventario/components/InventarioCard.tsx | Modify | Desactivar + CategorySelector + updateProductExtended |
| src/app/inventario/components/MoveStockModal.tsx | Modify | 3 pasos, sin productId, valida stock |
| src/app/inventario/page.tsx | Modify | link inactivos, BranchSelector controlado, activeOnly |
| src/app/ventas/components/AddSaleButton.tsx | Modify | BranchSelector paso 1 + gates |
| src/app/compras/components/AddPurchaseButton.tsx | Modify | guard !ready + split grid |

## Testing Strategy

| Capa | Qué | Cómo |
|---|---|---|
| Unit | BottomNav 7 links/sin Más | RTL (test actualizado) |
| Unit | Filtros active/branch en actions | mocks prisma (product.test.ts, branch.test.ts) |
| Unit | InventoryFilters sin stale-closure | RTL: onChange emite valor recién seleccionado |
| Unit | MoveStockModal qty>stock bloqueado | RTL: submit bloqueado |
| Unit | AddSaleButton sin sucursal | RTL: agregar/confirmar bloqueado |
| Unit | AddPurchaseButton guard + split sum | ampliar AddPurchaseButton.test.tsx |
| E2E | Sucursales en un tap; venta con sucursal; mover stock | Playwright móvil |

## Threat Matrix

N/A — sin routing de red/shell, subprocesos, VCS/PR automation ni clasificación de ejecutables; solo enrutado interno Next.js.

## Migration / Rollout

No migration. Rollback por archivo (tracks independientes); quitar cláusulas `where` nuevas revierte las actions.

## Open Questions

- [ ] Q1: alcance del split grid en compras — proposal lo deja fuera ("se mantiene split por línea") pero el spec re-exige grid con validación de suma; se diseñó para cumplir spec, confirmar en sdd-tasks.
- [ ] Q2: `performedBy: "admin"` hardcodeado en moveStockBetweenBranches (pre-existente) — fuera de scope.

## Acceptance Verification

- app-navigation: 7 links + sin "Más" (test), link inactivos ✓
- product-soft-delete: solo "Desactivar", `getProducts(branchId)` excluye inactivos y sin fila, deleteProduct exportado ✓
- multi-location-inventory: getBranchInventory real, filtro presencia, sin branchId sin filtro ✓
- inventory-ui: filtros sin closure, modal 3 pasos con stock real, categoría editable, link inactivos ✓
- sale-with-branch: imposible vender sin sucursal, BranchSelector controlado, branchId en registerSale ✓
- purchase-with-branch-split: guard "Cargando...", grid con suma validada, action intacta ✓
