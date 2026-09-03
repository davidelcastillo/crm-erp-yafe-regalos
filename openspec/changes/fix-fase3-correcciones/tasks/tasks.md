# Tasks: Correcciones UI Fase 3 (fix-fase3-correcciones)

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas estimadas | ~900–1100 (add+del) |
| Riesgo presupuesto 400 | Alto |
| Chained PRs recomendados | Sí |
| Split sugerido | PR 1 → PR 5 (por capacidad) |
| Delivery strategy | ask-on-risk (default) |
| Chain strategy | pending (decisión de equipo) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

**Q1 (design) resuelto**: se mantiene split por línea (selector de sucursal por línea) + validación de suma vs total; NO se implementa grid completo.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|----|----------------------|-----------------|-------------------|
| 1 | Navegación 7 ítems, sin Más, link inactivos | PR 1 | `npx jest src/components/BottomNav.test.ts` | E2E móvil: tap "Sucursales" | revert BottomNav.tsx/test + link page; MasMenu recuperable de git |
| 2 | Soft-delete + filtros active/branch | PR 2 | `npx jest src/app/actions/product.test.ts src/app/productos/components/ProductForm.test.tsx` | Manual: desactivar producto → desaparece de listas activas | revert botones; quitar cláusulas `where` nuevas |
| 3 | getBranchInventory + hook + modal 3 pasos | PR 3 | `npx jest src/app/actions/branch.test.ts` | Manual: mover stock entre sucursales | revert branch.ts / hook / MoveStockModal |
| 4 | Filtros controlados + página + card | PR 4 | `npx jest src/app/actions/inventory.test.ts` (+ InventoryFilters.test) | Manual: cambiar sucursal/categoría → refresco | revert InventoryFilters / page / InventarioCard |
| 5 | Venta con sucursal + split compras | PR 5 | `npx jest src/app/actions/sale.branch.test.ts src/app/compras/components/AddPurchaseButton.test.tsx` | Manual: vender sin sucursal → bloqueado | revert AddSaleButton / AddPurchaseButton |

## Phase 1: Fundación — acciones y data layer

**1.1 `src/app/actions/branch.ts` — nueva action `getBranchInventory`**
Desc: exportar `getBranchInventory(branchId: number)` (y su tipo): `prisma.branchInventory.findMany({ where: { branchId, product: { active: true } }, include: { product: { select: { id, name } } }, orderBy: { product: { name: "asc" } } })` mapeado a `{ productId, name, stock }`. try/catch → `{ success: false, error: "Error al obtener el inventario de la sucursal" }`. Read-only, sin revalidatePath.
AC: array ordenado por nombre; excluye productos inactivos; error controlado.
Riesgos: el diseño prevé clave `nombre`; consolidar `name` en sdd-apply y en MoveStockModal.
Deps: —.

**1.2 `src/app/actions/product.ts` — filtros active/branch**
Desc: `getProducts` → `where: { active: true, ...(branchId ? { inventory: { some: { branchId } } } : {}) }`; `getActiveProducts` → mover `inventory: { some: { branchId } }` al `where`; `searchProducts` → `where: { active: true, OR: [...] }`. `deleteProduct` intacto.
AC: con branchId excluye inactivos y productos sin fila; sin branchId no filtra por sucursal; `deleteProduct` sigue exportado.
Riesgos: —.
Deps: —.

**1.3 `src/hooks/useBranchInventory.ts` — hook de carga**
Desc: crear `useBranchInventory(branchId: number | null)` → `{ products, loading, error, reload }`; efecto re-dispara al cambiar branchId; flag de cancelación.
AC: `products: { productId, name, stock }[]`; loading true durante fetch; reload re-ejecuta.
Riesgos: ubicación `src/hooks/` (convención repo: `useAuth.ts`), no `src/lib/hooks/`.
Deps: 1.1.

## Phase 2: Core UI

**2.1 `src/components/BottomNav.tsx` — 7 navItems sin "Más"**
Desc: añadir `{ href: "/sucursales", label: "Sucursales", icon: BranchesIcon }` (SVG nuevo) a `navItems`; eliminar botón "Más", estado `isOverflowOpen` e import/uso de `BottomNavMasMenu`. Props intactas.
AC: 7 enlaces; sin botón "Más".
Riesgos: cache N/A (navegación).
Deps: —.

**2.2 `src/components/BottomNavMasMenu.tsx` — borrar**
Desc: eliminar archivo (código muerto; git preserva historial).
AC: archivo no existe; ninguna referencia restante (test/doc).
Riesgos: —.
Deps: 2.1.

**2.3 `src/app/inventario/page.tsx` — link "Ver inactivos"**
Desc: enlace en header → `/inventario/inactivos`.
AC: navegación funcional.
Riesgos: —.
Deps: —.

**2.4 `src/app/productos/components/DeleteButton.tsx` — "Desactivar" + Swal**
Desc: label "Eliminar"→"Desactivar"; click → Swal confirm ("¿Desactivar producto?") con cancelar → `toggleProductActive({ id: productId, active: false })`; ok → `router.refresh()`; error → Swal con `result.error`; estado `pending` deshabilita botón.
AC: cancelar no muta; desactiva vía acción; error visible.
Riesgos: —.
Deps: 1.2.

**2.5 `src/app/inventario/components/InventarioCard.tsx` — desactivar + edición**
Desc: `handleDelete` → toggleProductActive + Swal + reload; edición: `localCategoryId` (init `product.categoryId ?? null`), `handleSave` → `updateProductExtended({ id, name, description, price, categoryId })` con `CategorySelector` existente; stock → `adjustProductStock({ id, delta })` con delta ±, validando stock ≥ 0 (solo si branchId activo).
AC: solo "Desactivar" visible; categoría editable y guardada; delta negativo que daría stock < 0 → validación mostrada.
Riesgos: —.
Deps: 1.2.

**2.6 `src/app/inventario/components/MoveStockModal.tsx` — 3 pasos sin productId**
Desc: props `{ open, onClose, branches, onConfirm }`; pasos 1 origen → 2 producto vía `useBranchInventory` (spinner "Cargando productos..." / vacío "Sin productos en esta sucursal") → 3 cantidad+destino; validar `qty ≤ selectedProduct.stock` y origen≠destino; submit `moveStockBetweenBranches({ productId, sourceBranchId, destBranchId, quantity, performedBy: "admin" })`; ok → `onConfirm()` recarga lista; error inline/Swal; botón "Moviendo...".
AC: sin origen no avanza; qty>stock bloqueado; origen≠destino exigido.
Riesgos: `performedBy: "admin"` hardcodeado pre-existente (Q2, fuera de scope).
Deps: 1.1, 1.3.

**2.7 `src/app/inventario/components/InventoryFilters.tsx` — controlado, sin stale-closure**
Desc: quitar `useState`; selects leen props; cada onChange → `next = val === "" ? null : Number(val)` → `onFilterChange(nextBranchId, nextCategoryId)`. Contrato de props intacto.
AC: onChange emite el valor recién seleccionado; sin estado interno.
Riesgos: —.
Deps: —.

**2.8 `src/app/inventario/page.tsx` — BranchSelector controlado**
Desc: `BranchSelector value={branchId} onChange={setBranchId}` (mismo patrón categoría si existe); `loadProducts` pasa `activeOnly: true` (rama filtros); quitar estado `moveStockProductId`.
AC: cambiar sucursal/categoría re-dispara carga (getProductsWithBranchStock) y refresca UI.
Riesgos: —.
Deps: 2.7.

**2.9 `src/app/ventas/components/AddSaleButton.tsx` — sucursal obligatoria**
Desc: estado `selectedBranchId` sembrado desde `useBranch().branchId` (effect al ready); paso 0: `<BranchSelector value={selectedBranchId} onChange={setSelectedBranchId} hideAllOption label="Sucursal de venta" />` controlado (no escribe BranchContext); gates en `addItem`/`openProductSearch`/`handleSubmit` → Swal "Debe seleccionar una sucursal"; `registerSale({ ...items, branchId: selectedBranchId })`; `ProductSearch branchId={selectedBranchId}` acota; loading "Registrando...".
AC: imposible agregar productos o confirmar sin sucursal; `registerSale` recibe branchId del paso 0.
Riesgos: —.
Deps: —.

**2.10 `src/app/compras/components/AddPurchaseButton.tsx` — guard + split suma**
Desc: guard `if (!ready)` → "Cargando sucursales..." sin selects de sucursal; mantener split por línea (selector por línea vía `useBranch().branches`); validación client: suma líneas > total → "La suma supera el total" (bloquea submit); suma < total → "La suma debe cubrir el total"; submit arma items (una entrada por split) → `createPurchaseWithBranchSplit` (contrato intacto).
AC: sin sucursales cargadas no se renderizan selects; suma validada; action intacta.
Riesgos: Q1 resuelto (split por línea, sin grid completo).
Deps: —.

## Phase 3: Tests

- [ ] 3.1 `src/components/BottomNav.test.ts`: assert 7 links; `queryByRole("button", { name: /más/i })` nulo; eliminar test overflow.
- [ ] 3.2 `src/app/actions/product.test.ts` (ampliar/`product.fase3.test.ts`): mocks prisma — getProducts con/sin branchId excluye inactivos y sin fila; searchProducts solo activos; deleteProduct exportado.
- [ ] 3.3 `src/app/actions/branch.test.ts`: getBranchInventory ordena por nombre, solo activos, error → `{ success: false }`.
- [ ] 3.4 Test `useBranchInventory` (loading/error/reload) + crear test InventoryFilters: onChange emite valor recién seleccionado.
- [ ] 3.5 Crear test MoveStockModal: qty>stock bloquea submit; origen=destino bloqueado; pasos 1→3.
- [ ] 3.6 Test AddSaleButton: agregar/confirmar sin sucursal → bloqueado + Swal; actualizar o eliminar tests obsoletos.
- [ ] 3.7 `src/app/compras/components/AddPurchaseButton.test.tsx`: ampliar guard !ready + split suma (actualizar mocks por loading).
- [ ] 3.8 `src/app/productos/components/ProductForm.test.tsx` (cubre DeleteButton): mockear `Swal.fire` (confirm true/false y error).

## Phase 4: Cross-cutting y cleanup

- [ ] 4.1 Verificar `revalidatePath` en mutaciones: toggleProductActive (/productos,/inventario,/inventario/inactivos), adjustProductStock (/inventario,/compras,/ventas,/productos), moveStockBetweenBranches (/inventario,/movimientos), updateProductExtended (/productos,/productos/[id],/inventario,/inventario/inactivos); registerSale y createPurchaseWithBranchSplit ya revalidan.
- [ ] 4.2 Actualizar docs/README si aplica (soft-delete y sucursal obligatoria en ventas).
- [ ] 4.3 Suite completa antes de sdd-verify: `npm test` + `npm run test:e2e` (Playwright móvil: tap Sucursales, venta con sucursal, mover stock).
