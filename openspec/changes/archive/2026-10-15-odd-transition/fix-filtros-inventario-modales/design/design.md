# Design: Fix filtros de inventario + cantidades por producto en MoveStockModal + estética STYLE.md

## Metadata

| Campo | Valor |
|---|---|
| Change ID | `fix-filtros-inventario-modales` |
| Preflight | `auto` · `hybrid` · `delivery_strategy: auto-chain` · `review_budget: 400` |
| Contrato | Proposal `openspec/changes/fix-filtros-inventario-modales/proposal.md`; deltas `multi-location-inventory`, `inventory-ui`, `stock-movement`, `branch-export-pdf` |
| Stack | Next.js 16 App Router · React 19 · TS strict · Prisma 6 · Supabase · Tailwind v4 · SweetAlert2 · zod v4 |
| Fuente de evidencia | `exploration.md` (causas R1/R2/R3) + código verificado en disco (inventory.ts:198-258, 338-467; page.tsx:30,53-86,143-146; BranchSelector.tsx:17,32-63; MoveStockModal.tsx; ExportWizard.tsx:161-168; STYLE.md) |

## Technical Approach

Estrategia global: **aditiva y de menor riesgo por capability**. Los 4 tracks son independientes y encadenables: Track A (filtros) y Track B (acción batch) son prerrequisitos de Track C (modal), y Track D es cosmético aislado. No hay migraciones de esquema. El orden de implementación sugerido para el chaining es `A → B → C → D`, donde A y B pueden ir juntos en el primer slice (mismo archivo `inventory.ts`) y D es un slice independiente de 1 línea.

### Decisión de arquitectura por capability

#### `multi-location-inventory` — filtro de sucursal a nivel `where`

**Problema**: hoy `branchId` solo se aplica en el `include.inventory` (inventory.ts:239) y el filtro real de productos vive dentro de `if (opts.onlyWithStock)` (inventory.ts:212-219). La página nunca envía `onlyWithStock` (page.tsx:54-59), por lo que la sucursal nunca reduce la lista (causa R1).

**Solución**: reestructurar el armado del `where` en `getProductsWithBranchStock` (inventory.ts:209-227) para que `branchId` sea un predicado raíz ortogonal:

```ts
// inventory.ts — dentro de getProductsWithBranchStock, reemplazo de 209-227
const where: Record<string, unknown> = {};
if (opts.activeOnly !== false) where.active = true;
if (opts.categoryId) where.categoryId = opts.categoryId;

// Filtro de sucursal a nivel where, INDEPENDIENTE de onlyWithStock.
// El producto se devuelve si tiene al menos una fila BranchInventory en la
// sucursal (incluye filas con stock 0). onlyWithStock añade stock > 0 en AND.
if (opts.branchId) {
  where.inventory = {
    some: {
      branchId: opts.branchId,
      ...(opts.onlyWithStock ? { stock: { gt: 0 } } : {}),
    },
  };
} else if (opts.onlyWithStock) {
  // Comportamiento previo sin branchId: solo productos con stock > 0
  where.inventory = { some: { stock: { gt: 0 } } };
}

if (opts.search) {
  where.OR = [
    { name: { contains: opts.search, mode: "insensitive" } },
    { code: { contains: opts.search, mode: "insensitive" } },
    { description: { contains: opts.search, mode: "insensitive" } },
    { category: { name: { contains: opts.search, mode: "insensitive" } } },
  ];
}
```

El `include.inventory` (inventory.ts:234-240) **no se modifica**: ya está scoped por `branchId` cuando este se provee y conserva `orderBy: { branchId: "asc" }` en caso contrario, cumpliendo el requisito 3 del delta sin tocar esa sección.

**Firma y tipos** (sin cambios — requisito 5 del delta):

```ts
export async function getProductsWithBranchStock(filters?: unknown): Promise<{
  success: boolean;
  data?: unknown;    // parseArray(products)
  error?: string;
}>
// Schema de entrada: getProductsWithBranchStockSchema (inventory.ts:198-204) intacto:
// { categoryId?, branchId?, activeOnly?, search?, onlyWithStock? } — todos opcionales
```

Se conserva `Record<string, unknown>` para el `where` (patrón existente; evita importar `Prisma.ProductWhereInput` y minimiza el diff; los tests usan `expect.objectContaining`, por lo que el tipo no condiciona las aserciones).

| Opción | Tradeoff | Decisión |
|---|---|---|
| Mover el filtro al `where` raíz (propuesta) | Cumple el delta; independiza branchId de onlyWithStock | **Elegida** |
| Seguir filtrando solo en el include | No filtra productos (causa R1); no cumple spec | Rechazada |
| Hacer la composición en cliente (InventarioList) | Mueve lógica de datos al UI; duplica la source de verdad; rompe el patrón server-driven de búsqueda | Rechazada |

#### `stock-movement` — acción batch atómica

**Problema**: `moveStockBetweenBranches` es single-product (branchMovement.ts:10-21) y el modal la invoca en un bucle de N llamadas no atómicas (MoveStockModal.tsx:89-97): si la llamada 3 falla, las 2 anteriores ya se escribieron.

**Schema zod** (`src/lib/validations/branchMovement.ts`, aditivo — no toca `moveStockSchema`):

```ts
export const moveStockBatchSchema = z
  .object({
    sourceBranchId: z.number().int().positive("Sucursal origen requerida"),
    destBranchId: z.number().int().positive("Sucursal destino requerida"),
    items: z
      .array(
        z.object({
          productId: z.number().int().positive("Producto inválido"),
          quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
        })
      )
      .min(1, "Seleccioná al menos un producto")
      .refine(
        (items) => new Set(items.map((i) => i.productId)).size === items.length,
        { message: "No se permiten productos duplicados en el lote" }
      ),
    performedBy: z.string().min(1, "El responsable es requerido").max(100),
  })
  .refine((d) => d.sourceBranchId !== d.destBranchId, {
    message: "Las sucursales de origen y destino deben ser distintas",
    path: ["destBranchId"],
  });

export type MoveStockBatchValues = z.infer<typeof moveStockBatchSchema>;
```

Validaciones y mensajes por producto/campo (cumple requisito 2 del delta):
- `items` vacío → "Seleccioná al menos un producto" (rechaza antes de abrir transacción).
- `productId` duplicado → "No se permiten productos duplicados en el lote".
- `quantity` 0 o negativa o no entera → "La cantidad debe ser mayor a 0".
- `sourceBranchId === destBranchId` → "Las sucursales de origen y destino deben ser distintas" (en `path: ["destBranchId"]`).

**Firma de la action** (en `src/app/actions/inventory.ts`, junto a la línea 338):

```ts
export async function moveStockBatchBetweenBranches(data: unknown): Promise<{
  success: boolean;
  data?: { reference: string; sourceBranchId: number; destBranchId: number;
           items: Array<{ productId: number; quantity: number;
                           newSourceStock: number; newDestStock: number }> };
  error?: string;
}>
```

**Pseudocódigo del flujo dentro del `$transaction`** (mismo patrón que inventory.ts:344):

```
prisma.$transaction(async (tx) => {
  1. Validar sucursales activas
     [sourceBranch, destBranch] = Promise.all(
       tx.branch.findFirst({ where: { id: sourceBranchId, isActive: true }, select: { id } }),
       tx.branch.findFirst({ where: { id: destBranchId,   isActive: true }, select: { id } })
     )
     if (!sourceBranch) throw "Sucursal de origen inactiva o inexistente"
     if (!destBranch)   throw "Sucursal de destino inactiva o inexistente"

  2. Validar productos activos (TODOS)
     productIds = items.map(i => i.productId)
     products = tx.product.findMany({ where: { id: { in: productIds }, active: true },
                                      select: { id, name } })
     if (products.length !== items.length)
       missing = primer productId del lote no encontrado
       throw `Producto no encontrado o inactivo: ID ${missing}`
     nameByProductId = Map(products.map(p => [p.id, p.name]))

  3. Leer stocks de TODOS los ítems en origen (sin escribir)
     originRows = Promise.all(items.map(i =>
       tx.branchInventory.findUnique({ where: { branchId_productId: { branchId: sourceBranchId, productId: i.productId } } })
     ))
     for each item i:
       available = originRows[i]?.stock ?? 0
       if (available < i.quantity)
         throw `Stock insuficiente en origen para "${nameByProductId.get(i.productId)}". Disponible: ${available}, Requerido: ${i.quantity}`

  4. Leer stocks de destino (para calcular nuevos valores, sin escribir)
     destRows = Promise.all(items.map(i =>
       tx.branchInventory.findUnique({ where: { branchId_productId: { branchId: destBranchId, productId: i.productId } } })
     ))

  5. reference = `MOVE-${Date.now()}`  // común a TODO el lote

  6. Por ítem (orden del lote):
       newSourceStock = (originRows[i]?.stock ?? 0) - i.quantity
       newDestStock   = (destRows[i]?.stock ?? 0)   + i.quantity
       tx.branchInventory.upsert( origen,  create/update: { stock: newSourceStock } )
       tx.branchInventory.upsert( destino, create/update: { stock: newDestStock } )
       tx.branchMovement.create({ branchId: sourceBranchId, movementType: "TRANSFER_OUT",
                                  quantity: i.quantity, reference, performedBy })
       tx.branchMovement.create({ branchId: destBranchId,   movementType: "TRANSFER_IN",
                                  quantity: i.quantity, reference, performedBy })

  return { reference, sourceBranchId, destBranchId,
           items: [ { productId, quantity, newSourceStock, newDestStock } ... ] }
})

revalidatePath("/inventario"); revalidatePath("/movimientos");
return { success: true, data: parseObject(result) }
```

**Manejo de errores** (misma convención que `moveStockBetweenBranches`, inventory.ts:448-466): zod → mensajes unidos por `, `; `Error` con "Stock insuficiente" / "inactiva" / "no encontrado" → mensaje directo; resto → log + "Error al mover stock entre sucursales".

**Convivencia con `moveStockBetweenBranches`**: se recomienda **duplicación controlada** (opción de menor riesgo). El requisito 8 del delta exige que `moveStockBetweenBranches` permanezca intacta en firma y comportamiento; un refactor compartido de helpers (verificar branches, leer stocks, upsert) tocaría su cuerpo y reabriría los 4 tests existentes a riesgo de regresión. La duplicación es acotada (~40 líneas), replica exactamente el patrón probado (mismos mensajes, mismo formato `MOVE-${Date.now()}`, mismo upsert), y un refactor a helpers compartidos puede hacerse después en un change aparte si se desea.

| Opción | Tradeoff | Decisión |
|---|---|---|
| Duplicación controlada del flujo en la nueva action | ~40 líneas repetidas; riesgo cero sobre la action existente | **Elegida** |
| Extraer helpers compartidos (assertActiveBranches, readStocks) | DRY; pero modifica el cuerpo de `moveStockBetweenBranches` → riesgo de regresión y viola el requisito de intocabilidad | Rechazada |

#### `inventory-ui` — filtro controlado + rediseño del modal

**Filtro de sucursal: `BranchFilterDropdown` nuevo (patrón `CategorySelector`), NO `BranchSelector` controlado.**

Evidencia que descarta reusar `BranchSelector`: aunque soporta modo controlado (`value?: number | null`, BranchSelector.tsx:17; `handleSelect` solo escribe contexto cuando `value === undefined`, líneas 55-63), **siempre lee** `useBranch()` (línea 32) para obtener `branches`, `ready` y `contextBranchId`. El requisito 1 del delta dice textualmente "El selector SHALL NOT leer ni escribir `BranchContext` cuando se usa en modo controlado", por lo que reutilizar `BranchSelector` violaría la spec. Además, sus filas activas usan acento azul `#3b82f6` (líneas 107, 121) — fuera de STYLE.md (Rausch). Un componente propio elimina ambas objeciones y replica el contrato controlado probado de `CategorySelector`.

```tsx
// src/components/ui/BranchFilterDropdown.tsx (NUEVO)
export interface BranchFilterDropdownProps {
  selectedId?: number | null;              // null = "Todas"
  onValueChange?: (id: number | null) => void;
  onChange?: (id: number | null) => void;  // alias legacy, igual que CategorySelector
  label?: string;
  disabled?: boolean;
}
```

Comportamiento: carga `getBranchOptions()` en `useEffect` de mount (patrón CategorySelector.tsx:61-79), estado local `open` con cierre por click-outside, dropdown `absolute z-50 ... min-w-[200px]` con opción **"Todas las sucursales"** (→ `null`) primero, filas Rausch (`bg-[#ff385c]/10 text-[#ff385c] font-medium` cuando está seleccionado, igual que CategorySelector.tsx:220-241), y botón trigger `bg-[#f8f8f8] rounded-xl min-h-[44px]`. **No importa ni consume `BranchContext`**.

**Estructura de estado de `page.tsx`** (fuente única + limpieza):

- `branchId` (page.tsx:30) ya es el estado local que alimenta el effect (deps `[branchId, selectedCategoryId, debouncedSearch, fetchProducts]`, page.tsx:86). Solo cambia el wiring del selector: `value={branchId}` + `onValueChange={setBranchId}` en lugar del `BranchSelector` no controlado (page.tsx:143-146).
- Con el nuevo componente, el dropdown y el estado de fetch leen la **misma variable**: se elimina la doble fuente de verdad R2.
- **Limpieza al cambiar ruta**: en App Router la página es un Client Component que se desmonta al navegar a otra ruta, por lo que el estado local se reinicia naturalmente. No se requiere limpieza explícita ni persistencia (misma decisión que BranchContext.tsx:91-97: la selección no se persiste entre páginas).
- `fetchProducts` (page.tsx:53-64) y el effect NO cambian: ya componen AND correctamente una vez que la action filtra por sucursal.

**Rediseño de `MoveStockModal`: 2 pasos (recomendado).**

Se fusionan los pasos 2 y 3 actuales en una única pantalla con **tabla editable + destino**, porque la cantidad por producto es intrínseca a la selección de productos (no tiene sentido elegir cantidades en una pantalla separada del catálogo). Resultado: Step 1 = origen; Step 2 = destino + tabla de productos con checkbox/nombre/stock/input + sumario sticky + CTA. Menos taps, misma información, alineado a la propuesta ("fusión de los pasos 2 y 3", proposal approach Track C.1).

| Opción | Tradeoff | Decisión |
|---|---|---|
| 2 pasos (origen → destino + tabla editable) | Menos navegación; cantidades junto a los productos; destino es solo un select | **Elegida** |
| 3 pasos (mantener estructura actual) | Misma cantidad de taps que hoy; la pantalla de cantidades sin contexto de productos | Rechazada |

**Estado del modal** (tipos):

```tsx
type MovableProduct = { id: number; name: string; stock: number };
type Step = 1 | 2;

const [step, setStep] = useState<Step>(1);
const [sourceBranchId, setSourceBranchId] = useState<number | null>(null);
const [destBranchId, setDestBranchId] = useState<number | null>(null);
const [productOptions, setProductOptions] = useState<MovableProduct[]>([]); // getBranchInventory (stock > 0)
const [selectedIds, setSelectedIds] = useState<number[]>([]);               // checkboxes
const [quantities, setQuantities] = useState<Record<number, string>>({});   // productId -> string (input)
const [rowErrors, setRowErrors] = useState<Record<number, string>>({});     // productId -> mensaje
const [pending, setPending] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Derivados por `useMemo` (sin estado redundante):

```tsx
const selectedRows = productOptions.filter(p => selectedIds.includes(p.id));
const summary = useMemo(() => ({
  count: selectedRows.length,
  total: selectedRows.reduce((acc, p) => acc + (parseInt(quantities[p.id], 10) || 0), 0),
}), [selectedRows, quantities]);

const isValid = selectedRows.length > 0 && selectedRows.every(p => {
  const q = parseInt(quantities[p.id], 10);
  return Number.isInteger(q) && q >= 1 && q <= p.stock;
});
```

Reglas por fila: input `disabled` si su checkbox no está marcado (requisito 3 del delta); al desmarcar se borra su entrada de `quantities` para que no cuente en el sumario ni en el array del submit (escenario "Checkbox desmarcado deshabilita el input"); validación en vivo con error inline `text-[#c13515]` (token de error STYLE.md) cuando la cantidad excede el stock de la fila o no es entera ≥ 1; submit deshabilitado si `!isValid`.

**Payload de submit y manejo de estados**:

```tsx
const payload = {
  sourceBranchId: sourceBranchId!,        // garantizado en step 2
  destBranchId: destBranchId!,
  performedBy: "admin",                    // TODO: desde auth context (igual que el código actual, MoveStockModal.tsx:95)
  items: selectedRows.map(p => ({
    productId: p.id,
    quantity: parseInt(quantities[p.id], 10),
  })),
}; // shape MoveStockBatchValues → moveStockBatchBetweenBranches
```

Flujo: 1) `Swal.fire` de confirmación (título "¿Mover stock?", `html` con "N productos · M unidades", icono `warning`, `confirmButtonColor: "#ff385c"`, `cancelButtonColor: "#6a6a6a"`, `background: "#ffffff"`, `color: "#222222"`); 2) si confirmado → `setPending(true)` + llamada a la action; 3) éxito → `onClose()` + `onConfirm()` (refetch de la lista, patrón actual MoveStockModal.tsx:99-100); 4) error → `Swal.fire` de error con el mensaje del backend (nombre del producto + disponible/requerido) y el modal **permanece abierto** sin aplicar cambios locales (requisito 5 del delta). El CTA muestra "Moviendo…" con `disabled={pending}`. Se elimina `useFormStatus`/`formPending` (innecesario: el modal no es un `<form>` con action).

**Clases STYLE.md exactas** (patrón ProductForm.tsx:151-169 / ExportWizard.tsx:161-181):

| Elemento | Clases |
|---|---|
| Overlay | `fixed inset-0 bg-black/30 backdrop-blur-md z-[60] flex items-end justify-center` |
| Contenedor | `bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto` (con `onClick={e => e.stopPropagation()}`) |
| Título | `text-xl font-semibold text-[#222222]` |
| Botón cerrar (44px circular) | `w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#f2f2f2] transition-colors touch-manipulation` |
| Label | `block text-xs text-[#6a6a6a] mb-2` |
| Selects (origen/destino) | `w-full px-3 py-3 min-h-[48px] rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all text-sm touch-manipulation` |
| Input numérico por fila | `w-20 px-3 py-2 rounded-xl border border-gray-200 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 outline-none transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed` |
| Checkbox | `w-5 h-5 accent-[#ff385c]` |
| Fila | `flex items-center gap-3 p-3 min-h-[44px] rounded-xl hover:bg-[#f8f8f8] transition-colors` |
| Error inline por fila | `text-xs text-[#c13515]` |
| Sumario sticky | `sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-[#ebebeb] py-3 flex items-center justify-between z-10` — texto `text-sm font-semibold text-[#222222]` ("N productos · M unidades") |
| CTA primario | `w-full py-4 min-h-[48px] bg-[#ff385c] text-white font-medium rounded-xl hover:bg-[#e00b41] transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation` |
| Volver (surface-soft) | `px-4 py-3 min-h-[44px] text-sm font-medium text-[#222222] bg-[#f8f8f8] rounded-xl hover:bg-[#f2f2f2] transition-colors touch-manipulation` |

La firma de props (`open`, `onClose`, `productId`, `branches`, `onConfirm`) se conserva intacta (requisito 7 del delta); `productId` sigue siendo prop inerte "para compatibilidad".

#### `branch-export-pdf` — contenedor ampliado

Cambio mínimo de **una línea**: en `ExportWizard.tsx:168` reemplazar `max-w-lg` por `max-w-xl`, conservando el resto de la cadena (`bg-white w-full rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto`) y el overlay con blur. No se tocan los 3 pasos, las actions (`getBranchProductsForExport({ branchId })`, `exportBranchProductsPdf`), la regla de stock > 0, la firma de props ni el contrato del wizard (requisitos 2-4 del delta). Con el ancho adicional, la tabla de cantidades del paso 2 se distribuye sin desbalanceo ni scroll horizontal (requisito 5, SHOULD): las columnas nombre/código/stock conservan su espaciado actual y el checkbox mantiene `w-5 h-5 accent-[#ff385c]`.

## Data Flow

### Filtros de inventario (estado → effect → action → render)

```
BranchFilterDropdown ──onValueChange──▶ setBranchId (page.tsx estado local, fuente única)
InventoryFilters ──onFilterChange──▶ setSelectedCategoryId
InventoryFilters ──onSearchChange──▶ setSearch ──(300ms debounce)──▶ setDebouncedSearch
                                            │
                                            ▼
              useEffect [branchId, selectedCategoryId, debouncedSearch, fetchProducts]
                                            │
                                            ▼
        getProductsWithBranchStock({ branchId?, categoryId?, search?, activeOnly: true })
                                            │
         where = { active: true,
                   categoryId?,                        (AND)
                   inventory: { some: { branchId?,     (AND, si branchId)
                                        stock: { gt: 0 } } },   (AND, solo si onlyWithStock)
                   OR: [name/code/description/category contains search] }  (si search)
                                            │
                                            ▼
                    prisma.product.findMany (include.inventory scoped por branchId)
                                            │
                                            ▼
                        setProducts → InventarioList → InventarioCard (sumStock por fila scoped)
```

### Batch move (UI → action → transaction → DB → revalidate)

```
MoveStockModal (Step 2: tabla editable + sumario sticky)
  │  CTA "Mover Stock" (deshabilitado si !isValid)
  ▼
Swal.fire confirmación (Rausch) ──isConfirmed──▶
  ▼
moveStockBatchBetweenBranches({ sourceBranchId, destBranchId,
                                items: [{ productId, quantity }], performedBy })
  │  zod: moveStockBatchSchema (items≥1, sin dups, qty≥1 entera, src≠dst) → rechaza sin tocar BD
  ▼
prisma.$transaction(async tx => {
  1. branches activas (findFirst ×2)          ──fail──▶ throw
  2. productos activos (findMany in ids)      ──fail──▶ throw
  3. stocks origen (findUnique ×N) + validar TODOS ≥ qty  ──fail──▶ throw (rollback total)
  4. stocks destino (findUnique ×N)
  5. por ítem: upsert origen(−qty) → upsert destino(+qty)
     → BranchMovement TRANSFER_OUT + TRANSFER_IN (reference común MOVE-<ts>, performedBy)
})
  │  throw  ──▶ rollback total: ningún BranchInventory modificado, ninguna BranchMovement creada
  ▼
success ──▶ revalidatePath("/inventario") + revalidatePath("/movimientos")
  ──▶ { success: true, data } ──▶ modal: onClose() + onConfirm() ──▶ page refetch
error  ──▶ Swal error con nombre del producto ──▶ modal permanece abierto, sin cambios locales
```

## Component/File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `src/app/actions/inventory.ts` | Modificar | `getProductsWithBranchStock` (206-258): mover `branchId` al `where` raíz (ortogonal a `onlyWithStock`); nueva `moveStockBatchBetweenBranches` junto a la 338 (patrón `$transaction` línea 344); importar `moveStockBatchSchema` de `@/lib/validations/branchMovement` |
| `src/lib/validations/branchMovement.ts` | Modificar | Nuevo `moveStockBatchSchema` + tipo `MoveStockBatchValues`; `moveStockSchema`/`assignStockSchema` intactos |
| `src/components/ui/BranchFilterDropdown.tsx` | Crear | Dropdown controlado tipo `CategorySelector` (props `selectedId`/`onValueChange`/`onChange`/`label`/`disabled`), opción "Todas", carga propia vía `getBranchOptions`, sin `BranchContext`, acento Rausch |
| `src/app/inventario/page.tsx` | Modificar | Reemplazar `BranchSelector` no controlado (143-146) por `BranchFilterDropdown` controlado (`selectedId={branchId}` + `onValueChange={setBranchId}`); eliminar import de `BranchSelector`; sin otros cambios de estado ni deps |
| `src/app/inventario/components/MoveStockModal.tsx` | Modificar | Rediseño a 2 pasos + tabla editable con cantidad por producto + validación por fila + sumario sticky + submit con array a `moveStockBatchBetweenBranches` + confirmación/error Swal + estética STYLE.md; props intactas |
| `src/app/inventario/components/MoveStockModal.test.tsx` | Crear | Tests del componente (7 casos del spec) |
| `src/app/actions/inventory.advanced.test.ts` | Modificar | Agregar `product.findMany` al mock de `tx` (líneas 47-62); casos nuevos de filtro (2) y batch (4); los 4 casos existentes de `moveStockBetweenBranches` intactos |
| `src/app/inventario/components/ExportWizard.tsx` | Modificar | `max-w-lg` → `max-w-xl` en el contenedor (línea 168); sin cambios de contrato ni lógica |
| `src/app/inventario/components/InventoryFilters.tsx` | Sin cambios (o cosmético menor) | Sigue alojando categoría + search; el filtro de sucursal vive en el header de la página; ajuste opcional de espaciado para convivencia visual |
| `.env` / config de deploy | Config | Replicar session pooler `:5432` (fix P2028) en el DSN del entorno de despliegue para soportar `$transaction` interactiva |

## Testing Strategy

| Archivo | Casos | Enfoque |
|---|---|---|
| `inventory.advanced.test.ts` — `getProductsWithBranchStock` | (a) `{ branchId: 1 }` → `mockProductFindMany` llamado con `where.inventory = { some: { branchId: 1 } }` (sin predicado de stock); (b) `{ branchId: 1, onlyWithStock: true }` → `some: { branchId: 1, stock: { gt: 0 } }`; (c) `{}` → sin `where.inventory` (comportamiento previo); los 2 casos existentes de filtro intactos | Mock `mockProductFindMany` + aserciones `expect.objectContaining` |
| `inventory.advanced.test.ts` — `moveStockBatchBetweenBranches` | (1) Batch válido con cantidades distintas → `upsert` decrementa origen e incrementa destino por ítem; `branchMovement.create` llamado 2×n con la misma `reference` (`/^MOVE-/`) y `performedBy`; (2) Stock insuficiente parcial (A disponible 2, requerido 5) → error con nombre de producto, `upsert` y `create` NO llamados (rollback total); (3) `sourceBranchId === destBranchId` → zod rechaza, `$transaction` NO llamado; (4) `items` vacío o con `productId` duplicado o `quantity: 0` → zod rechaza sin abrir transacción | Mock `tx` ampliado con `product.findMany`; mocks de `branchInventory.findUnique` encadenados por ítem (`mockResolvedValueOnce`) |
| `inventory.advanced.test.ts` — regresión | 4 casos de `moveStockBetweenBranches` + 3 de `assignStockToBranch` + 2 de `getBranchMovements` pasando sin cambios | Sin editar esos `describe` |
| `MoveStockModal.test.tsx` (NUEVO, `@jest-environment jsdom`) | Selección múltiple; validación por fila (cantidad > stock fila → error inline y submit deshabilitado); cálculo del sumario ("2 productos · 10 unidades"); submit con array (`items: [{productId: A, quantity: 3}, ...]`); checkbox desmarcado deshabilita input y excluye del sumario/array; error de backend → `Swal.fire` con nombre del producto y modal abierto; confirmación Swal antes del submit | Mock `@/app/actions/inventory` (`moveStockBatchBetweenBranches`, `getBranchInventory`) y `sweetalert2` (patrón `ExportWizard.test.tsx`); `fireEvent` + `waitFor` |
| `ExportWizard.test.tsx` | Sin cambios de aserción: `toHaveBeenCalledWith({ branchId: 1 })`, 2 checkboxes con stock > 0, regresión de pasos y PDF | Verificar en verde tras el agrandado; actualizar snapshot si existiera (no hay; usa `getByText`) |

Comandos de verificación (orden de ejecución): `npm test` → `npx tsc --noEmit` → `npm run lint` → `npm run build`.

## Risks & Mitigations

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **P2028 (pooling)**: la `$transaction` interactiva del batch falla con pooler transaccional si el DSN apunta al puerto transaccional (`:6543`) en vez del session pooler (`:5432`) | Media | La acción batch falla en deploy aunque funcione local | El runtime ya usa `:5432` en `.env` (fix aplicado); replicar el mismo DSN en el entorno de despliegue y verificar antes del release. Checklist de deploy en `tasks` |
| **Atomicidad del batch**: escribir antes de validar todos los ítems dejaría inventario parcialmente modificado si un ítem posterior falla | Media | Inventario inconsistente (origen decrementado sin destino incrementado) | Pasos 1-4 del pseudocódigo validan TODO antes del primer `upsert`; cualquier `throw` aborta el `$transaction` con rollback total; test (2) de stock insuficiente parcial lo cubre |
| **Divergencia UI/backend** en validación de cantidad | Media | La UI acepta una cantidad que el backend rechaza (o viceversa), UX confusa | Misma regla en ambos lados: min 1 y max = stock de la fila en la UI + zod (`quantity` entera ≥ 1) + verificación server-side por producto; test de fallo parcial |
| **Regresión de `moveStockBetweenBranches`** | Baja | Callers/tests existentes rotos | Función 100% intacta (duplicación controlada, no refactor compartido); correr `inventory.advanced.test.ts` completo; los 4 casos siguen en verde |
| **Cambio de props rompe callers** | Baja | `page.tsx` deja de compilar | `MoveStockModalProps` y `ExportWizardProps` sin cambios; solo estructura interna y clases; `npm test` + `tsc` lo detectan |
| **Doble fuente de verdad residual** tras pasar a controlado | Baja | Dropdown y fetch divergen de nuevo | `BranchFilterDropdown` no lee contexto; única fuente = estado local de la página que alimenta el effect; el componente es estrictamente controlado |
| **Regresión de `ExportWizard.test.tsx`** | Baja | CI en rojo | El agrandado no altera queries del test (usa `getByText`/`getByRole`, no snapshot); si un snapshot existiera, se actualiza en el mismo commit |
| **zod v4 en `refine` de array** | Baja | Comportamiento inesperado del mensaje de duplicados | `Array.prototype.refine` con `message` es válido en zod v4 (mismo API que el refine de objeto ya usado en `moveStockSchema`); cubierto por test (4) de duplicados |

## Threat Matrix

N/A — el change no toca routing, shell commands, subprocesses, automatización VCS/PR, clasificación de ejecutables ni integración de procesos.

## Migration / Rollout

No se requieren migraciones Prisma ni cambios de esquema. Única acción de despliegue: replicar el DSN de session pooler (`:5432`) en la configuración del entorno de producción (fix P2028). Rollback: revertir el commit del cambio — las 4 acciones conviven de forma aditiva (`moveStockBetweenBranches` intacta), por lo que no hay datos migrados ni estado irreversible.

## Open Questions

- [ ] `performedBy`: el modal envía `"admin"` hardcodeado (patrón actual MoveStockModal.tsx:95); ¿se resuelve con el user id del server context en este change o queda como TODO para otro? (No bloquea: la action ya lo recibe como string.)
- [ ] Ubicación final del filtro de sucursal: ¿header de la página (reemplazando al BranchSelector actual, recomendado) o dentro del bloque de `InventoryFilters`? (Cosmético; no cambia el contrato.)

## Key Learnings

1. Reutilizar `BranchSelector` en modo controlado viola el delta porque el componente siempre lee `BranchContext` aunque no lo escriba.
2. El filtro real de productos por sucursal estaba encerrado en `if (opts.onlyWithStock)`, por lo que `branchId` solo afectaba el include de stock.
3. La transacción interactiva de Prisma requiere session pooler (`:5432`), no pooler transaccional (`:6543`), para evitar P2028.
4. La opción de menor riesgo para una nueva acción batch es duplicar el patrón probado en vez de refactorizar helpers compartidos.