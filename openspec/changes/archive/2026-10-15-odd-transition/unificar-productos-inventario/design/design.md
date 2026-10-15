# Design: Unificar Productos dentro de Inventario (FAB crear producto + crear categoría)

## Metadata

| Campo | Valor |
|---|---|
| Change ID | `unificar-productos-inventario` |
| Modo | auto — hybrid (OpenSpec + Engram) |
| Delivery strategy | auto-chain (review budget 400 líneas) |
| Entrega | **Solo rama — NO mergear a main** |
| Referencias | proposal.md, exploration.md, specs `inventory-ui` / `app-navigation` / `product-management`, STYLE.md |

## Technical Approach

Unificar la gestión de productos en `/inventario` reutilizando componentes existentes. FAB crear producto (AddProductButton/ProductForm), crear categoría (patrón Swal CategorySelector), /productos → redirect server 307. Sin extraer FloatingActionButton, sin borrar ProductCard/DeleteButton.

### Capability `inventory-ui`

**Estado**: `const [productFormOpen, setProductFormOpen] = useState(false)` junto a moveStockOpen/exportWizardOpen (líneas 27-38).

**FAB** (al final del main, fuera de loading/error):
```tsx
<AddProductButton open={productFormOpen} onOpenChange={setProductFormOpen} onSuccess={handleProductCreated} />
{productFormOpen && (
  <ProductForm product={null} onSuccess={handleProductCreated} onClose={() => setProductFormOpen(false)} />
)}
```

**AddProductButton parametrizado (modo controlado + fallback legacy)**:
```tsx
interface AddProductButtonProps {
  onSuccess?: (product: Product) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export function AddProductButton({ onSuccess, open, onOpenChange }: AddProductButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const currentOpen = isControlled ? open : isOpen;
  const handleClick = () => { if (isControlled) onOpenChange(true); else setIsOpen(true); };
  return (
    <>
      <button onClick={handleClick} className="fixed bottom-24 right-6 w-14 h-14 bg-[#ff385c] text-white rounded-full shadow-lg hover:bg-[#e00b41] transition-colors flex items-center justify-center z-40" aria-label="Agregar producto">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      </button>
      {!isControlled && currentOpen && (
        <ProductForm product={null} onClose={() => setIsOpen(false)} onSuccess={onSuccess} />
      )}
    </>
  );
}
```
Sin open/onOpenChange → comportamiento idéntico al actual. Sin onSuccess → fallback router.refresh() intacto (ProductForm.tsx:125-129).

**handleProductCreated** (refetch con filtros activos):
```tsx
const handleProductCreated = async (created: Product) => {
  try { const data = await fetchProducts(branchId, selectedCategoryId, debouncedSearch); setProducts(data); setError(null); }
  catch (err) { setError(err instanceof Error ? err.message : 'Error al cargar productos'); }
};
```

**Botón "Nueva categoría"** en header (button-secondary: `px-4 py-2 min-h-[44px] text-sm font-medium text-[#222222] bg-white border border-gray-200 rounded-xl hover:bg-[#f2f2f2] transition-colors touch-manipulation`, aria-label "Nueva categoría").

**handleCreateCategory** (patrón Swal CategorySelector.tsx:99-160):
- Swal.fire({ title "Nueva categoría", input text, inputLabel "Nombre", inputPlaceholder "Ej: Limpieza, Alimentos…", inputAttributes maxlength 100, showCancelButton, confirmButtonText "Crear", cancelButtonText "Cancelar", confirmButtonColor #ff385c, cancelButtonColor #6a6a6a, background #ffffff, color #222222, inputValidator (vacío → "El nombre es requerido", >100 → "Máximo 100 caracteres") })
- isConfirmed → `createCategory({ name: modal.value.trim() })`
- éxito → `getCategoryOptions()` → setCategories + Swal éxito "Categoría creada" (`Se creó "<nombre>"`)
- error → Swal error con result.error (P2002 "Ya existe una categoría con ese nombre"), NO mutar lista local.

### Capability `app-navigation`

1. BottomNav.tsx: eliminar ProductIcon (14-18) + ítem (53) → 6 ítems.
2. productos/page.tsx → server page:
```tsx
import { redirect } from "next/navigation";
export default function ProductosPage() { redirect("/inventario"); }
```
(HTTP 307 temporal.)
3. inactivos/page.tsx:99 → href="/inventario" + copy "Volver a inventario".
4. BottomNav.test.ts: toHaveLength(6), retirar "Productos" del arrayContaining, highlight /productos → /inventario (líneas 39-44).

### Capability `product-management`

1. actions/category.ts:37: +`revalidatePath("/inventario");` junto a revalidatePath('/categorias').
2. AddPurchaseButton.tsx:193: copy → "sección Inventario".
3. **AddSaleButton.tsx:274**: mismo copy stale → "sección Inventario" (decisión del design: incluirlo por consistencia, misma clase de copy-staleness).

## Architecture Decisions

| # | Decisión | Decisión |
|---|---|---|
| D1 | FAB controlado por la página (open/onOpenChange) | (b) estado en página; AddProductButton delega apertura |
| D2 | ProductForm renderizado por la página, sin wrapper z-[70] | (b) scrim propio z-[60] directo |
| D3 | onSuccess + fallback router.refresh() intacto | (b) prop opcional |
| D4 | AddProductButton NO renderiza ProductForm en modo controlado | (b) !isControlled && currentOpen |
| D5 | /productos → redirect 307 temporal | (b) 307 (permite revertir) |
| D6 | AddProductButton reutilizado sin extraer FloatingActionButton | (b) minimalismo |

## Data Flow

**FAB**: click → onOpenChange(true) → setProductFormOpen(true) → ProductForm product={null} → submit createProduct → Swal éxito → onSuccess(created) → onClose() → handleProductCreated: fetchProducts(branchId, selectedCategoryId, debouncedSearch) → setProducts(data) (respeta filtros AND).

**Categoría**: botón → Swal input → createCategory({name}) → éxito: getCategoryOptions → setCategories + revalidatePath /inventario + /categorias → Swal éxito; error: Swal error (P2002), no mutar.

**Navegación**: GET /productos → 307 → /inventario. BottomNav 6 ítems. inactivos → /inventario.

## Component/File Changes

| Archivo | Acción |
|---|---|
| `src/app/inventario/page.tsx` | Edit — productFormOpen + handleProductCreated + handleCreateCategory + FAB + ProductForm directo + botón categoría |
| `src/app/productos/components/AddProductButton.tsx` | Edit — props onSuccess/open/onOpenChange; modo controlado |
| `src/app/productos/components/ProductForm.tsx` | Reusar (sin cambios) |
| `src/components/BottomNav.tsx` | Edit — quitar ProductIcon + ítem → 6 |
| `src/components/BottomNav.test.ts` | Edit — 7→6 + highlight /inventario |
| `src/app/productos/page.tsx` | Edit — server redirect 307 |
| `src/app/inventario/inactivos/page.tsx` | Edit — link + copy /inventario |
| `src/app/actions/category.ts` | Edit — revalidatePath /inventario |
| `src/app/compras/components/AddPurchaseButton.tsx` | Edit — copy sección Inventario |
| `src/app/ventas/components/AddSaleButton.tsx` | Edit — copy sección Inventario (línea 274, decisión design) |
| `src/app/inventario/components/InventarioPage.test.tsx` | Create — test FAB |
| `ProductCard.tsx` / `DeleteButton.tsx` | No tocar (huérfanos) |

## Testing Strategy

- BottomNav.test.ts: 6 links, arrayContaining sin Productos, highlight /inventario.
- InventarioPage.test.tsx (nuevo): FAB aria-label presente; click → ProductForm "Nuevo Producto"; submit → getProductsWithBranchStock llamado con filtros actuales. Mocks: actions, useRouter, sweetalert2, BranchContext (patrón MoveStockModal.test/ExportWizard.test).
- AddPurchaseButton.test.tsx: sin regresión (import por ruta de archivo) + aserción copy /sección Inventario/i.
- category.test.ts + product.test.ts verdes.
- Gates: npm test, lint, build, tsc.

## Risks & Mitigations

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | createProduct no revalida → lista stale | onSuccess obligatorio en /inventario (refetch filtros) |
| R2 | Copy stale AddSaleButton:274 (fuera de scope spec) | Incluido por consistencia (decisión design) |
| R3 | Anidamiento modales / z-index | FAB z-40 cubierto por modales z-[60]; ProductForm sin wrapper |
| R4 | Doble render ProductForm | Modo controlado (D4) |
| R5 | ProductCard/DeleteButton huérfanos | No borrar; tests propios verdes |
| R6 | Cambio API AddProductButton | Único caller desaparece con redirect; props opcionales |
| R7 | revalidatePath /productos inertes | Costo cero |
| R8 | Redirect rompe bookmarks | 307 temporal + grep verificado |
| R9 | Test highlight /productos | Reemplazado /inventario |

## Migration / Rollout

Sin migración de datos. Rollout en rama (sin merge a main). Auto-chain si forecast >400: PR A+B → PR C → PR D. Rollback: revertir redirect restaura página anterior.

## Open Questions

- [x] AddSaleButton:274 incluido (decisión design).
- [x] Test FAB en src/app/inventario/components/InventarioPage.test.tsx (convención directorio).
- [ ] Confirmar en tasks la ruta exacta del test.