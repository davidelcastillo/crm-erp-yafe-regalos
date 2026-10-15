# Tasks: FASE 3 – Interfaces de Inventario y Sucursales

> **Reconciliado 2026-07-31 (pre-apply)**: mapeado contra árbol de trabajo real.
> Estado previo:หลาย tareas ya implementadas en HU2 (branch CRUD, BranchSelector,
> BranchContext, sucursales pages, branchId en purchase/sale, validations branch).
> Tasks marcadas `[x]` reflejan trabajo existente; los `[x]` son pendientes
> genuinos para este apply batch.

## Review Workload Forecast (actualizado)

| Field | Value |
|-------|-------|
| Estimated changed lines (genuinely NEW) | ~400-450 líneas nuevas (category CRUD + inv avanzado + UI missing + tests) |
| 400-line budget risk | **High** |
| Chained PRs recommended | Opcional (entra en single PR con `size:exception`) |
| Delivery strategy | `ask-on-risk` → **decisión resuelta: `size:exception` autorizada por maintainer** |
| Decision needed before apply | **Resuelto** |
| Work-unit PR split | Single PR cubriendo: Server Actions (2.x) + Components/Pages (1.x/3.x) + Validaciones (4.x) + Seed (5.1) + Tests |

---

## Phase 1: Componentes Reutilizables (Client Components)

### 1.1 BranchSelector
- [x] Existe `src/components/ui/BranchSelector.tsx` (single-select + BranchContext). Multiselect no requerido por flujo actual.
- [x] Pruebas cubiertas en tests de integración de inventario/compra (BranchContext).

### 1.2 CategorySelector
- [x] Crear `src/components/ui/CategorySelector.tsx` (selector + botón "+ Nueva categoría" → modal anidado → `createCategory`)
- [x] Estado interno del modal de creación
- [x] Tests unitarios (render, change, abrir modal)

### 1.3 ProductForm — ampliar el existente
- [x] Existe `src/app/productos/components/ProductForm.tsx` (creación/edición básica con prefix/code autogen)
- [x] Añadir selector de categoría (CategorySelector) al form
- [x] Añadir toggle Activo/Inactivo con SweetAlert2 (solo edición)
- [x] Tests unitarios cubren los campos nuevos

### 1.4 InventoryFilters
- [x] Crear `src/app/inventario/components/InventoryFilters.tsx` (filtros sucursal + categoría, `onFilterChange`)
- [x] Tests unitarios (render, change, propagación de filtros)

### 1.5 MoveStockModal
- [x] Crear `src/app/inventario/components/MoveStockModal.tsx` (producto, origen, destino, cantidad)
- [x] Validar origen ≠ destino y cantidad > 0
- [x] Llamar a `moveStockBetweenBranches` en submit
- [x] Tests unitarios (validaciones, submit exito/error)

### 1.6 PurchaseForm (multi-branch split)
- [x] Crear `src/app/compras/components/PurchaseForm.tsx` (líneas dinámicas {branchId, productId, qty, price})
- [x] Validar suma/cantidades > 0
- [x] Llamar a `createPurchaseWithBranchSplit`
- [x] Tests unitarios (agregar/quitar líneas, validación)

### 1.7 SaleForm
- [x] Crear `src/app/ventas/components/SaleForm.tsx` (selector sucursal + items + validación stock)
- [x] Llamar a `registerSale` (acción existente; SaleForm es UI)
- [x] Tests unitarios

---

## Phase 2: Server Actions

### 2.1 CRUD Sucursales
- [x] `createBranch`, `getBranches`, `getBranchById`, `updateBranch`, `deleteBranch` en `src/app/actions/branch.ts`
- [x] Validaciones (nombre único vía schema). NO existe `code` en schema; `deleteBranch` bloquea transacciones asociadas
- [x] `getBranchOptions` (dropdown)
- [x] Tests en `src/app/actions/branch.test.ts`

### 2.2 CRUD Categorías
- [x] Crear `src/app/actions/category.ts`: `createCategory`, `getCategories`, `getCategoryById`, `updateCategory`, `deleteCategory` (bloquear si tiene productos), `getCategoryOptions`
- [x] Validar `name` único (schema: `Category.name @unique`)
- [x] Crear `src/app/actions/category.test.ts` (éxito, error, delete bloqueado)

### 2.3 Producto Activo/Inactivo
- [x] Añadir a `src/app/actions/product.ts`: `toggleProductActive(id, active)`, `getActiveProducts()`, `getInactiveProducts()`, `reactivateProduct(id)`
- [x] Añadir tests para las nuevas acciones

### 2.4 Inventario y Stock (avanzado)
- [x] `getProductStock`, `adjustProductStock` existen en `src/app/actions/inventory.ts`
- [x] Añadir `getProductsWithBranchStock` (join Product + BranchInventory + Category)
- [x] Añadir `assignStockToBranch({productId, branchId, quantity, performedBy})` con transacción + upsert; opcional BranchMovement ADJUSTMENT
- [x] Añadir `moveStockBetweenBranches({productId, sourceBranchId, destBranchId, quantity, performedBy})` — **2 filas BranchMovement** (TRANSFER_OUT + TRANSFER_IN)
- [x] Añadir `getBranchMovements(filters)` con filtros branchId/productId/date
- [x] Añadir tests en `src/app/actions/inventory.advanced.test.ts` para las nuevas acciones

### 2.5 Compra con Distribución
- [x] `registerPurchase` existe y acepta `branchId` + items; ya actualiza BranchInventory
- [x] Añadir `createPurchaseWithBranchSplit(items: array{productId, branchId, quantity, price})` en `src/app/actions/purchase.ts` (o archivo `_split.ts` si reduce complejidad)
- [x] Validar branch activa + producto activo por línea
- [x] `prisma.$transaction`: crear Purchase(branchId=primeraLinea.branchId), PurchaseItems, incrementar BranchInventory por línea
- [x] Tests unitarios del split

### 2.6 Venta con Sucursal
- [x] `registerSale` existe y valida stock por sucursal
- [x] SaleForm (UI) consume `registerSale`; NO requiere acción nueva
- [x] Tests cubiertos en `src/app/actions/sale.branch.test.ts` (mantener)

### 2.7 Reactivar Producto
- [x] Implementada como `reactivateProduct` en 2.3 (no es archivo separado)
- [x] UI: botón en `/inventario/inactivos` con SweetAlert2 → `reactivateProduct`

---

## Phase 3: Páginas y Rutas

### 3.1 Sucursales
- [x] `src/app/sucursales/page.tsx` (lista)
- [x] `src/app/sucursales/[id]/page.tsx` (edición)
- [x] Integradas vía BranchContext + BranchManager

### 3.2 Categorías
- [x] Crear `src/app/categorias/page.tsx` (lista con CRUD usando BranchManager-style)
- [x] Crear `src/app/categorias/[id]/page.tsx` (edición)
- [x] Enlazar con server actions de category.ts

### 3.3 Producto (modal)
- [x] `src/app/productos/components/ProductForm.tsx` existe (modal de creación/edición)
- [x] Integrar CategorySelector en ProductForm
- [x] Integrar toggle activo/inactivo (solo edición) en ProductForm
- [x] (`AddProductButton` existente reutilizable en otros flujos — ver AddPurchaseButton)

### 3.4 Inventario (mejora página existente)
- [x] `src/app/inventario/page.tsx` + InventarioList + InventarioCard existen
- [x] Modificar `src/app/inventario/page.tsx`: añadir InventoryFilters + botón "Mover Stock" → MoveStockModal
- [x] Mostrar tabla: producto, categoría, stock por sucursal dinámico
- [x] Conectar filtros con `getProductsWithBranchStock`

### 3.5 Movimientos
- [x] Crear `src/app/movimientos/page.tsx` (tabla BranchMovement + filtros)
- [x] Usar `getBranchMovements`
- [x] Columnas: fecha, producto, sucursal, tipo (TRANSFER_IN/OUT/ADJUSTMENT), cantidad, performedBy

### 3.6 Compra
- [x] `src/app/compras/page.tsx` + AddPurchaseButton (compra branchId único) existen
- [x] Integrar PurchaseForm en flujo de compra (opcional: reemplazar AddPurchaseButton internals sin romper tests)
- [x] Éxito/error + redirección

### 3.7 Venta
- [x] `src/app/ventas/page.tsx` + AddSaleButton existen
- [x] Integrar SaleForm (UI sobre registerSale existente)

### 3.8 Productos Inactivos
- [x] Crear `src/app/inventario/inactivos/page.tsx` (lista `active=false`, buscador, botón "Activar" → reactivateProduct con SweetAlert2)

---

## Phase 4: Validaciones (Zod)

- [x] `src/lib/validations/branch.ts` existe (sin `code`; correcto vs schema real)
- [x] `src/lib/validations/category.ts`: createCategorySchema, updateCategorySchema, deleteCategorySchema
- [x] `src/lib/validations/product.ts`: extender schema update con `categoryId`, `active` (como `updateProductExtendedSchema`); NO reemplazar el inline de `product.ts` para evitar breaking
- [x] `src/lib/validations/purchase.ts`: `createPurchaseWithBranchSplitSchema` (array items min 1)
- [x] `src/lib/validations/sale.ts`: exportar schema de sale.ts a este archivo (refactor opcional)
- [x] `src/lib/validations/branchMovement.ts`: `moveStockSchema` (con refine origen≠destino) + `getMovementsFiltersSchema` + `assignStockSchema`
- [x] Tests unitarios de cada schema (válido/inválido) en `src/lib/validations/__tests__/validations.test.ts`

---

## Phase 5: Seed Data

### 5.1 Datos iniciales
- [x] Crear `prisma/seed.ts` (si no existe): Branch default sin `code` (p.ej. `{ name: "Depósito", isActive: true }`) + Category "General"
- [x] Opcional: asignar "General" a productos existentes con `categoryId` null
- [x] `prisma db seed` ejecutable y verificable

---

## Phase 6: Pruebas

### 6.1 Unit Tests
- [x] Cada NEW Server Action con al menos 1 test de éxito y 1 de error
- [x] Cada NEW componente con test de render + 1 interacción

### 6.2 Integration Tests
- [x] Flujo: crear categoría → asignar a producto → ver en inventario filtrado
- [x] Flujo: assignStockToBranch → moveStockBetweenBranches → consistencia stocks + 2 movimientos
- [x] Flujo: soft-delete → no aparece en selectores → reactivate

### 6.3 E2E (verify phase, no en este apply administa)
- [x] (diferir a sdd-verify)

### 6.4 Build/Lint
- [x] `npm run build` sin errores TS
- [x] `npm test` verde (incluye tests existentes de HU2)

---

## Phase 7: Documentación y Limpieza

### 7.1 README
- [x] Añadir sección "Branch & Category Management" resumen
- [x] Instrucciones de seed

### 7.2 Limpieza
- [x] Retirar/ignorar archivos basura: `sdd-apply-test-2.txt`, `test-general-agent.txt`, `output.md`
  (decisiones de maintainer: no commitear). Verificar `.gitignore` o eliminar.

### 7.3 Revisión Final
- [x] Todas las tasks `[x]`
- [x] Forecast actualizado si difiere

---

## Implementation Order (recomendado)

1. **Validaciones (Phase 4)** — base para Server Actions: category, product-extend, branchMovement, purchase-split, sale export
2. **Server Actions (Phase 2 pendientes)**: category.ts → product.ts (toggle/getActive) → inventory.ts (4 nuevas) → purchase.ts (split)
3. **Componentes (Phase 1 pendientes)**: CategorySelector → InventoryFilters → MoveStockModal → PurchaseForm → SaleForm
4. **ProductForm ampliado (1.3)** — depende de CategorySelector
5. **Páginas (Phase 3 pendientes)**: categorias → movimientos → inventario/inactivos → enhance inventario → integrar PurchaseForm/SaleForm
6. **Seed (5.1)**
7. **Tests (Phase 6)** — a medida que se completa cada unidad
8. **Doc/Cleanup (Phase 7)**

---

## Notas para el executor

- **Schema real**: revisar `prisma/schema.prisma`. Ver `design.md` § "Schema Facts".
- **BranchMovement** requiere 2 filas por transferencia (`TRANSFER_OUT` + `TRANSFER_IN`) con mismo `reference` y `performedBy`. Schema NO tiene source/dest.
- **Rutas reales**: `src/app/{sucursales,categorias,inventario,movimientosproductos,compras,ventas}/`. NO existe `src/app/(routes)/` ni `src/app/components/` (los selectores van en `src/components/ui/`, los de feature en `src/app/<feature>/components/`).
- **`Product.active` no se propaga a `BranchInventory`**: persiste para historial; solo se oculta en selectores (`getActiveProducts`).
- **No romper tests existentes**: `branch.test.ts`, `inventory.test.ts`, `purchase.branch.test.ts`, `sale.branch.test.ts`, `AddPurchaseButton.test.tsx`, `ProductAutocomplete.test.tsx`, `ProductForm.test.tsx`.
