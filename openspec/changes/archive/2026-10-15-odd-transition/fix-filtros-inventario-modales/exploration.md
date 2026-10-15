# Exploration: Fix filtros inventario + MoveStockModal cantidades por producto + estética STYLE.md

## Resumen ejecutivo

1. **Filtro de sucursal roto por causa de action**: `branchId` en `getProductsWithBranchStock` solo afecta el include anidado de `inventory` (inventory.ts:239), no filtra productos. El filtro real de productos por sucursal está encerrado en `if (opts.onlyWithStock)` (inventory.ts:212-219) y la página nunca manda `onlyWithStock` (page.tsx:54-59).
2. **Doble fuente de verdad en sucursal**: `BranchSelector` en la página de inventario se usa NO controlado (page.tsx:143-146); lee/escribe BranchContext y la página mantiene una copia local (`page.tsx:30`) → divergencia entre lo que muestra el dropdown y lo que usa el fetch.
3. **Categoría SÍ funciona**: `CategorySelector` es estrictamente controlado (props `selectedId`/`onValueChange`, sin contexto). El cableado de categoría en la página es correcto. La percepción de "categoría rota" proviene de la composición AND: con sucursal activa, la lista no se reduce por sucursal (causa 1).
4. **MoveStockModal**: flujo de 3 pasos (origen → productos → destino+cantidad global) con una única cantidad aplicada a todos los productos (MoveStockModal.tsx:89-97, bucle no atómico con N llamadas a `moveStockBetweenBranches`).
5. **MoveStockModal NO cumple STYLE.md**: contenedor `w-96 max-w-md rounded-lg bg-black/50` sin blur (línea 113-114), selects/inputs con ring indigo (128, 202, 224), botones chicos grises (176, 233) y CTA indigo (183, 241).
6. **ExportWizard ya es el gold standard STYLE.md**: bottom-sheet `max-w-lg rounded-t-3xl p-6 animate-slide-up`, overlay con blur, botones Rausch 44px+.
7. **Referencia de modal**: ProductForm.tsx — overlay `bg-black/60 backdrop-blur-sm z-[60] items-end`, contenedor `bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto`, header 44px circular, inputs `rounded-xl border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20`.
8. **Action actual**: `moveStockBetweenBranches` solo acepta UN producto + UNA cantidad (branchMovement.ts:10-21); no hay versión multi-item. Tests en inventory.advanced.test.ts (4 casos).
9. No existe `MoveStockModal.test.tsx` (componente sin cobertura directa).

## Causas raíz (filtros)

| # | Causa | Evidencia |
|---|-------|-----------|
| R1 | El action ignora `branchId` a nivel de producto (solo lo usa en include de stock) | inventory.ts:209-242, 212-219, 239 |
| R2 | BranchSelector no controlado → doble fuente de verdad | page.tsx:30,143-146; BranchSelector.tsx:37,55-63; BranchContext.tsx:91-97 |
| R3 | Percepción de categoría rota = AND roto por R1 | category funciona end-to-end: CategorySelector.tsx:16-30,92-97; page.tsx:180-182,211 |

## Flujo actual de datos (página inventario)

1. Estado local: `products`, `branchId`, `selectedCategoryId`, `search`/`debouncedSearch` (page.tsx:24-44).
2. Filtros: BranchSelector (no controlado, escribe contexto + onChange), InventoryFilters (controlado, categoría + search debounce 300ms).
3. Effect con deps `[branchId, selectedCategoryId, debouncedSearch]` → `fetchProducts` → `getProductsWithBranchStock({branchId?, categoryId?, search?, activeOnly:true})` (page.tsx:53-86).
4. Action arma where: active + categoryId + search OR; branchId SOLO en include (sin filtrar productos).
5. Render: InventarioList → InventarioCard con sumStock sobre filas scoped por sucursal.

## Recomendación de diseño

### Filtros
- Usar `BranchSelector` en modo controlado en la página (`value={branchId}` `onChange`) o replicar el patrón de `CategorySelector` (dropdown propio sin contexto, opción "Todas").
- Arreglar la action: cuando venga `branchId`, filtrar productos a nivel `where` (ej. `where.inventory = { some: { branchId } }`) independiente de `onlyWithStock`.
- Mantener `onlyWithStock` como toggle ortogonal.

### MoveStockModal (cantidades por producto)
- Fusión de paso 2 y 3 en "tabla editable": checkbox + nombre + stock disponible + input numérico por fila (min 1, max stock de esa fila), habilitado solo si el checkbox está marcado.
- Validaciones por fila + sumario sticky ("N productos · M unidades") + submit con array `[{productId, quantity}]`.
- Nueva action `moveStockBatchBetweenBranches({ sourceBranchId, destBranchId, items: Array<{productId, quantity}>, performedBy })` con validación zod de todo el batch, verificación de stock de TODOS los items antes de escribir y un único `prisma.$transaction` (mismo patrón línea 344). Comentario: aplicar el fix de pooling P2028 ya aplicado (.env session pooler).
- Mantener compatibilidad de la action actual (tests existentes) extendiendo con la nueva.

### Estética
- Alinear MoveStockModal al patrón ProductForm/ExportWizard: overlay `bg-black/30 backdrop-blur-md z-[60] items-end`, contenedor `w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto`, header 44px circular, selects/inputs con foco Rausch, CTA Rausch (#ff385c), volver en surface-soft.
- Tamaño: mover de `w-96 max-w-md` a `max-w-lg` como mínimo; ExportWizard ya está en `max-w-lg` (verificar si se agranda a `max-w-xl` con la tabla de cantidades).

## Archivos afectados

- `src/app/actions/inventory.ts` — getProductsWithBranchStock (206-258), mover stock (338-467), export (525-610)
- `src/app/inventario/page.tsx` — wiring filtros (24-99, 143-146, 180-186)
- `src/app/inventario/components/InventoryFilters.tsx` — filtro categoría (controlado, ok)
- `src/app/inventario/components/MoveStockModal.tsx` — rediseño + cantidades por producto
- `src/components/ui/BranchSelector.tsx` — modo controlado (32-63)
- `src/components/ui/CategorySelector.tsx` — patrón de referencia
- `src/lib/validations/branchMovement.ts` — schema batch
- `src/app/actions/inventory.advanced.test.ts` — tests batch
- `src/app/inventario/components/ExportWizard.tsx` (+ test) — agrandar si aplica
- Nuevo: `src/app/inventario/components/MoveStockModal.test.tsx`

## Riesgos

- **Transacciones interactivas**: la nueva action batch usa `$transaction(async (tx) => ...)`; funciona solo con session pooler (ya corregido en .env a :5432). En deploy hay que replicar.
- Compatibilidad de `moveStockBetweenBranches` actual: mantener firma para no romper tests/otros callers; la nueva action es aditiva.
- Stock insuficiente parcial en batch: validar todos los items ANTES de escribir; si alguno falla → rollback total (error claro por producto).