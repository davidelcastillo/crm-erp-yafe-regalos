# Proposal: Fix filtros de inventario + cantidades por producto en MoveStockModal + estética STYLE.md

## Metadata

| Campo | Valor |
|---|---|
| Change ID | `fix-filtros-inventario-modales` |
| Exploración fuente | `openspec/changes/fix-filtros-inventario-modales/exploration.md` (contrato de evidencia file:line; causas R1/R2/R3) |
| Preflight | `auto` · `hybrid` (OpenSpec + Engram) · `delivery_strategy: auto-chain` · `review_budget: 400` |
| Fecha | 2026-08-20 |
| Stack | Next.js 16 App Router · React 19 · TS strict · Prisma 6 · Supabase · Tailwind v4 · SweetAlert2 |

## Intent

Los filtros de la página de inventario no componen correctamente. El selector de sucursal es decorativo: la action `getProductsWithBranchStock` solo usa `branchId` en el `include` de stock (inventory.ts:239), el filtro real de productos por sucursal está encerrado en `if (opts.onlyWithStock)` (inventory.ts:212-219) y la página nunca manda `onlyWithStock` (page.tsx:54-59). Además, `BranchSelector` se usa no controlado en inventario (page.tsx:143-146), leyendo y escribiendo `BranchContext` mientras la página mantiene una copia local (`page.tsx:30`): dos fuentes de verdad que divergen. La categoría sí funciona (CategorySelector controlado, sin contexto); la percepción de "categoría rota" proviene de la composición AND rota por la sucursal (R3).

En paralelo, `MoveStockModal` es funcional pero aplica una cantidad GLOBAL a todos los productos seleccionados (MoveStockModal.tsx:89-97) mediante N llamadas no atómicas a `moveStockBetweenBranches` — una action de un solo producto (branchMovement.ts:10-21) — y su contenedor (`w-96 max-w-md rounded-lg bg-black/50`, líneas 113-114) no cumple STYLE.md. El objetivo es: (1) filtros AND correctos con sucursal controlada, (2) mover cantidades distintas por producto en una sola operación atómica, y (3) alinear la estética de los modales de stock y exportación al patrón de referencia (ProductForm/ExportWizard).

## Scope

### In Scope

- **Track A — Filtros**: corregir `getProductsWithBranchStock` para filtrar por `branchId` a nivel de producto (independiente de `onlyWithStock`) y usar en la página un filtro de sucursal controlado tipo `CategorySelector` (o `BranchSelector` en modo controlado), con opción "Todas". Composición AND `branchId` + `categoryId` + `search`.
- **Track B — Acción batch**: nueva action `moveStockBatchBetweenBranches` con validación zod del lote, verificación de stock de TODOS los ítems antes de escribir y un único `prisma.$transaction`. Se mantiene `moveStockBetweenBranches` sin cambios para compatibilidad. Extender `inventory.advanced.test.ts` con casos batch.
- **Track C — MoveStockModal**: rediseño a tabla editable (checkbox + nombre + stock disponible + input numérico por fila) con submit por array, sumario sticky, confirmación Swal y estética STYLE.md. Nuevo `MoveStockModal.test.tsx`.
- **Track D — ExportWizard**: agrandar el modal de `max-w-lg` a `max-w-xl` para la tabla de cantidades, manteniendo pasos, contrato y tests.

### Out of Scope

- Cambios de esquema de base de datos (sin migraciones Prisma).
- Refactor de acciones de compra/venta (`registerSale`, `createPurchaseWithBranchSplit`).
- Cambios de iconografía o reemplazo de librería de iconos.
- Portal externo de sucursal (`/sucursal/*`).
- Cambios en `moveStockBetweenBranches` (firma/comportamiento actuales intocables).

## Capabilities

### New Capabilities

- **`stock-movement`**
  - La acción `moveStockBatchBetweenBranches` SHALL aceptar `{ sourceBranchId: number, destBranchId: number, items: Array<{ productId: number, quantity: number }>, performedBy: string }`.
  - El lote SHALL validarse con zod antes de tocar la BD: `items` no vacío, sin `productId` duplicado, `quantity` entera ≥ 1, `sourceBranchId ≠ destBranchId`.
  - SHALL ejecutarse en UN solo `prisma.$transaction` (patrón existente línea 344).
  - SHALL verificar stock suficiente de TODOS los ítems en la sucursal origen ANTES de escribir; ante stock insuficiente parcial, SHALL abortar con rollback total y error identificando el producto.
  - SHALL decrementar stock en origen, incrementar en destino y crear los registros `BranchMovement` (TRANSFER) de todos los ítems, compartiendo una referencia de operación común para agrupar los movimientos del lote.
  - SHALL mantener `moveStockBetweenBranches` vigente sin cambios de firma (compatibilidad con callers y tests existentes).

### Modified Capabilities

- **`multi-location-inventory`** (modificada)
  - `getProductsWithBranchStock` SHALL filtrar productos por sucursal a nivel `where` (`where.inventory = { some: { branchId } }`) cuando se provea `branchId`, independiente de `onlyWithStock`.
  - `onlyWithStock` SHALL seguir siendo un toggle ortogonal (productos con stock > 0), combinable con `branchId`, `categoryId` y `search`.
  - El `include.inventory` SHALL continuar scoping el stock por la sucursal filtrada para que las columnas por sucursal sigan siendo correctas.

- **`inventory-ui`** (modificada)
  - La página `/inventario` SHALL usar un filtro de sucursal controlado (estado local de la página, sin escritura a `BranchContext`), replicando el patrón de `CategorySelector` con opción "Todas".
  - Los filtros SHALL componer en AND: `branchId` + `categoryId` + `search` (debounce existente), sin superponerse.
  - `MoveStockModal` SHALL alinearse a STYLE.md (bottom-sheet, `rounded-t-3xl`, blur, foco/CTA Rausch, volver en surface-soft) y SHALL permitir cantidad distinta por producto.

- **`branch-export-pdf`** (modificada)
  - `ExportWizard` SHALL ampliar su contenedor a `max-w-xl` conservando el contrato actual (3 pasos, action `getBranchProductsForExport({ branchId })`, `exportBranchProductsPdf`) y sin romper `ExportWizard.test.tsx`.

## Approach

### Track A — Filtros AND

1. **Action**: en `getProductsWithBranchStock` (inventory.ts:206-242), cuando `opts.branchId` esté presente mover el filtro al `where` raíz: `where.inventory = { some: { branchId } }` (combinable con `stock: { gt: 0 }` solo si `onlyWithStock`). Mantener el `include.inventory` scoped por sucursal.
2. **Página**: reemplazar el uso no controlado de `BranchSelector` (page.tsx:143-146) por uno controlado — `value={branchId}` + `onChange={setBranchId}` (el componente ya soporta modo controlado y no escribe contexto cuando recibe `value`, BranchSelector.tsx:17, 55-63) — o por un dropdown propio siguiendo el patrón `CategorySelector` (controlado, sin contexto, opción "Todas"). Fuente de verdad única: el estado local de la página que alimenta el effect de fetch.
3. Verificar que el effect (deps `[branchId, selectedCategoryId, debouncedSearch]`) dispare el refetch correcto y que el estado local no diverja del contexto global.

### Track B — Acción batch

1. Nuevo schema zod `moveStockBatchSchema` en `src/lib/validations/branchMovement.ts` (batch min 1 ítem, sin duplicados de `productId`, `quantity ≥ 1`, refine `sourceBranchId ≠ destBranchId`).
2. Nueva action `moveStockBatchBetweenBranches` en `src/app/actions/inventory.ts` junto a `moveStockBetweenBranches` (línea 338): un único `prisma.$transaction`, verificación previa de stock de todos los ítems (queries de `BranchInventory` por origen), decremento/incremento por ítem, creación de `BranchMovement` con referencia de operación común y `revalidatePath` en `/inventario` y `/movimientos`.
3. Extender `inventory.advanced.test.ts` con casos: batch válido (varios productos con cantidades distintas), stock insuficiente parcial → rollback total (ningún ítem modificado), referencias compartidas por operación, origen = destino rechazado. Mantener los 4 casos actuales intactos.
4. Recordatorio de despliegue: la transacción interactiva requiere session pooler; el runtime ya usa `:5432` (fix P2028 aplicado en `.env`) — replicar en la configuración del entorno de deploy.

### Track C — MoveStockModal

1. Fusión de los pasos 2 y 3 actuales en una **tabla editable** de productos del origen: por fila, checkbox (selección), nombre, stock disponible en origen, e input numérico (min 1, max = stock de esa fila) habilitado solo si el checkbox está marcado.
2. Validaciones por fila (cantidad requerida y dentro del rango) + error inline por fila; sumario sticky "N productos · M unidades" que actualiza en vivo; submit con `items: [{ productId, quantity }]` a `moveStockBatchBetweenBranches`.
3. Estética STYLE.md alineada a ProductForm/ExportWizard: overlay `bg-black/30 backdrop-blur-md z-[60] items-end`, contenedor `bg-white w-full max-w-lg (o max-w-xl) rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto`, header 44px circular, inputs/selects `rounded-xl` con foco Rausch (`focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20`), CTA Rausch 48px, botón volver en surface-soft, confirmación previa con Swal (tono Rausch).
4. Nuevo `src/app/inventario/components/MoveStockModal.test.tsx` (hoy el componente no tiene cobertura directa): selección múltiple, validación por fila, cálculo del sumario, submit con array, rechazo de cantidad > stock fila.

### Track D — ExportWizard

1. Cambiar el contenedor de `max-w-lg` a `max-w-xl` (ya es gold standard STYLE.md).
2. Revisar los pasos y el espacio de la tabla de cantidades para que el agrandado no deje la UI desbalanceada; mantener tests existentes en verde.

## Affected Areas

| Archivo | Impacto | Descripción |
|---|---|---|
| `src/app/actions/inventory.ts` | Modificado | `getProductsWithBranchStock` (206-258): filtro `branchId` a nivel `where`; nueva `moveStockBatchBetweenBranches` junto a la 338 (patrón `$transaction` línea 344) |
| `src/app/inventario/page.tsx` | Modificado | BranchSelector controlado (`value`/`onChange`, 143-146); eliminar divergencia de estado local vs BranchContext (30); deps del effect (53-86) ya cubren la composición AND |
| `src/app/inventario/components/InventoryFilters.tsx` | Modificado (menor) | Convivencia visual del filtro de sucursal con categoría y search |
| `src/app/inventario/components/MoveStockModal.tsx` | Modificado | Rediseño STYLE.md + tabla editable con cantidades por producto + submit con array |
| `src/app/inventario/components/MoveStockModal.test.tsx` | Nuevo | Cobertura del componente (sin tests hoy) |
| `src/components/ui/BranchSelector.tsx` | Modificado (menor) | Ya soporta modo controlado (17); validar uso y estética en inventario |
| `src/lib/validations/branchMovement.ts` | Modificado | Nuevo `moveStockBatchSchema` (zod) |
| `src/app/actions/inventory.advanced.test.ts` | Modificado | 4 casos actuales intactos + casos batch (válido, parcial→rollback, referencias compartidas, origen=destino) |
| `src/app/inventario/components/ExportWizard.tsx` (+ test) | Modificado | `max-w-lg` → `max-w-xl`; contrato y tests intactos |
| `.env` / despliegue | Config | Replicar session pooler `:5432` (fix P2028) en entorno de deploy para soportar `$transaction` interactiva |

## Risks

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Romper compatibilidad de `moveStockBetweenBranches` (callers/tests) | Baja | Mantener firma y comportamiento intactos; la nueva action es aditiva; correr `inventory.advanced.test.ts` |
| Atomicidad del batch ante stock insuficiente parcial | Media | Verificar TODOS los ítems ANTES de escribir dentro del `$transaction`; rollback total; error claro por producto |
| `$transaction` interactiva falla con pooler transaccional (P2028) | Media | Runtime ya usa session pooler `:5432`; replicar el fix en deploy y verificar el DSN |
| Validación de cantidad por fila divergente entre UI y backend | Media | Misma regla en UI (min 1, max stock fila) y en zod; test de stock insuficiente parcial |
| Cambio visual/props rompe tests existentes | Baja | No cambiar la firma de props de MoveStockModal ni de ExportWizard; actualizar snapshots si aplica |
| Divergencia local vs BranchContext tras pasar a controlado | Baja | Fuente única en el estado local de la página; `BranchSelector` con `value` no escribe contexto |

## Success Criteria

- [ ] `getProductsWithBranchStock` con `branchId` filtra productos a nivel `where`, independiente de `onlyWithStock` (inventory.advanced.test.ts).
- [ ] Filtro de sucursal controlado en `/inventario` con opción "Todas", patrón `CategorySelector`, sin escritura a `BranchContext`.
- [ ] Composición AND `branchId` + `categoryId` + `search` sin superposición ni doble fuente de verdad.
- [ ] `moveStockBatchBetweenBranches` atómica: un solo `$transaction`, validación zod del lote, verificación previa de stock, referencias compartidas por operación, origen = destino rechazado.
- [ ] `moveStockBetweenBranches` sin cambios (compatibilidad confirmada por tests).
- [ ] MoveStockModal permite cantidad POR PRODUCTO (p. ej. 3 del A y 7 del B en la misma operación) con sumario "N productos · M unidades".
- [ ] MoveStockModal y ExportWizard alineados a STYLE.md: bottom-sheet `max-w-lg`/`max-w-xl`, `rounded-t-3xl`, blur, foco/CTA Rausch, volver en surface-soft.
- [ ] Nuevo `MoveStockModal.test.tsx` y casos batch en `inventory.advanced.test.ts` en verde.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` verdes.