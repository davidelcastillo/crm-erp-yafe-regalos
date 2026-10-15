# Tasks: Fix filtros de inventario + cantidades por producto en MoveStockModal + estética STYLE.md

## Metadata

| Campo | Valor |
|-------|-------|
| Change ID | `fix-filtros-inventario-modales` |
| Preflight | `auto` · `hybrid` (OpenSpec + Engram) · `delivery_strategy: auto-chain` · `review_budget: 400` |
| Contrato | Design `openspec/changes/fix-filtros-inventario-modales/design/design.md`; deltas `multi-location-inventory`, `inventory-ui`, `stock-movement`, `branch-export-pdf` |
| Stack | Next.js 16 App Router · React 19 · TS strict · Prisma 6 · Supabase · Tailwind v4 · SweetAlert2 · zod v4 |
| Orden de implementación | A → B → C → D (A+B en PR1, C en PR2, D en PR3) |

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas estimadas (add+del) | **~690–750** (filtros ~15 · action batch ~90 · schema ~35 · BranchFilterDropdown ~90 · page.tsx ~10 · MoveStockModal ~200 · tests ~250 · mock tx/ajustes ~15) |
| Riesgo presupuesto 400 | **Alto** |
| Chained PRs recomendados | **Sí** |
| Split sugerido | **PR 1 (A+B) → PR 2 (C) → PR 3 (D)** — A+B comparten `inventory.ts`; C depende de B; D es de 1 línea |
| Delivery strategy | **auto-chain** |
| Chain strategy | **pending** (decisión de equipo: stacked-to-main vs feature-branch-chain) |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

> **Nota**: `auto-chain` → el orquestador no necesita `size:exception` para comenzar (Decision needed: **No**), pero **debe preguntar la chain strategy** antes de abrir el primer PR porque el forecast supera 400. Cada slice individual queda bajo 400 líneas.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|----|----------------------|-----------------|-------------------|
| **A+B** | Filtros AND (action `where` raíz + BranchFilterDropdown controlado en `/inventario`) + acción batch atómica `moveStockBatchBetweenBranches` con schema zod | PR 1 | `npx jest src/app/actions/inventory.advanced.test.ts` | `npm run dev`: en `/inventario` cambiar el filtro de sucursal (Todas → B1) y verificar que la lista se reduce a productos con fila en B1 sin depender de `onlyWithStock`; verificar que el dropdown y el fetch muestran el mismo valor | revert de `inventory.ts` (filtro + batch), `branchMovement.ts`, `BranchFilterDropdown.tsx`, `page.tsx` y el test — `moveStockBetweenBranches` intacta |
| **C** | MoveStockModal rediseñado a 2 pasos: tabla editable con cantidad por producto, sumario sticky "N productos · M unidades", Swal confirmación/error, estética STYLE.md | PR 2 | `npx jest src/app/inventario/components/MoveStockModal.test.tsx` (+ `inventory.advanced.test.ts` en verde) | `npm run dev`: abrir "Mover Stock" → origen → tabla con checkbox/nombre/stock/input por fila → ingresar 3 y 7 → sumario "2 productos · 10 unidades" → confirmar Swal → lista refetch; probar cantidad > stock (error inline `#c13515`, submit deshabilitado) | revert de `MoveStockModal.tsx` + su test — props intactas, sin cambios en acciones |
| **D** | ExportWizard ampliado a `max-w-xl` | PR 3 | `npx jest src/app/inventario/components/ExportWizard.test.tsx` | `npm run dev`: abrir "Exportar productos" → bottom-sheet más ancho, tabla de cantidades sin scroll horizontal ni desbalanceo | revert de `ExportWizard.tsx` (1 línea) |

## Phase 1: Filtros AND

**1.1 `src/app/actions/inventory.ts` — mover `branchId` al `where` raíz en `getProductsWithBranchStock`**
Desc: reemplazar el bloque `if (opts.onlyWithStock) { ... }` (líneas 212-219) por la lógica del design (design.md:26-53): cuando `opts.branchId` esté presente, `where.inventory = { some: { branchId, ...(opts.onlyWithStock ? { stock: { gt: 0 } } : {}) } }`; con `else if (opts.onlyWithStock)` sin branchId conservar `where.inventory = { some: { stock: { gt: 0 } } }`. NO tocar el `include.inventory` (234-240, ya scoped), la firma ni `getProductsWithBranchStockSchema` (198-204).
AC: con `{ branchId: 1 }` el `where` raíz contiene `inventory: { some: { branchId: 1 } }` sin predicado de stock; con `{ branchId: 1, onlyWithStock: true }` contiene `some: { branchId: 1, stock: { gt: 0 } }`; con `{}` no hay `where.inventory`.
Riesgos: mantener ortogonalidad (branchId independiente de onlyWithStock); no reescribir el include.
Deps: —.

**1.2 `src/components/ui/BranchFilterDropdown.tsx` — nuevo dropdown controlado tipo CategorySelector**
Desc: crear componente client (`"use client"`) con props `{ selectedId?: number | null, onValueChange?: (id: number | null) => void, onChange?: (id: number | null) => void, label?: string, disabled?: boolean }` (design.md:200-208). Carga `getBranchOptions()` en `useEffect` de mount (patrón CategorySelector.tsx:61-79), estado `open` con cierre por click-outside, opción "Todas las sucursales" (`→ null`) primero, filas seleccionadas con `bg-[#ff385c]/10 text-[#ff385c] font-medium`, trigger `bg-[#f8f8f8] rounded-xl min-h-[44px]`. **NO importar ni consumir `BranchContext`**.
AC: componente estrictamente controlado; sin referencia a `useBranch`/`BranchContext`; opción "Todas" emite `null`; filas activas en tono Rausch.
Riesgos: no reutilizar `BranchSelector` (siempre lee `BranchContext`, design.md:197); acento Rausch, no `#3b82f6`.
Deps: —.

**1.3 `src/app/inventario/page.tsx` — reemplazar BranchSelector no controlado por BranchFilterDropdown**
Desc: en el header (líneas 143-146) sustituir `<BranchSelector onChange={...}>` por `<BranchFilterDropdown selectedId={branchId} onValueChange={setBranchId} label="Stock por sucursal" />`; eliminar el import de `BranchSelector` (línea 14). Sin cambios de estado local (30), `fetchProducts` (53-64) ni deps del effect (86).
AC: única fuente de verdad = `branchId` local; el dropdown no escribe contexto; cambiar sucursal dispara el refetch con `branchId` correcto.
Riesgos: borrar el import y que quede una referencia huérfana (detectado por `tsc`); no tocar `onlyWithStock` en el fetch (la página no lo manda, comportamiento deseado).
Deps: 1.1, 1.2.

**1.4 `src/app/actions/inventory.advanced.test.ts` — 2 casos nuevos de filtro**
Desc: añadir al describe `getProductsWithBranchStock (Fase 3)`: (a) `{ branchId: 1 }` → `mockProductFindMany` llamado con `where.inventory = { some: { branchId: 1 } }` (sin `stock`); (b) `{ branchId: 1, onlyWithStock: true }` → `some: { branchId: 1, stock: { gt: 0 } }`; ambos con `expect.objectContaining`. Los 2 casos existentes (líneas 76-101) intactos.
AC: 2 describe nuevos pasando; los existentes sin edición y en verde.
Riesgos: —.
Deps: 1.1.## Phase 2: Acción batch

**2.1 `src/lib/validations/branchMovement.ts` — nuevo `moveStockBatchSchema` + tipo**
Desc: añadir aditivo (sin tocar `moveStockSchema`/`assignStockSchema`) el schema del design (design.md:84-108): objeto con `sourceBranchId`/`destBranchId` (`int().positive()`), `items` array `{ productId, quantity }` con `.min(1, "Seleccioná al menos un producto")` + `.refine` anti-duplicados ("No se permiten productos duplicados en el lote"), `performedBy` (`string().min(1).max(100)`) y `.refine` `sourceBranchId !== destBranchId` en `path: ["destBranchId"]`. Exportar `type MoveStockBatchValues = z.infer<typeof moveStockBatchSchema>`.
AC: el schema rechaza items vacío, duplicados, `quantity ≤ 0` o no entera, y origen = destino, con los mensajes exactos del design.
Riesgos: zod v4 `refine` sobre array (mismo API que el refine de objeto ya usado); mensajes exactos (los tests los asertan).
Deps: —.

**2.2 `src/app/actions/inventory.ts` — nueva action `moveStockBatchBetweenBranches`**
Desc: implementar junto a `moveStockBetweenBranches` (tras la 467) con firma del design (design.md:119-127): `(data: unknown) => Promise<{ success: boolean; data?: { reference, sourceBranchId, destBranchId, items: [{ productId, quantity, newSourceStock, newDestStock }] }; error?: string }>`. Flujo dentro de UN `prisma.$transaction(async (tx) => ...)` según pseudocódigo del design (129-182): (1) validar branches activas (`findFirst` ×2, throw "Sucursal de origen/destino inactiva o inexistente"); (2) validar productos activos (`product.findMany({ id: { in } })`, throw "Producto no encontrado o inactivo: ID X" si faltan, map nameByProductId); (3) leer stocks origen (`branchInventory.findUnique` ×N, throw "Stock insuficiente en origen para \"{nombre}\". Disponible: {a}, Requerido: {q}" si alguno < quantity); (4) leer stocks destino; (5) `reference = MOVE-${Date.now()}` común; (6) por ítem: upsert origen (−qty), upsert destino (+qty), `branchMovement.create` TRANSFER_OUT y TRANSFER_IN con `reference` y `performedBy`. Luego `revalidatePath("/inventario")` + `revalidatePath("/movimientos")` + `{ success: true, data: parseObject(result) }`. Manejo de errores igual a `moveStockBetweenBranches` (zod → join ", "; `Error` con "Stock insuficiente"/"inactiva"/"no encontrado" → mensaje directo; resto → log + "Error al mover stock entre sucursales"). **Duplicación controlada**: NO refactorizar `moveStockBetweenBranches` ni extraer helpers compartidos.
AC: un solo `$transaction`; verificación completa de TODOS los ítems antes del primer `upsert`; cualquier throw aborta con rollback total; 4 BranchMovement con la misma reference; `moveStockBetweenBranches` intacta.
Riesgos: P2028 en `$transaction` interactiva (requiere session pooler `:5432` — cubierto en 4.2); escribir antes de validar (orden de pasos estricto).
Deps: 2.1.

**2.3 `src/app/actions/inventory.advanced.test.ts` — 4 casos batch**
Desc: ampliar el mock de `tx` (líneas 47-62) agregando `product: { findMany: (...a) => mockProductFindMany(...a) }`. Añadir describe `moveStockBatchBetweenBranches`: (1) **batch válido** — A (stock 10, qty 3) y B (stock 15, qty 7) → `upsert` llamada 4 veces con nuevos stocks correctos y `branchMovement.create` 4 veces, todas con la misma reference `/^MOVE-/` y `performedBy`; (2) **stock insuficiente parcial** — A disponible 2 requerido 5, B stock 10 → error contiene nombre de producto y "Disponible: 2, Requerido: 5", `upsert` y `create` NO llamados (rollback total); (3) **origen = destino** → zod rechaza y `$transaction` NO llamado; (4) **items vacío / productId duplicado / quantity 0** → zod rechaza sin abrir transacción. Mocks de `branchInventory.findUnique` encadenados por ítem (`mockResolvedValueOnce`). Los 4 casos de `moveStockBetweenBranches` + 3 de `assignStockToBranch` + 2 de `getBranchMovements` intactos.
AC: 4 nuevos casos verdes + suite completa de regresión del archivo en verde.
Riesgos: orden de los `mockResolvedValueOnce` (origen y destino por ítem) debe coincidir con el orden de iteración del lote.
Deps: 2.2.## Phase 3: MoveStockModal rediseño

**3.1 `src/app/inventario/components/MoveStockModal.tsx` — reescritura a 2 pasos con tabla editable**
Desc: reescribir el componente manteniendo `MoveStockModalProps` intactas (`open`, `onClose`, `productId`, `branches`, `onConfirm`). Step 1 = origen (`getBranchInventory({ branchId })` carga `productOptions: { id, name, stock }[]`); Step 2 = destino + tabla editable (checkbox `w-5 h-5 accent-[#ff385c]`, nombre, stock origen, input numérico `min={1}` `max={p.stock}` habilitado solo si su checkbox está marcado; al desmarcar borrar la entrada de `quantities`). Estado según design (228-243): `step: 1|2`, `sourceBranchId`, `destBranchId`, `productOptions`, `selectedIds`, `quantities: Record<number,string>`, `rowErrors`, `pending`, `error`. Derivados `useMemo`: sumario `{ count, total }` y `isValid` (selección > 0 y cada cantidad entera ≥ 1 ≤ stock fila). Validación en vivo con error inline `text-xs text-[#c13515]` por fila; sumario sticky "N productos · M unidades"; submit deshabilitado si `!isValid`. Submit: `Swal.fire` confirmación ("¿Mover stock?", html "N productos · M unidades", icono `warning`, `confirmButtonColor: "#ff385c"`, `cancelButtonColor: "#6a6a6a"`, `background: "#ffffff"`, `color: "#222222"`) → si confirmado, payload `{ sourceBranchId, destBranchId, performedBy: "admin", items: selectedRows.map(p => ({ productId: p.id, quantity: parseInt(quantities[p.id], 10) })) }` → `moveStockBatchBetweenBranches(payload)`; éxito → `onClose()` + `onConfirm()`; error → Swal de error con el mensaje del backend y el modal permanece abierto sin cambios locales. CTA "Moviendo…" con `disabled={pending}`. **Eliminar `useFormStatus`/`formPending`**. Estética STYLE.md exacta del design (282-294): overlay `fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-end justify-center`, contenedor `bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto`, header 44px circular, selects `rounded-xl` con foco Rausch, CTA `bg-[#ff385c]` 48px, volver `bg-[#f8f8f8]` (surface-soft).
AC: 2 pasos; cantidad distinta por producto en un mismo lote; sumario en vivo; error inline por fila; submit con array; confirmación y error Swal; props intactas; sin `useFormStatus`.
Riesgos: cambiar la firma de props (prohibido); divergencia UI/backend en regla de cantidad (min 1 / max stock fila, misma regla que zod).
Deps: 2.2.
**Estado**: ✅ completado (PR2)

**3.2 `src/app/inventario/components/MoveStockModal.test.tsx` — nuevo (7 casos del spec)**
Desc: crear test (`@jest-environment jsdom`) mockeando `@/app/actions/inventory` (`moveStockBatchBetweenBranches`, `getBranchInventory`) y `sweetalert2` (patrón `ExportWizard.test.tsx`), con `fireEvent` + `waitFor`: (1) selección múltiple habilita inputs y calcula sumario; (2) validación por fila (cantidad > stock fila → error inline y submit deshabilitado); (3) sumario "2 productos · 10 unidades" con cantidades 3 y 7; (4) submit envía `items: [{ productId: A, quantity: 3 }, { productId: B, quantity: 7 }]` a `moveStockBatchBetweenBranches`; (5) checkbox desmarcado deshabilita el input y excluye la fila del sumario/array; (6) error de backend → `Swal.fire` con nombre del producto y modal abierto (no llama `onClose`); (7) confirmación Swal requerida antes del submit (cancelar no llama la action).
AC: 7 casos en verde; sin cobertura previa del componente.
Riesgos: mocks de `sweetalert2` deben resolver el `isConfirmed` según el escenario.
Deps: 3.1.
**Estado**: ✅ completado (PR2)

## Phase 4: ExportWizard + cierre

**4.1 `src/app/inventario/components/ExportWizard.tsx` — contenedor a `max-w-xl`**
Desc: en la línea 168 cambiar `max-w-lg` → `max-w-xl`, conservando el resto de la cadena (`bg-white w-full rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto`) y el overlay. NO tocar pasos, actions, props ni regla stock > 0. Verificar `ExportWizard.test.tsx` en verde sin cambios de aserción (`toHaveBeenCalledWith({ branchId: 1 })`, 2 checkboxes con stock > 0); actualizar snapshot solo si existiera (no hay; usa `getByText`).
AC: 1 línea cambiada; `ExportWizard.test.tsx` verde sin editar.
Riesgos: —.
Deps: —.

**4.2 Checklist de deploy — replicar session pooler `:5432`**
Desc: verificar que el DSN del entorno de despliegue replica el fix P2028 ya aplicado en `.env` (session pooler en puerto `:5432`, NO pooler transaccional `:6543`) para que la `$transaction` interactiva del batch funcione en producción. Registrar la confirmación en el PR2/PR3 según corresponda.
AC: `DATABASE_URL` del entorno de deploy apunta a `:5432`; acción batch probada en deploy sin P2028.
Riesgos: P2028 en producción (la acción batch falla aunque funcione local).
Deps: 2.2 (aplica a batch en prod).

**4.3 Suite completa antes de `sdd-verify`**
Desc: ejecutar en orden: `npm test` → `npx tsc --noEmit` → `npm run lint` → `npm run build`. Todos en verde con el cambio completo.
AC: 4 comandos sin errores; `npm test` incluye `inventory.advanced.test.ts`, `MoveStockModal.test.tsx` y `ExportWizard.test.tsx`.
Riesgos: —.
Deps: 1.1-4.1.

## Delivery Plan

- **Estrategia**: `auto-chain` con split por PR (A+B → C → D). Cada PR es una unidad autónoma con inicio, fin, verificación y rollback propios (tabla *Suggested Work Units*). **Chain strategy pendiente de decisión del equipo** antes de abrir PR1: **stacked-to-main** (cada PR a main en orden) o **feature-branch-chain** (PR1 base = tracker branch, PR2 base = PR1, PR3 base = PR2; solo el tracker mergea a main). No mezclar estrategias.
- **Commits por unidad de trabajo** (tests y docs junto al código que verifican; conventional commits):
  - **PR1 (A+B)**:
    1. `feat(inventory): filtrar productos por branchId a nivel where en getProductsWithBranchStock` (+ tests de filtro 1.4)
    2. `feat(ui): BranchFilterDropdown controlado tipo CategorySelector sin BranchContext` (+ uso en `/inventario` 1.3)
    3. `feat(stock-movement): action moveStockBatchBetweenBranches atomica con schema zod` (+ `moveStockBatchSchema` 2.1 + tests batch 2.3)
  - **PR2 (C)**:
    4. `refactor(inventario): MoveStockModal a 2 pasos con cantidades por producto y estetica STYLE.md` (+ `MoveStockModal.test.tsx`)
  - **PR3 (D)**:
    5. `style(export): ampliar contenedor de ExportWizard a max-w-xl` (+ verificación de test)
- **Qué se espera de cada PR**: diff limpio y enfocado (A+B solo toca `inventory.ts`, `branchMovement.ts`, `BranchFilterDropdown.tsx`, `page.tsx` y tests; C solo el modal + su test; D 1 línea), verificación de tests enfocados + harness manual registrado, y rollback reversible sin tocar `moveStockBetweenBranches` ni las props públicas.
- **Gate de verificación final**: tarea 4.3 antes de `sdd-verify`; checklist de deploy 4.2 antes del release.