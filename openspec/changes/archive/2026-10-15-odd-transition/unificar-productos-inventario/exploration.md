# Exploration: Unificar /productos → /inventario + FAB crear producto + crear categoría

## Contexto (verificado)

- **Decisión del usuario**: unificar la página /productos dentro de /inventario. El FAB de crear producto pasa a /inventario. Botón adicional para crear categoría. **NO subir a main** (solo rama).
- **Decisión z-index FAB**: **estándar** — FAB en z-40/50, los modales (z-60) lo cubren. El usuario rechazó la opción literal "FAB sobre modales" (riesgo de doble apertura).

## Hallazgos clave (exploración con archivo:línea)

### /productos actual
- `src/app/productos/page.tsx` (166 líneas, client): FAB wrapper (89-93) → `AddProductButton`; header + BranchSelector (98-104); grid de ProductCard (107-123); modal edición INLINE z-[70] (127-157) que envuelve ProductForm (que tiene su propio scrim z-[60] — anidamiento de modales).
- `AddProductButton.tsx` (23 líneas): **EL FAB** `fixed bottom-24 right-6 w-14 h-14 bg-[#ff385c] text-white rounded-full shadow-lg hover:bg-[#e00b41] z-40` (línea 13) con SVG '+'; estado isOpen; renderiza `<ProductForm product={null} onClose={...}>` (línea 20). **NO acepta onSuccess** (habría que parametrizarlo para refresh).
- `ProductForm.tsx` (335 líneas): props `{ product, onClose, onSuccess }`; isEdit=!!product; create → `createProduct`, edit → `updateProductExtended` (105-107); incluye CategorySelector (280-287); submit ink #222222 (no rosa); modal z-[60] (151-153). **Ya se importa desde fuera de /productos** (AddPurchaseButton.tsx:11, abre z-[70]).
- Navegación: único link en `BottomNav.tsx:53` `{ href: "/productos", label: "Productos" }`. `inactivos/page.tsx:99` link de retorno a /productos. Navbar sin link.

### /inventario actual
- `src/app/inventario/page.tsx` (252 líneas, client): estado (24-44) con `productFormOpen` NO existe, `moveStockOpen`, `exportWizardOpen`, etc.; carga `getProductsWithBranchStock` (53-64); header con BranchFilterDropdown + botones Mover Stock/Exportar/Inactivos (140-172); InventoryFilters (177-187); InventarioList (189-198).
- Modales z-[60]: LabelSelector, MovementsModal, MoveStockModal, ExportWizard. **NO hay FAB, NO hay crear producto, NO hay crear categoría.**
- `InventarioCard.tsx` (354): **edición INLINE** (no modal) con updateProductExtended + adjustProductStock; botones Editar/Ver Movimientos/Desactivar (332-351). El "editar/desactivar" ya está cubierto — el FAB solo agrega el "crear".

### Crear producto
- `createProduct` (actions/product.ts:54-117): schema inline `{ name, description?, prefix?, price }` — **NO acepta categoryId ni active** (ProductForm 99-102). Genera código con advisory lock + retry/backoff.
- `updateProductExtended` (459-502): `{ id, name?, description?, price?, categoryId? (nullable), active? }`; revalida /productos, /productos/[id], /inventario, /inventario/inactivos.
- Abrirlo desde /inventario: estado `productFormOpen` + `<ProductForm product={null} onSuccess={refetch}>`.

### Crear categoría
- `createCategory` EXISTE (actions/category.ts:29-55): schema `{ name }` 1-100; P2002 → "Ya existe una categoría"; revalida /categorias.
- No hay modal dedicado: se usa Swal.fire con input text en `CategorySelector.tsx:99-160` (botón "+ Nueva categoría" 193-209) y `categorias/page.tsx:39-58`.
- CategorySelector se usa en ProductForm (282-286) pero **NO en /inventario** (InventarioCard e InventoryFilters usan select plano).

### STYLE.md / z-index
- Sin token de FAB; elevation tier única; touch 48×48; rounded-full.
- z-40: FABs (AddProductButton, AddSaleButton, AddClienteButton, AddPurchaseButton). z-50: BottomNav, dropdowns. **z-[60]: TODOS los scrims de modales.** z-[70]: modales anidados (productos/page:128, AddPurchaseButton:346). **SweetAlert2: 1060** (externo, siempre encima).

## Opción recomendada — /inventario como única página (Opción A)

1. `inventario/page.tsx`: estado `productFormOpen` + render `<ProductForm product={null} onSuccess={refetch}>`; FAB (reusar AddProductButton o extraer FloatingActionButton a components/ui) con z-40; botón "Nueva categoría" (Swal input, patrón CategorySelector).
2. Quitar ítem "Productos" del BottomNav (queda 6: Dashboard, Compras, Ventas, Inventario, Sucursales, Clientes); actualizar BottomNav.test.ts (7→6).
3. `/productos/page.tsx` → `redirect("/inventario")` (server) para no romper inactivos link ni bookmarks; o eliminar + arreglar inactivos/page.tsx:99.
4. Componentes huérfanos (ProductCard, DeleteButton) quedan sin uso (no borrar si AddPurchaseButton los usa — VERIFICAR).
5. `createCategory` revalida /inventario adicional.
6. Test FAB en /inventario.

## Archivos afectados (Opción A)

| Ruta | Acción |
|---|---|
| `src/app/inventario/page.tsx` | EDIT — FAB + ProductForm + botón categoría |
| `src/app/productos/components/AddProductButton.tsx` | REUSAR/MOVER (parametrizar onSuccess) |
| `src/app/productos/components/ProductForm.tsx` | REUSAR (sin cambios lógica) |
| `src/components/BottomNav.tsx` | EDIT — quitar ítem Productos (53) + ProductIcon (14-18) |
| `src/components/BottomNav.test.ts` | EDIT — 7 → 6 |
| `src/app/productos/page.tsx` | EDIT → redirect /inventario (o eliminar) |
| `src/app/inventario/inactivos/page.tsx` | EDIT — link 99 → /inventario |
| `src/app/actions/category.ts` | EDIT — revalidatePath /inventario |
| Tests | AGREGAR — FAB /inventario |

## Riesgos / decisiones pendientes

1. **AddPurchaseButton.tsx:193** dice "Primero creá un producto en la sección Productos" — actualizar texto si desaparece la sección.
2. **AddProductButton sin onSuccess** — parametrizar para que el refresh use getProductsWithBranchStock.
3. **AddPurchaseButton usa ProductForm** — verificar que no dependa de /productos para el create (ya lo abre desde compras).
4. **Anidamiento de modales**: NO introducir wrapper z-[70] como productos/page:128; el FAB abre ProductForm z-[60] directo.
5. **BottomNavMasMenu** existe sin usarse — no tocar.
6. Verificar si ProductCard/DeleteButton los usa algo más (AddPurchaseButton usa ProductForm, no las cards).