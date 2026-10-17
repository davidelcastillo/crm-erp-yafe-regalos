# Design: FASE 3 – Interfaces de Inventario y Sucursales

> **NOTA — Reconciliación 2026-07-31 (pre-apply)**
> Esta revisión corrige divergencias entre el diseño original y (a) el esquema
> real de Prisma y (b) el trabajo previo ya presente en el árbol de trabajo.
> Ver `sdd/fase3-inventory-branch-interfaces/schema-divergence` y
> `sdd/fase3-inventory-branch-interfaces/pre-existing-work` en memoria Engram.

## Technical Approach

Implementar las interfaces y flujos de interacción **faltantes** para gestionar
sucursales, categorías, asignación de stock por sucursal, movimientos entre
sucursales, activación/desactivación de productos (soft-delete) y formularios de
compra/venta con selección de sucursal. El esquema de base de datos y gran parte
del CRUD de sucursales + purchase/sale por sucursal **ya existen** tras HU2.

Este diseño se centra en **completar lo ausente** reutilizando lo implementado:
- management de categorías (CRUD + selector + integración en ProductForm)
- operaciones avanzadas de inventario (`assignStockToBranch`, `moveStockBetweenBranches`, `getProductsWithBranchStock`, `getBranchMovements`)
- toggle activo/inactivo de productos + página de inactivos + `reactivateProduct`
- compra con distribución multi-sucursal (`createPurchaseWithBranchSplit`)
- página de movimientos, página de categorías, página de inactivos
- filtros de inventario + botón "Mover Stock"
- seed por defecto (`prisma/seed.ts`)

Patrones heredados del código existente:
- **Server Actions** como única capa de mutación (App Router), stock en `prisma.$transaction`
- **Client/Server Components** separados; selectores/modales = Client; páginas = Server
- **Zod** en cada Server Action y como export reutilizable en `src/lib/validations/`
- **SweetAlert2** para confirmaciones (toggle activo, mover stock, reactivar)
- Rutas reales: `src/app/{sucursales,categorias,inventario,movimientos,productos,compras,ventas}/`

## Schema Facts (Source of Truth: `prisma/schema.prisma`)

El executor DEBE respetar estos hechos. Cualquier suposición distinta en
specs/proposal previo está desactualizada.

| Modelo | Realidad (campos clave) |
|--------|-------------------------|
| `Product` | `id, name, description?, createdAt, updatedAt, code @unique, codePrefix?, price Decimal(10,2), categoryId Int? @relation Category, active Boolean @default(true)`, rel `inventory BranchInventory[]`, `movements BranchMovement[]`. **No** hay columna `stock` en Product. |
| `Branch` | `id, name, address?, phone?, email?, isActive Boolean @default(true), createdAt, updatedAt`. **NO** existe `code`. |
| `BranchInventory` | `id, branchId, productId, stock Int @default(0), lastUpdated DateTime @updatedAt`, `@@unique([branchId, productId])`. El idenntificador compuesto es `branchId_productId`. (Diseño previo lo llamaba `BranchProduct` — **nombre incorrecto**.) |
| `Category` | `id, name @unique`, rel `products Product[]`. **NO** tiene `createdAt/updatedAt`. |
| `BranchMovement` | `id, productId, branchId Int (único, NO source/dest pair), movementType MovementType, quantity Int, reference String?, createdAt DateTime, performedBy String`. enum `MovementType = ENTRY \| EXIT \| TRANSFER_IN \| TRANSFER_OUT \| ADJUSTMENT`. (Diseño previo con `sourceBranchId/destBranchId` + `userId` + `type: TRANSFER\|ADJUSTMENT` — **incorrecto**.) |
| `Purchase` / `Sale` | Ambos con `branchId Int` requerido + `@@index([branchId])`. `registerPurchase` y `registerSale` ya existen y manejan `branchId` + `BranchInventory` vía upsert. |
| Relations | `Branch → BranchMovement @relation("BranchMovements")`, `Product → BranchMovement @relation("ProductMovements")`. |

### Implicaciones críticas

1. **`moveStockBetweenBranches` debe crear DOS filas `BranchMovement`**: una
   `TRANSFER_OUT` (origen) y una `TRANSFER_IN` (destino), ambas con `branchId`
   único, `reference` (id de operación/opcional), `performedBy` (string corto).
   NO existe un movimiento "TRANSFER" con source/dest en una sola fila.
2. **Tipos de interfaces**: cualquier `BranchProductStock` debe renombrarse a
   `BranchInventoryStock`. El `BranchMovement` de la UI mapeará a dos filas DB.
3. **`Category`vista de UI**: la capa de presentación puede agregar campos
   virtuales (p.ej. `createdAt` no existe); usar `ProductWithCategory` solo
   trae `category: {id, name}` real.
4. **`updateProductSchema` existente** excluye `categoryId` y `active`; hay que
   añadirlos (ver File Changes).
5. **`Product.code` es inmutable** tras la creación (retry + advisory lock en
   `createProduct`). NO incluirlo en `updateProductSchema`.

## Architecture Decisions

### Decision: Two-row pattern for inter-branch transfers (`BranchMovement`)
**Elección**: Una transferencia entre sucursales A → B inserta **dos** filas
`BranchMovement`: `(branchId=A, type=TRANSFER_OUT, quantity=n)` y
`(branchId=B, type=TRANSFER_IN, quantity=n)`, ambas con mismo `reference`
(id opuesto o agrupador) y `performedBy`.

**Alternativas descartadas**:
- Una sola fila con `sourceBranchId/destBranchId`: **no existe el campo**.
- Mockearlo: rompe integridad de datos y reportes.

**Razón**: el schema real solo soporta `branchId` único; dos filas es el patrón
natural tipo libro-contable. Sigue la convención ENTRY/EXIT/TRANSFER_IN/OUT ya
presente en el enum yłada consultas por sucursal con un solo filtro.

### Decision: Category Management Approach
**Elección**: CRUD completo de categorías con Server Actions reutilizables,
componente `CategorySelector` (con modal anidado "+ Nueva categoría") e
integración en `ProductForm` existente.

**Alternativas descartadas**: categorías como strings; lista estática; tags.

**Razón**: el schema ya tiene `Category` y `Product.categoryId`; los requisitos
de negocio demandan CRUD; `CategorySelector` reutilizable mantiene consistencia;
Server Actions siguen el patrón uniforme del proyecto (ver `branch.ts`).

### Decision: Advanced Inventory Operations
**Elección**: Server Actions dedicadas en `src/app/actions/inventory.ts`:
`getProductsWithBranchStock`, `assignStockToBranch`, `moveStockBetweenBranches`,
`getBranchMovements`. Cada una con validación + transacción donde muta.

**Razón**: separación de responsabilidades; integridad transaccional crítica;
`adjustProductStock` existente ya se usa en `InventarioCard` — mantenerlo evita
breaking changes. `assignStockToBranch` puede reutilizar internamente el patrón
upsert sobre `branchId_productId`.

### Decision: Reuse/enhance existing inventory page (no rebuild)
**Elección**: Mejorar `src/app/inventario/page.tsx` añadiendo `InventoryFilters`
(sucursal + categoría) y botón "Mover Stock" → `MoveStockModal`, en lugar de
reconstruir la página.

**Razón**: ya tiene integración básica con `BranchSelector` y muestra stock
por sucursal; reutilizar minimiza disrupción y riesgos.

### Decision: `createPurchaseWithBranchSplit` es NUEVA acción, no reemplaza `registerPurchase`
**Elección**: Conservar el `registerPurchase` existente (compra con `branchId`
único + items) y agregar `createPurchaseWithBranchSplit` (ítems con par
`{productId, branchId, quantity, price}` variando la sucursal por línea).

**Razón**: `registerPurchase` ya está integrado y probado en
`AddPurchaseButton`. La nueva acción cubre el caso multi-sucursal sin romper
la API existente.

## Data Flow

### Stock Assignment Flow
```
User → BranchSelector (selección) → ProductForm/celda → assignStockToBranch
  → prisma.$transaction:
      1. read existente BranchInventory(branchId, productId)
      2. validate newStock = current + qty >= 0   (qty puede ser negativo para remover)
      3. upsert BranchInventory → stock: newStock
      4. (opcional) insert BranchMovement type=ADJUSTMENT quantity=qty
  → revalidatePath("/inventario")
```

### Stock Movement Flow (A → B)
```
User → MoveStockModal (producto, origen A, destino B, qty)
  → moveStockBetweenBranches
  → prisma.$transaction:
      1. read invA=A.{branchId,productId}.stock  → newA = invA - qty; reject if newA < 0
      2. read invB=B.{branchId,productId}.stock  → newB = invB + qty
      3. update invA.stock = newA
      4. upsert invB → stock: newB
      5. insert BranchMovement(branchId=A, movementType=TRANSFER_OUT, quantity=qty, reference=`MOVE-<opId>`, performedBy)
      6. insert BranchMovement(branchId=B, movementType=TRANSFER_IN,  quantity=qty, reference=`MOVE-<opId>`, performedBy)
  → revalidatePath("/inventario") + ("/movimientos")
```

### Multi-Branch Split Purchase Flow
```
User → PurchaseForm (varias líneas {productId, branchId, qty, price})
  → createPurchaseWithBranchSplit
  → prisma.$transaction:
      1. validate branch(es) activas
      2. validate productos activos
      3. create Purchase{totalAmount, branchId = branchByIdPrimeralínea OR nullable según schema}
         NOTE: schema actual exige Purchase.branchId NOT NULL → elegir branchId
         primario (ej. primera línea) y registrar BranchMovement(ENTRY) por
         cada línea en su branchId para reflejar la distribución.
      4. crear PurchaseItem por línea
      5. upsert BranchInventory → increment stock por línea en su branchId
      6. (opcional) BranchMovement(type=ENTRY) por línea para audit
  → revalidatePath("/compras") + ("/inventario")
```

> **Riesgo abierto**: como `Purchase.branchId` es required NOT NULL, la
> "distribución" se manifiesta como un Purchase con `branchId=principal` y
> movimientos `ENTRY` en cada `branchId` destino. Si se prefiere validar
> que todas las líneas de la compra pertenezcan a la MISMA sucursal (caso
> típico Aija), se puede simplemente afirmar `items[].branchId === branchId`
> y tratar `createPurchaseWithBranchSplit` como "compra distribuida a
> posteriori". Documentar decisión en apply-progress.

### Soft-delete (toggle active) Flow
```
User → ProductForm (toggle "Activo") → confirmación SweetAlert2
  → toggleProductActive(id, active)
  → prisma.$transaction:
      1. update Product.active
  → revalidatePath("/productos") + ("/inventario") + ("/inventario/inactivos")

Listado reactivateProduct está en `/inventario/inactivos`: idem con active=true.
```

## File Changes (reconciliado con trabajo previo existente)

> **Convention**: `src/app/components/` vs `src/components/ui/` — los selectores
> reutilizables globales que ya viven en `src/components/ui/` (BranchSelector,
> BranchManager) permanecen ahí. NUEVOS selectores reutilizables
> (CategorySelector) van en `src/components/ui/`. Componentes de feature
> (modales/filtros específicos de un feature) van en `src/app/<feature>/components/`.

| File | Action | Status | Description |
|------|--------|--------|-------------|
| `src/app/actions/branch.ts` | Exists | ✅ done en HU2 | CRUD Branch (create/get/getById/update/delete + getBranchOptions); NO hay `code` en schema |
| `src/app/actions/branch.test.ts` | Exists | ✅ | tests branch CRUD |
| `src/app/actions/inventory.ts` | Modify | partial | AÑADIR `getProductsWithBranchStock`, `assignStockToBranch`, `moveStockBetweenBranches` (2 filas), `getBranchMovements` |
| `src/app/actions/inventory.test.ts` | Modify | partial | añadir tests de las nuevas acciones |
| `src/app/actions/product.ts` | Modify | partial | AÑADIR `toggleProductActive`, `getActiveProducts`, `getInactiveProducts`, `reactivateProduct` |
| `src/app/actions/category.ts` | Create | ❌ pending | CRUD Category: `createCategory`, `getCategories`, `getCategoryById`, `updateCategory`, `deleteCategory` (bloquear si tiene productos), `getCategoryOptions` |
| `src/app/actions/category.test.ts` | Create | ❌ pending | tests category CRUD |
| `src/app/actions/purchase.ts` | Keep + Add | partial | MANTENER `registerPurchase`; AÑADIR `createPurchaseWithBranchSplit` (multi-sucursal) en archivo separado si superpone complejidad |
| `src/app/actions/sale.ts` | Keep | ✅ ya hace | `registerSale` ya valida stock por sucursal; SaleForm no agrega acción nueva, solo UI |
| `src/app/sucursales/page.tsx` | Exists | ✅ done en HU2 | lista sucursales |
| `src/app/sucursales/[id]/page.tsx` | Exists | ✅ done en HU2 | editar sucursal |
| `src/app/categorias/page.tsx` | Create | ❌ pending | lista categorías |
| `src/app/categorias/[id]/page.tsx` | Create | ❌ pending | editar/ver categoría |
| `src/app/movimientos/page.tsx` | Create | ❌ pending | tabla BranchMovement con filtros |
| `src/app/inventario/page.tsx` | Modify | partial | AÑADIR InventoryFilters + botón "Mover Stock" → MoveStockModal |
| `src/app/inventario/inactivos/page.tsx` | Create | ❌ pending | lista `active=false`, buscador, botón Activar → reactivateProduct |
| `src/app/productos/components/ProductForm.tsx` | Modify | partial | AÑADIR selector categoría (CategorySelector) y toggle activo/inactivo con SweetAlert2; NO en `src/app/components/` |
| `src/components/ui/BranchSelector.tsx` | Exists | ✅ done en HU2 | single-select (single mode por ahora; multiselect no requerido por flujo actual) |
| `src/components/ui/BranchManager.tsx` | Exists | ✅ done en HU2 | list/create/edit client UI |
| `src/components/ui/CategorySelector.tsx` | Create | ❌ pending | selector + modal anidado "+ Nueva categoría" → createCategory |
| `src/app/inventario/components/InventoryFilters.tsx` | Create | ❌ pending | filtros sucursal + categoría, emite `onFilterChange` |
| `src/app/inventario/components/MoveStockModal.tsx` | Create | ❌ pending | producto + origen + destino + qty → moveStockBetweenBranches |
| `src/app/compras/components/PurchaseForm.tsx` | Create | ❌ pending | compra con líneas dinámicas {branchId, productId, qty, price} → createPurchaseWithBranchSplit |
| `src/app/ventas/components/SaleForm.tsx` | Create | ❌ pending | venta con selector sucursal + validación stock en sucursal → registerSale (UI sobre acción existente) |
| `src/lib/validations/branch.ts` | Exists | ✅ done en HU2 | NO incluye `code` (correcto vs schema real) |
| `src/lib/validations/category.ts` | Create | ❌ pending | `createCategorySchema(name)`, `updateCategorySchema(id, name)`, `deleteCategorySchema(id)` |
| `src/lib/validations/product.ts` | Create | ❌ pending | NO reemplazar el schema inline de `product.ts`; crear aquí `updateProductSchemaExtended` o exportar. Mín: `(id, name?, price?, description?, categoryId?: number|null, active?: boolean)` |
| `src/lib/validations/branchMovement.ts` | Create | ❌ pending | `moveStockSchema({productId, sourceBranchId, destBranchId, quantity>0, performedBy})` y `getMovementsFiltersSchema({branchId?, productId?, startDate?, endDate?})` |
| `src/lib/validations/purchase.ts` | Create | ❌ pending | `purchaseSplitItemSchema({productId, branchId, quantity>0, price>0})`, `createPurchaseWithBranchSplitSchema({items: array min 1, performedBy?})` |
| `src/lib/validations/sale.ts` | Create | ❌ pending | `registerSaleSchema` actualmente está inline en `sale.ts`; exportar a este archivo para reutilizar en `SaleForm`. (refactor opcional) |
| `prisma/seed.ts` | Create | ❌ pending | Branch "Depósito"/"Principal" sin `code` + Category "General". Opcional: asignar "General" a productos sin categoría |

## Interfaces / Contracts

### Category
```typescript
// en src/lib/validations/category.ts
export interface CategoryDTO { id: number; name: string } // sin timestamps
export const createCategorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres")
})
export const updateCategorySchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1, "El nombre es requerido").max(100).optional(),
})
export const deleteCategorySchema = z.object({ id: z.number().int().positive() })
```

### BranchInventory Stock (corregido de BranchProductStock)
```typescript
export interface BranchInventoryStock {
  branchId: number
  branchName: string
  stock: number
}
```

### Product with Category and Branch Stock (capa UI)
```typescript
// tipo presentación derivado de Prisma; createdAt/updatedAt serializados a string en server→client
export interface ProductWithBranchStock {
  id: number
  name: string
  code: string
  codePrefix: string | null
  price: string // Decimal serializa a string vía parseObject
  active: boolean
  category: { id: number; name: string } | null
  inventory: Array<{ branchId: number; branchName: string; stock: number }>
}
```

### BranchMovement (capa UI — agrega dos filas en una transferencia)
```typescript
export type MovementTypeView = 'ENTRY' | 'EXIT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT'
export interface BranchMovementDTO {
  id: number
  productId: number
  productName: string | null
  branchId: number
  branchName: string | null
  movementType: MovementTypeView
  quantity: number
  reference: string | null
  performedBy: string
  createdAt: string // ISO serializada
}
```

### Mover Stock (input del Server Action)
```typescript
// en src/lib/validations/branchMovement.ts
export const moveStockSchema = z.object({
  productId: z.number().int().positive("Producto inválido"),
  sourceBranchId: z.number().int().positive("Sucursal origen requerida"),
  destBranchId: z.number().int().positive("Sucursal destino requerida"),
  quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
  performedBy: z.string().min(1).max(100),
}).refine(d => d.sourceBranchId !== d.destBranchId, {
  message: "Las sucursales de origen y destino deben ser distintas",
  path: ["destBranchId"],
})
```

### Product update (extendido)
```typescript
// en src/lib/validations/product.ts
export const updateProductExtendedSchema = z.object({
  id: z.number().int().positive("ID inválido"),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
})
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `category.ts` CRUD | Jest/Vitest con Prisma mock; validar Zod schemas; delete con productos asociados bloquea |
| Unit | `inventory.ts` nuevas acciones | mock `$transaction`; `moveStockBetweenBranches` inserta 2 BranchMovement rows; `assignStockToBranch` no baja stock < 0 |
| Unit | `product.ts` nuevas acciones | `toggleProductActive`, `getInactiveProducts` filtra `active=false`, `reactivateProduct` |
| Unit | Componentes nuevos (CategorySelector, InventoryFilters, MoveStockModal, PurchaseForm, SaleForm) | React Testing Library; render, interacción, validación origen≠destino, toggle |
| Integration | Asignar stock → mover entre sucursales → consistency | test transactional de `moveStockBetweenBranches`: stocks antes/después coherentes + 2 movimientos registrados |
| Integration | `createPurchaseWithBranchSplit` → stock por sucursal incrementa + invariantes | verificar incremento concreto por branchId |
| Integration | Soft-delete flow | desactivar producto → no aparece en `getActiveProducts`, sí en `getInactiveProducts`; reactivate invierte |
| E2E (verify phase) | Playwright mobile | categorías → filtro inventario → mover stock → inactivos |

### Existing tests to keep green
- `src/app/actions/branch.test.ts`
- `src/app/actions/inventory.test.ts`
- `src/app/actions/purchase.branch.test.ts`
- `src/app/actions/sale.branch.test.ts`
- `src/app/compras/components/AddPurchaseButton.test.tsx`
- `src/app/compras/components/ProductAutocomplete.test.tsx`
- `src/app/productos/components/ProductForm.test.tsx`
- `src/lib/validations/auth.test.ts`

## Threat Matrix

| Boundary ¿existe? | Detalle |
|---|---|
| Routing/Shell | No. Todo en App Router; middleware admin ya protege (Fase 1). |
| Subprocess/exec | No. |
| VCS/PR automation | No. |
| Process integration | No. |
| File classification (executable) | No. |

N/A — sin superficies de threat adicionales más allá del HTTP/Next.js normal.

## Migration / Rollout

**Sin migración de esquema** (todas las tablas existen desde Fase 2).
Rollback:
1. `git checkout` sobre las carpetas afectadas (`src/app/{categorias,movimientos,inventario/inactivos}/`, `src/app/actions/category.*`, etc.).
2. Revertir `prisma/seed.ts` (si se creó).
3. `npm run build` + `npm test` para confirmar que lo ya-implementado sigue funcionando.

## Open Questions (resolver durante apply si aplica)

- [ ] `performerBy`: usar el user id de Supabase auth, email, o "admin". Proponer: extraer del server context (si disponible) o aceptar campo del form-feature (admin fija).
- [ ] `Purchase.branchId` required NOT NULL vs "split multi-sucursal": ¿aceptamos que todas las `items` de una compra vayan al MISMO `branchId` (y la "distribución" sea solo para BranchInventory viaENTRY movements)? O permitimos múltiples `branchId` en items y elegimos el primero como cabecera. **Recomendado**: items[].branchId === purchase.branchId; distribución result = BranchMovement ENTRY por item.
- [ ] Caching: no agregar en este cambio.
- [ ] pagination: deferred (load completo con `take/skip` opcional).

## Next Step
Ready for apply (reconciled). Entrega: `size:exception` autorizada por el
maintainer. Ver `tasks.md` reconciliado para la lista precisa de pendientes.
