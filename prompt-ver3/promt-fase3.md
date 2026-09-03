# Change: FASE 3 – Interfaces de Inventario y Sucursales  

## Contexto
Proyecto: **Stark Commerce OS** (Next.js 16 + Prisma + Supabase + Tailwind v4)  
Estado actual: Tras la Fase 2 el esquema ya contiene los modelos `Branch`, `BranchProduct`, `BranchMovement`, `Category` y los campos `categoryId`, `active` en `Product` (con su lógica de integridad de stock). No existen todavía las pantallas ni los componentes de usuario necesarios para gestionar sucursales, categorías, asignación de stock por sucursal, movimientos entre sucursales, producto activo/inactivo ni la UI de compras/ventas con selección de sucursal.  
Objetivo: Implementar todas las interfaces de usuario y los flujos de interacción correspondientes a **HU01**, **HU02** y **HU03** (excepto los cambios de esquema que ya están listos), preparando el terreno para las mejoras de UI, filtros y portal externo de la Fase 4.

## Requerimientos

### HU01 – Sucursales y asignación de stock por sucursal  
- **CRUD de sucursales**: lista, crear, editar, eliminar (solo admin).  
- **Modal de Registro de Compra**: para cada línea de producto mostrar un selector múltiple de sucursales (tipo‑ahead o checkboxes) con campo de cantidad por sucursal. Validar que la suma de cantidades no supere el stock total del producto y que el stock en cada sucursal no quede negativo.  
- **Modal de Registro de Venta**: desplegable (input + autocomplete) obligatorio para seleccionar la sucursal; antes de permitir la venta validar que la sucursal seleccionada tenga suficiente stock en `BranchProduct`.  
- **Pantalla de Inventario**: filtro de sucursal (desplegable con opción “Todas”) y botón **Mover Stock** que abre un modal para elegir producto, origen, destino y cantidad; al confirmar crea registro en `BranchMovement` y actualiza stocks de origen y destino.  
- **Sección de Movimientos** (ya existente): mostrar tabla de `BranchMovement` con filtros por fecha, sucursal origen/destino y producto.  

### HU02 – Categorías de productos  
- **CRUD de categorías**: lista, crear, editar, eliminar (solo admin).  
- **Modal de Crear/Editar Producto**: selector de categoría existente + botón “+ Nueva categoría” que abre un modal anidado idéntico al de crear categoría.  
- **Pantalla de Inventario**: filtro múltiple de categorías (checkbox o tipo‑ahead) que muestra solo los productos cuya categoría coincida.  

### HU03 – Activar/desactivar productos (soft‑delete)  
- En el modal de Crear/Editar Producto: reemplazar el botón “Eliminar” por un toggle **Activo/Inactivo** (cuando se desactiva se guarda `active = false`). Se mostrará una confirmación SweetAlert2 antes de aplicar el cambio.  
- Listado de **Inventario**: mostrar solo productos donde `active = true`.  
- Página especial **/inventario/inactivos**: lista simple, buscador y para cada producto un botón **Activar** (con confirmación SweetAlert2).  
- En cualquier flujo que seleccione un producto (compra, venta, movimiento, etc.) impedir la selección si `active = false`.  

## Criterios de aceptación combinados

### Funcionalidad de Sucursales  
1. El usuario admin puede crear una sucursal con `name` y `code` únicos; la sucursal aparece en la lista y puede ser editada/eliminada.  
2. En el modal de compra, al seleccionar una o varias sucursales y especificar cantidades, el sistema verifica:  
   - Σ cantidad ≤ stock total del producto.  
   - Stock restante en cada sucursal ≥ 0.  
   - Si la validación falla, muestra mensaje de error y no permite guardar la compra.  
3. En el modal de venta, al seleccionar una sucursal y cantidad, el sistema verifica que `BranchProduct.stock ≥ cantidad` para esa sucursal; caso contrario, bloquea la venta y muestra error.  
4. El botón **Mover Stock** abre un modal donde se elige producto, sucursal origen, sucursal destino y cantidad; al confirmar:  
   - Se crea un registro en `BranchMovement` (tipo = “TRANSFER”).  
   - Se decrementa el stock en `BranchProduct` de la sucursal origen y se incrementa el de la sucursal destino.  
   - La suma total de stock del producto permanece invariantemente igual a `Product.stock`.  
5. La tabla de Movimientos muestra fecha, producto, origen, destino, cantidad y usuario que realizó el movimiento, con filtros funcionales.  

### Funcionalidad de Categorías  
6. El admin puede crear, editar y eliminar categorías; al eliminar una categoría que tenga productos asociados, se muestra error impidiendo la eliminación hasta que se reasignen o eliminen esos productos.  
7. En el modal de producto, el selector de categorías muestra todas las categorías existentes; el botón “+ Nueva categoría” abre un modal que permite crear una categoría y, al guardarla, la agrega automáticamente al selector.  
8. El filtro de categorías en la pantalla de Inventario muestra solo los productos cuya categoría coincide con la(s) seleccionada(s).  

### Funcionalidad de Activar/Desactivar (Soft‑Delete)  
9. El toggle de activo/inactivo en el modal de producto guarda correctamente el campo `active`. Al desactivar, se muestra SweetAlert2 de confirmación; al activar desde la página de inactivos, igual se confirma.  
10. Los listados de Inventario, los modales de compra/venta y cualquier otro selector de producto excluyen automáticamente los productos con `active = false`.  
11. La página `/inventario/inactivos` lista todos los productos donde `active = false`, con buscador y botón **Activar** por fila que vuelve a poner `active = true`.  
12. Al intentar realizar una compra, venta o movimiento con un producto inactivo, el sistema muestra mensaje de error y no permite la operación.  

### Consistencia de Datos  
13. Después de cualquier operación que modifique stock (compra con distribución, venta, movimiento de stock, ajuste manual), la suma de `stock` en todas las filas de `BranchProduct` para un mismo `productId` sigue siendo igual a `Product.stock`.  
14. Todas las operaciones que modifican stock se ejecutan dentro de una transacción Prisma (`prisma.$transaction`) para garantizar atomicidad.  

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/app/(routes)/branches/page.tsx` | Lista de sucursales (admin). |
| `src/app/(routes)/branches/[id]/page.tsx` | Editar sucursal (admin). |
| `src/app/(routes)/branches/[id]/actions.ts` | Server Actions: `createBranch`, `updateBranch`, `deleteBranch`. |
| `src/app/(routes)/categories/page.tsx` | Lista de categorías (admin). |
| `src/app/(routes)/categories/[id]/page.tsx` | Editar categoría (admin). |
| `src/app/(routes)/categories/[id]/actions.ts` | Server Actions: `createCategory`, `updateCategory`, `deleteCategory`. |
| `src/app/(routes)/product/[id]/page.tsx` | Modal de Crear/Editar Producto (actualizado con selector de categoría y toggle activo). |
| `src/app/(routes)/product/[id]/actions.ts` | Server Actions: `toggleProductActive`, `getActiveProducts`, `getInactiveProducts`. |
| `src/app/(routes)/inventario/page.tsx` | Pantalla de Inventario: filtro sucursal, filtro categoría, botón Mover Stock, listado de productos con stock por sucursal. |
| `src/app/(routes)/inventario/actions.ts` | Server Actions: `getProductsWithBranchStock`, `assignStockToBranch`, `moveStockBetweenBranches`, `getBranchMovements`. |
| `src/app/(routes)/inventario/inactivos/page.tsx` | Página de productos inactivos (lista, buscador, botón Activar). |
| `src/app/(routes)/inventario/inactivos/actions.ts` | Server Action: `reactivateProduct` (cambia `active` a true). |
| `src/app/(routes)/purchase/page.tsx` | Modal de Registro de Compra (selector múltiple de sucursales con cantidades). |
| `src/app/(routes)/purchase/actions.ts` | Server Action: `createPurchaseWithBranchSplit` (transacción que actualiza `BranchProduct`). |
| `src/app/(routes)/sale/page.tsx` | Modal de Registro de Venta (selector de sucursal). |
| `src/app/(routes)/sale/actions.ts` | Server Action: `createSaleWithBranch` (valida stock de sucursal). |
| `src/app/(routes)/movements/page.tsx` | Tabla de Movimientos (lista, filtros). |
| `src/app/(routes)/movements/actions.ts` | Server Action: `getBranchMovements`. |
| `src/app/components/BranchSelector.tsx` | Componente reutilizable (type‑ahead o checkboxes) para seleccionar una o varias sucursales. |
| `src/app/components/CategorySelector.tsx` | Componente reutilizable (type‑ahead + botón “+ Nueva categoría”). |
| `src/app/components/ProductForm.tsx` | Formulario usado en modales de producto (incluye selector de categoría y toggle activo). |
| `src/app/components/InventoryFilters.tsx` | Filtros de sucursal y categoría para la pantalla de Inventario. |
| `src/app/components/MoveStockModal.tsx` | Modal para mover stock entre sucursales. |
| `src/app/components/PurchaseForm.tsx` | Formulario de compra con distribución por sucursal. |
| `src/app/components/SaleForm.tsx` | Formulario de venta con selección de sucursal. |
| `src/lib/validations/branch.ts` | Zod schemas para crear/actualizar sucursal. |
| `src/lib/validations/category.ts` | Zod schemas para crear/actualizar categoría. |
| `src/lib/validations/product.ts` | Actualizar schema para incluir `categoryId` y `active`. |
| `src/lib/validations/purchase.ts` | Schema para crear compra con arreglo de `{productId, branchId, quantity, price}`. |
| `src/lib/validations/sale.ts` | Schema para crear venta con `{productId, branchId, quantity, price, paymentMethod}`. |
| `src/lib/validations/branchMovement.ts` | Schema para crear movimiento de stock. |
| `src/actions/product.actions.ts` (si existen) | Actualizar `getProducts` para incluir `category` y filtrar `active = true`. |
| `src/actions/purchase.actions.ts` | Actualizar `createPurchase` a la nueva versión con distribución. |
| `src/actions/sale.actions.ts` | Actualizar `createSale` a la nueva versión con sucursal. |
| `src/actions/branch.actions.ts` | Nuevo archivo con CRUD de sucursales y acciones de stock. |
| `src/actions/category.actions.ts` | Nuevo archivo con CRUD de categorías. |
| `src/actions/inventory.actions.ts` | Nuevo archivo con acciones de asignación/movimiento de stock y obtención de movimientos. |
| `prisma/seed.ts` (o crear) | Asegurar que exista registro inicial en `Branch` (Deposito) y categoría por defecto (General) para que los tests y la UI tengan datos de referencia. |

## Notas técnicas
- **Transacciones de Stock**: Todas las Server Actions que modifican `BranchProduct` (`assignStockToBranch`, `moveStockBetweenBranches`, `createPurchaseWithBranchSplit`, `createSaleWithBranch`) deben estar envueltas en `prisma.$transaction` para evitar estados inconsistentes.  
- **Validaciones de Stock**: Antes de cualquier operación de asignación o movimiento, consultar `Product.stock` y la suma actual de `BranchProduct` para ese `productId`; si la operación haría que la suma difiera, abortar y devolver error controlado.  
- **SweetAlert2**: Usar la instancia ya configurada en el proyecto para confirmaciones de desactivación/activación y de movimientos críticos.  
- **Supabase Auth & Roles**: Las rutas de administración (`/branches/*`, `/categories/*`, `/product/*`, `/purchase/*`, `/sale/*`, `/inventario/*` excepto `/inventario/inactivos`) deben estar protegidas por el middleware de admin (ya creado en Fase 1). Las rutas `/inventario/inactivos` también requieren rol admin.  
- **Evitar exposición de datos sensibles**: Nunca devolver el `user.id` o tokens en respuestas de Server Actions; usar solo los datos necesarios para la UI.  
- **Testing**:  
  - Unit: probar cada Server Action (crear sucursal, asignar stock, mover stock, toggle activo/inactivo).  
  - Integración: flujo completo – crear sucursal → asignar stock → registrar compra con distribución → registrar venta verificando stock de sucursal → mover stock entre sucursales → consultar movimientos y validar que el stock total del producto permanece constante.  
  - E2E (Playwright): validar que un admin pueda crear sucursal, asignar stock, comprar, vender, mover stock y ver los movimientos; que un usuario de sucursal (rol `branch_user`) solo pueda ver su propio inventario y no pueda realizar mutaciones.  

## PROMT por Fase SSD
**Qué debe generar el orchestrator (a través de los sub‑agentes):**

1. **Explorar** el estado actual de la UI (páginas de inventario, compras, ventas, productos) y los Server Actions relacionados con productos, compras y ventas.  
2. **Proponer**  
   - Crear los CRUD de sucursales y categorías (páginas, componentes, Server Actions).  
   - Actualizar el modal de producto para incluir selector de categoría y toggle activo/inactivo (con SweetAlert2).  
   - Implementar el modal de compra con distribución múltiple por sucursal y validación de stock.  
   - Implementar el modal de venta con selección de sucursal y validación de stock de sucursal.  
   - Añadir a la pantalla de Inventario: filtro de sucursal, filtro de categoría, botón Mover Stock y listado con stock por sucursal.  
   - Crear la página de productos inactivos con buscador y botón de activación.  
   - Crear/reemplazar los componentes reutilizables (`BranchSelector`, `CategorySelector`, `MoveStockModal`, `PurchaseForm`, `SaleForm`, `InventoryFilters`).  
   - Implementar Server Actions necesarios: CRUD de `Branch` y `Category`, `toggleProductActive`, `getActiveProducts`/`getInactiveProducts`, `getProductsWithBranchStock`, `assignStockToBranch`, `moveStockBetweenBranches`, `getBranchMovements`, `createPurchaseWithBranchSplit`, `createSaleWithBranch`.  
3. **Especificar** flujos de usuario detallados (paso a paso, validaciones, mensajes de error/éxito).  
4. **Diseñar** componentes/Server Actions:  
   - Server Actions: `createBranch`, `updateBranch`, `deleteBranch`, `createCategory`, `updateCategory`, `deleteCategory`, `toggleProductActive`, `getActiveProducts`, `getInactiveProducts`, `getProductsWithBranchStock`, `assignStockToBranch`, `moveStockBetweenBranches`, `getBranchMovements`, `createPurchaseWithBranchSplit`, `createSaleWithBranch`.  
   - Componentes: `BranchManager`, `CategoryManager`, `ProductForm` (con categoría + toggle), `PurchaseForm`, `SaleForm`, `InventoryView` (con filtros y mover stock), `MovementsTable`, `InactiveProductsPage`, `BranchSelector`, `CategorySelector`, `MoveStockModal`.  
5. **Tareas** (dividir en unidades de trabajo):  
   - Crear/actualizar páginas y rutas Next.js para cada entidad.  
   - Desarrollar los componentes UI reutilizables.  
   - Implementar los Server Actions listados, asegurando uso de transacciones donde corresponda.  
   - Añadir los filtros y botones necesarios a las páginas existentes.  
   - Escribir pruebas unitarias para cada Server Action (validaciones de stock, toggles, CRUD).  
   - Escribir pruebas de integración que cubran los flujos completos mencionados en los criterios de aceptación.  
   - Ejecutar pruebas E2E con Playwright para validar la experiencia de admin y de usuario de sucursal.  
6. **Aplicar** las tareas en batches.  
7. **Verificar** con pruebas unitarias, de integración y E2E (confirmando que el stock total del producto permanece constante tras cualquier operación y que los soft‑delete funcionan correctamente).  
8. **Archivar** el cambio.  
