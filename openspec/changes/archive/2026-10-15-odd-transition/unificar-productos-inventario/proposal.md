# Proposal: Unificar Productos dentro de Inventario (FAB crear producto + crear categoría)

## Metadata

| Campo | Valor |
|---|---|
| Change ID | `unificar-productos-inventario` |
| Status | Proposal |
| Fecha | 2026-08-22 |
| Modo | auto — hybrid (OpenSpec + Engram) |
| Delivery strategy | auto-chain (review budget 400 líneas) |
| Entrega | **Solo rama — NO mergear a main** |
| Decisión z-index FAB | Estándar: `z-40` (los modales `z-[60]` lo cubren) |

## Intent

Unificar la página `/productos` dentro de `/inventario`, convirtiendo a esta última en la única superficie para gestionar productos:

1. **FAB de crear producto** en `/inventario`: misma posición y estilo que el actual en `/productos` (círculo rosa `+`, `fixed bottom-24 right-6`, `z-40`), reutilizando `AddProductButton`/`ProductForm`.
2. **Botón crear categoría** en `/inventario`, con el patrón Swal de input ya usado en `CategorySelector` y la página de categorías.
3. **`/productos` como `redirect("/inventario")`** (server page) para no romper links existentes, bookmarks ni el link de retorno de inactivos.
4. **BottomNav sin ítem "Productos"** (queda con 6 ítems).

## Scope

### In Scope

| Ítem | Detalle |
|---|---|
| FAB crear producto en `/inventario` | Estado `productFormOpen` en `inventario/page.tsx`; reutilizar `AddProductButton` **parametrizado con `onSuccess`**; render `<ProductForm product={null} onSuccess={handleProductCreated}>` con scrim `z-[60]` directo (sin wrapper `z-[70]`). |
| Botón crear categoría en `/inventario` | Swal input text (patrón `CategorySelector.tsx:99-160`) → `createCategory({name})` → refresh de categorías. |
| Navegación | Quitar ítem "Productos" del BottomNav (6 ítems); `src/app/productos/page.tsx` → `redirect("/inventario")` (server); `inactivos/page.tsx:99` link → `/inventario`. |
| `createCategory` | Agregar `revalidatePath("/inventario")` además de `/categorias`. |
| Tests | `BottomNav.test.ts` (7 → 6 + highlight); test nuevo FAB `/inventario`; verificar AddPurchaseButton. |

### Out of Scope

- Borrar `ProductCard`/`DeleteButton` (huérfanos tras redirect pero no se borran; tests propios siguen válidos).
- Edición inline de `InventarioCard` (ya cubierta).
- Flujo de `AddPurchaseButton` (importa ProductForm por ruta de archivo, no URL).
- Estilos del submit ink de `ProductForm` (bg-[#222222] se mantiene).
- Migrar `/productos/[id]` (verificado: NO existe).
- `BottomNavMasMenu` (no se toca).

## Capabilities

### `inventory-ui` (modificada)
- Estado nuevo `productFormOpen: boolean`.
- `handleProductCreated(product)` re-ejecuta `fetchProducts(branchId, selectedCategoryId, debouncedSearch)` → `setProducts(data)` (respeta filtros activos).
- `handleCreateCategory(name)` → `createCategory({name})` → éxito: `getCategoryOptions()` → `setCategories` + Swal éxito; error P2002: Swal mensaje.
- FAB: `AddProductButton` con `onSuccess`; `z-40`, círculo `#ff385c` 56×56, `aria-label="Agregar producto"`.
- Modal ProductForm: `product={null}`, scrim `z-[60]`, sin wrapper adicional.

### `app-navigation` (modificada)
- `navItems` 6 entradas; eliminar `{ href: "/productos" }` (BottomNav.tsx:53) + `ProductIcon` (14-18).
- `/productos` → server page `redirect("/inventario")` (HTTP 307).
- `inactivos/page.tsx:99` link → `/inventario`.
- Tests: 7 → 6; highlight usa otro ítem (ej. /inventario).

### `product-management` (modificada)
- `createCategory` agrega `revalidatePath("/inventario")` junto a `/categorias`. Sin cambios de schema/mensajes.

## Approach

### Track A — FAB crear producto
1. `inventario/page.tsx`: estado `productFormOpen`.
2. `AddProductButton.tsx`: prop opcional `onSuccess?: (product) => void`; si llega, se pasa a ProductForm (que lo invoca antes de onClose); si no, fallback `router.refresh()` (compatibilidad total).
3. Render FAB con handler que re-llama fetchProducts.
4. ProductForm abre scrim z-[60] directo; NO wrapper z-[70].
5. Alternativa documentada (no requerida): extraer FloatingActionButton a components/ui. Se descarta por minimalismo.

### Track B — Botón crear categoría
1. Header de /inventario: botón "Nueva categoría" (button-secondary o pill rosa CategorySelector).
2. Swal input (inputValidator requerido ≤100; confirmButtonColor #ff385c, cancel #6a6a6a, bg #ffffff, color #222222).
3. isConfirmed → `createCategory({ name: modal.value.trim() })` → éxito: getCategoryOptions + Swal éxito; error: Swal error.

### Track C — Navegación
1. BottomNav.tsx: eliminar ítem (53) + ProductIcon (14-18); quedan 6.
2. BottomNav.test.ts: 7→6, retirar "Productos" del arrayContaining; reemplazar highlight /productos → /inventario.
3. productos/page.tsx → server redirect.
4. inactivos/page.tsx:99 → /inventario.
5. Verificación grep: no quedan links navegables a /productos fuera del redirect.

### Track D — Tests
1. BottomNav.test.ts actualizado.
2. Test FAB /inventario (Jest + RTL, actions mockeadas): FAB presente → click → ProductForm visible.
3. Verificación AddPurchaseButton no roto (test existente + flujo manual).
4. Gates: npm test, lint, build.
5. Delivery: auto-chain con PRs si el forecast lo exige (A+B → C → D).

## Affected Areas

| Ruta | Acción |
|---|---|
| `src/app/inventario/page.tsx` | EDIT — FAB + botón categoría + estado + handlers |
| `src/app/productos/components/AddProductButton.tsx` | EDIT — prop opcional onSuccess |
| `src/app/productos/components/ProductForm.tsx` | REUSAR |
| `src/components/BottomNav.tsx` | EDIT — quitar ítem + ProductIcon |
| `src/components/BottomNav.test.ts` | EDIT — 7→6 + highlight |
| `src/app/productos/page.tsx` | EDIT — redirect |
| `src/app/inventario/inactivos/page.tsx` | EDIT — link → /inventario |
| `src/app/actions/category.ts` | EDIT — revalidatePath /inventario |
| `ProductCard.tsx` / `DeleteButton.tsx` | NO TOUCH (huérfanos) |
| `AddPurchaseButton.tsx` | NO TOUCH (copy stale decisión aparte) |
| Tests nuevos | AGREGAR — FAB /inventario |

## Risks

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | AddProductButton sin onSuccess (y createProduct no revalida) | Prop opcional + handler que re-llama fetchProducts |
| 2 | Copy stale AddPurchaseButton.tsx:193 "sección Productos" | Decisión en spec: actualizar texto |
| 3 | Anidamiento de modales / z-index | FAB z-40 abre ProductForm z-[60] directo; sin wrapper z-[70] |
| 4 | ProductCard/DeleteButton huérfanos | No borrar (fuera de scope) |
| 5 | revalidatePath /productos inertes | Costo cero; limpieza futura |
| 6 | Test BottomNav highlight usa /productos | Incluido en scope |
| 7 | Refresh dependiente del cliente | handler con manejo de error visible |

## Success Criteria

- [ ] `/inventario` muestra FAB círculo rosa `+` (#ff385c, bottom-24 right-6, z-40, aria-label).
- [ ] Click FAB abre ProductForm "Nuevo Producto" con scrim z-[60] sin wrapper z-[70].
- [ ] Crear producto desde /inventario lo agrega a la lista inmediatamente respetando filtros activos.
- [ ] Botón "Nueva categoría" crea categoría → disponible en InventoryFilters + CategorySelector; duplicado muestra error.
- [ ] BottomNav con 6 ítems sin "Productos"; test actualizado.
- [ ] GET /productos → redirect /inventario; link inactivos → /inventario.
- [ ] AddPurchaseButton sin regresiones.
- [ ] createCategory revalida /inventario.
- [ ] npm test, lint, build verdes.
- [ ] Entrega en rama, sin merge a main.