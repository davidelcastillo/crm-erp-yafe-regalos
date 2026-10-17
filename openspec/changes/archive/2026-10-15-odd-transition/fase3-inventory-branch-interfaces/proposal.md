# Proposal: FASE 3 – Interfaces de Inventario y Sucursales

## Intent

Implementar todas las interfaces de usuario y flujos de interacción para gestionar sucursales, categorías, asignación de stock por sucursal, movimientos entre sucursales, activación/desactivación de productos (soft-delete), y la UI de compras/ventas con selección de sucursal. El esquema de base de datos (Branch, BranchProduct, BranchMovement, Category, Product.categoryId, Product.active) ya existe tras la Fase 2.

## Scope

### In Scope
- CRUD completo de sucursales (listar, crear, editar, eliminar – solo admin)
- CRUD completo de categorías (listar, crear, editar, eliminar – solo admin)
- Modal de Registro de Compra con selector múltiple de sucursales y cantidades por sucursal
- Modal de Registro de Venta con selector obligatorio de sucursal y validación de stock
- Pantalla de Inventario con filtro de sucursal, filtro de categorías, botón "Mover Stock" y listado con stock por sucursal
- Sección de Movimientos (tabla de BranchMovement con filtros)
- Modal de Crear/Editar Producto con selector de categoría y toggle Activo/Inactivo (SweetAlert2)
- Página /inventario/inactivos con listado, buscador y botón Activar por fila
- Componentes reutilizables: BranchSelector, CategorySelector, MoveStockModal, PurchaseForm, SaleForm, InventoryFilters, ProductForm
- Server Actions para todas las operaciones: CRUD sucursales/categorías, toggle activo/inactivo, asignación/movimiento de stock, compras/ventas con sucursal, consulta de movimientos
- Validaciones de integridad: suma de stock por sucursal = Product.stock, transacciones Prisma atómicas, bloqueo de productos inactivos en todos los flujos

### Out of Scope
- Cambios de esquema de base de datos (ya completados en Fase 2)
- Mejoras de UI/UX avanzadas, filtros complejos, dashboard personalizable, portal externo de solo lectura (Fase 4)
- Reportes avanzados por sucursal (ya cubiertos en branch-reporting spec)
- Autenticación/autorización (ya implementada en Fase 1)
- Tests E2E exhaustivos (se cubren en fase verify, no en esta propuesta)

## Capabilities

### New Capabilities
- `category-management`: CRUD de categorías, validación de eliminación con productos asociados, modal anidado para creación desde formulario de producto
- `inventory-ui`: Pantalla de inventario con filtros de sucursal y categoría, listado con stock por sucursal, botón Mover Stock
- `branch-movements`: Registro y consulta de movimientos de stock entre sucursales (BranchMovement), validaciones de stock origen/destino
- `product-soft-delete`: Toggle activo/inactivo en formulario de producto, página de inactivos, exclusión automática de productos inactivos en selectores
- `purchase-with-branch-split`: Modal de compra con distribución múltiple por sucursal, validación de suma ≤ stock total y stock ≥ 0 por sucursal
- `sale-with-branch`: Modal de venta con selector de sucursal obligatorio, validación de stock en sucursal seleccionada

### Modified Capabilities
- `branch-management`: Extender CRUD existente para incluir UI (páginas, componentes) y Server Actions de asignación de stock (`assignStockToBranch`)
- `multi-location-inventory`: Extender para exponer `getProductsWithBranchStock` y `moveStockBetweenBranches` (ya existe lógica de BranchInventory)
- `location-based-transactions`: Reemplazar `createPurchase`/`createSale` por versiones con distribución por sucursal (`createPurchaseWithBranchSplit`, `createSaleWithBranch`)
- `product-management`: Añadir `categoryId` y `active` al formulario y validaciones, filtrar `getProducts` por `active=true`

## Approach

### Arquitectura General
- **Server Actions** como única capa de mutación (Next.js App Router), todas las operaciones de stock en `prisma.$transaction`
- **Componentes Server/Client** separados: páginas y Server Actions en RSC, componentes interactivos (modales, selectores, formularios) como Client Components
- **Validación Zod** en cada Server Action y en cliente para feedback inmediato
- **SweetAlert2** para confirmaciones críticas (desactivar/activar producto, mover stock)
- **Middleware de admin** ya existente protege todas las rutas salvo `/inventario/inactivos` (también admin) y portal externo (Fase 4)

### Flujo de Stock (Invariante Clave)
Toda operación que modifique `BranchProduct`:
1. Lee `Product.stock` y suma actual de `BranchProduct` para ese `productId`
2. Valida que la operación mantenga: `suma(BranchProduct.stock) = Product.stock` y `BranchProduct.stock >= 0`
3. Ejecuta en `prisma.$transaction`: actualiza `BranchProduct` + crea `BranchMovement` (si aplica) + actualiza `Product.stock` si hay cambio neto
4. Si falla validación o transacción → error controlado, rollback automático

### Componentes Reutilizables
| Componente | Tipo | Props clave |
|------------|------|-------------|
| `BranchSelector` | Client | `mode: 'single' \| 'multiple'`, `selectedIds`, `onChange`, `label` |
| `CategorySelector` | Client | `selectedId`, `onChange`, `onCreateNew` (abre modal anidado) |
| `MoveStockModal` | Client | `open`, `onClose`, `productId`, `branches`, `onConfirm` |
| `PurchaseForm` | Client | `productId`, `branches`, `onSubmit`, `totalStock` |
| `SaleForm` | Client | `productId`, `branches`, `onSubmit` |
| `InventoryFilters` | Client | `branches`, `categories`, `onFilterChange` |
| `ProductForm` | Client | `initialData`, `categories`, `onSubmit`, `onToggleActive` |

### Server Actions Nuevas / Actualizadas
| Acción | Archivo | Transacción | Validaciones clave |
|--------|---------|-------------|-------------------|
| `createBranch` / `updateBranch` / `deleteBranch` | `branches/[id]/actions.ts` | No | unique name/code, no delete con historial |
| `createCategory` / `updateCategory` / `deleteCategory` | `categories/[id]/actions.ts` | No | no delete si tiene productos |
| `toggleProductActive` | `product/[id]/actions.ts` | Sí | SweetAlert2 confirm |
| `getActiveProducts` / `getInactiveProducts` | `product/[id]/actions.ts` | No | filtro `active` |
| `getProductsWithBranchStock` | `inventario/actions.ts` | No | join Product + BranchProduct + Category |
| `assignStockToBranch` | `inventario/actions.ts` | Sí | suma ≤ Product.stock, stock ≥ 0 |
| `moveStockBetweenBranches` | `inventario/actions.ts` | Sí | origen stock ≥ qty, destino stock + qty, invariante total |
| `getBranchMovements` | `inventario/actions.ts` / `movements/actions.ts` | No | filtros fecha, origen, destino, producto |
| `createPurchaseWithBranchSplit` | `purchase/actions.ts` | Sí | valida cada línea: suma qty ≤ stock total, cada sucursal ≥ 0 |
| `createSaleWithBranch` | `sale/actions.ts` | Sí | valida BranchProduct.stock ≥ qty en sucursal seleccionada |
| `reactivateProduct` | `inventario/inactivos/actions.ts` | Sí | SweetAlert2 confirm |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/(routes)/branches/page.tsx` | New | Lista de sucursales (admin) |
| `src/app/(routes)/branches/[id]/page.tsx` | New | Editar sucursal (admin) |
| `src/app/(routes)/branches/[id]/actions.ts` | New | Server Actions CRUD sucursales |
| `src/app/(routes)/categories/page.tsx` | New | Lista de categorías (admin) |
| `src/app/(routes)/categories/[id]/page.tsx` | New | Editar categoría (admin) |
| `src/app/(routes)/categories/[id]/actions.ts` | New | Server Actions CRUD categorías |
| `src/app/(routes)/product/[id]/page.tsx` | Modified | Modal producto con categoría + toggle activo |
| `src/app/(routes)/product/[id]/actions.ts` | Modified | `toggleProductActive`, `getActiveProducts`, `getInactiveProducts` |
| `src/app/(routes)/inventario/page.tsx` | Modified | Filtros sucursal/categoría, botón Mover Stock, listado stock por sucursal |
| `src/app/(routes)/inventario/actions.ts` | New | `getProductsWithBranchStock`, `assignStockToBranch`, `moveStockBetweenBranches`, `getBranchMovements` |
| `src/app/(routes)/inventario/inactivos/page.tsx` | New | Página productos inactivos con buscador y botón Activar |
| `src/app/(routes)/inventario/inactivos/actions.ts` | New | `reactivateProduct` |
| `src/app/(routes)/purchase/page.tsx` | Modified | Modal compra con distribución por sucursal |
| `src/app/(routes)/purchase/actions.ts` | Modified | `createPurchaseWithBranchSplit` (transacción) |
| `src/app/(routes)/sale/page.tsx` | Modified | Modal venta con selector sucursal |
| `src/app/(routes)/sale/actions.ts` | Modified | `createSaleWithBranch` (valida stock sucursal) |
| `src/app/(routes)/movements/page.tsx` | New/Modified | Tabla movimientos con filtros |
| `src/app/(routes)/movements/actions.ts` | New | `getBranchMovements` |
| `src/app/components/BranchSelector.tsx` | New | Selector reutilizable (type-ahead/checkboxes) |
| `src/app/components/CategorySelector.tsx` | New | Selector reutilizable + botón "+ Nueva categoría" |
| `src/app/components/ProductForm.tsx` | New | Formulario producto (categoría + toggle activo) |
| `src/app/components/InventoryFilters.tsx` | New | Filtros sucursal + categoría para inventario |
| `src/app/components/MoveStockModal.tsx` | New | Modal mover stock entre sucursales |
| `src/app/components/PurchaseForm.tsx` | New | Formulario compra con distribución por sucursal |
| `src/app/components/SaleForm.tsx` | New | Formulario venta con selector sucursal |
| `src/lib/validations/branch.ts` | New | Zod schemas sucursal |
| `src/lib/validations/category.ts` | New | Zod schemas categoría |
| `src/lib/validations/product.ts` | Modified | Añadir `categoryId`, `active` |
| `src/lib/validations/purchase.ts` | New | Schema compra con array `{productId, branchId, quantity, price}` |
| `src/lib/validations/sale.ts` | New | Schema venta con `{productId, branchId, quantity, price, paymentMethod}` |
| `src/lib/validations/branchMovement.ts` | New | Schema movimiento stock |
| `src/actions/branch.actions.ts` | New | CRUD sucursales + acciones stock |
| `src/actions/category.actions.ts` | New | CRUD categorías |
| `src/actions/inventory.actions.ts` | New | Asignación/movimiento stock + consulta movimientos |
| `prisma/seed.ts` | Modified/Created | Seed inicial: Branch "Depósito" + Category "General" |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Inconsistencia de stock entre `Product.stock` y suma `BranchProduct` | High | Todas las mutaciones en `prisma.$transaction` + validación previa de invariante; tests de integración exhaustivos |
| Race conditions en movimientos concurrentes | Medium | Transacciones serializables + validación optimista en Server Action |
| Complejidad de modales anidados (categoría dentro de producto) | Medium | CategorySelector maneja estado interno; tests de componente aislados |
| Fuga de productos inactivos en selectores | Medium | Centralizar filtro `active=true` en `getActiveProducts` y validar en cada Server Action de compra/venta/movimiento |
| Tests E2E flaky por SweetAlert2 | Low | Mock SweetAlert2 en tests; usar `data-testid` en botones de confirmación |
| Rutas no protegidas por middleware admin | Low | Auditoría de rutas en `middleware.ts`; tests de acceso denegado |

## Rollback Plan

1. Revertir cambios en `openspec/changes/fase3-inventory-branch-interfaces/` (git checkout)
2. Revertir migraciones de Prisma si se ejecutaron (no debería haber cambios de esquema)
3. `npm run build` para verificar que no hay errores de compilación
4. `npm run test` para confirmar que tests previos pasan

## Dependencies

- Fase 2 completada (esquema con Branch, BranchProduct, BranchMovement, Category, Product.categoryId, Product.active)
- Fase 1 completada (auth, middleware admin, Supabase configurado)
- SweetAlert2 ya instalado y configurado en el proyecto
- Zod, Prisma, Next.js 16, Tailwind v4 ya en dependencias

## Success Criteria

- [ ] Admin puede crear/editar/eliminar sucursales y categorías desde UI
- [ ] Modal de compra permite seleccionar múltiples sucursales con cantidades; valida suma ≤ stock total y stock ≥ 0 por sucursal
- [ ] Modal de venta requiere sucursal y valida stock en esa sucursal antes de permitir venta
- [ ] Pantalla Inventario muestra filtro sucursal ("Todas" + lista), filtro categorías (múltiple), botón Mover Stock funcional
- [ ] Botón Mover Stock crea `BranchMovement` (tipo TRANSFER) y actualiza stocks origen/destino atómicamente
- [ ] Tabla Movimientos muestra fecha, producto, origen, destino, cantidad, usuario con filtros funcionales
- [ ] Formulario producto incluye selector categoría + toggle Activo/Inactivo con SweetAlert2
- [ ] Listado Inventario muestra solo `active=true`
- [ ] Página `/inventario/inactivos` lista `active=false` con buscador y botón Activar por fila (SweetAlert2)
- [ ] Ningún selector de producto (compra, venta, movimiento) permite elegir productos inactivos
- [ ] Invariante de stock: suma `BranchProduct.stock` = `Product.stock` tras cualquier operación
- [ ] Todas las Server Actions de stock usan `prisma.$transaction`
- [ ] Tests unitarios para cada Server Action (validaciones, transacciones, errores)
- [ ] Tests de integración: flujo completo sucursal → stock → compra → venta → movimiento → verificación invariante
- [ ] `npm run build` y `npm run test` pasan sin errores

---

### Proposal Question Round (Interactive Mode)

**Preguntas para mejorar la propuesta antes de pasar a specs:**

1. **Regla de negocio – Stock negativo temporal**: ¿Se permite que durante un movimiento de stock entre sucursales el stock de origen baje temporalmente a negativo si la transacción falla a mitad? (Asumimos NO: transacción atómica todo-o-nada).

2. **Eliminación de sucursal con stock**: ¿Qué pasa si se intenta eliminar una sucursal que tiene `BranchProduct` con stock > 0? ¿Bloquear (HAS_STOCK) o forzar mover stock a otra sucursal primero?

3. **Categoría por defecto**: ¿Debe crearse automáticamente una categoría "General" en seed y asignarse a productos existentes sin categoría? ¿O permitir `categoryId` nullable en UI?

4. **Soft-delete en cascada**: Al desactivar un producto, ¿se deben desactivar automáticamente sus `BranchProduct` asociados? (Asumimos NO: `BranchProduct` persiste para historial, solo se oculta en selectores).

5. **Rol `branch_user` en Fase 3**: ¿Las páginas de sucursal (`/inventario`, `/movimientos`) deben ser accesibles para `branch_user` con datos filtrados a su sucursal, o solo para admin en esta fase? (Portal externo de solo lectura es Fase 4).

6. **Validación de código de sucursal**: ¿El `code` de sucursal debe ser único globalmente y usarse como identificador corto en UI (ej. "SC", "SN")? ¿Formato obligatorio (alfanumérico, max 10)?

7. **Movimientos de tipo AJUSTE vs TRANSFER**: ¿El modal "Mover Stock" solo crea tipo TRANSFER, o también debe permitir AJUSTE MANUAL (origen = null)? (Prompt dice solo TRANSFER).

8. **Performance – Inventario con muchas sucursales/productos**: ¿Paginación en servidor o carga completa? (Asumimos paginación server-side con `take/skip` en `getProductsWithBranchStock`).

9. **SweetAlert2 theme**: ¿Usar tema del proyecto (Tailwind) o estilo por defecto? ¿Hay wrapper existente en `src/lib/ui/sweetalert.ts`?

10. **Non-goals confirmados**: Confirmar que NO se incluyen en Fase 3: dashboard personalizable, filtros avanzados (rango de fechas, proveedor, etc.), portal externo `/sucursal/[id]/inventory`, exportación a Excel/PDF, notificaciones push/email.

**Por favor responde las preguntas arriba o indica "proceder" para continuar a specs con los supuestos marcados (Asumimos...).**