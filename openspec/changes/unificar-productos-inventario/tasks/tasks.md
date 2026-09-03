# Tasks: Unificar Productos dentro de Inventario (FAB crear producto + crear categoría)

## Metadata

| Campo | Valor |
|---|---|
| Change ID | `unificar-productos-inventario` |
| Modo | auto — hybrid (OpenSpec + Engram) |
| Delivery strategy | auto-chain (review budget 400 líneas) |
| Entrega | **Solo rama — NO mergear a main** |
| Fuentes | proposal.md, design/design.md, specs `inventory-ui` / `app-navigation` / `product-management` |

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~425-430 |
| 400-line budget risk | **Medio-Alto** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1 (inventory-ui) → PR 2 (app-navigation) → PR 3 (product-management + tests) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |
| Entrega | Solo rama — NO mergear a main |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium-High
```

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | FAB crear producto + botón categoría en /inventario | PR 1 | `npx jest InventarioPage` | `/inventario`: FAB abre "Nuevo Producto", crear refetchea con filtros, Swal categoría crea/refresca | Revertir AddProductButton + inventario/page + InventarioPage.test |
| 2 | Navegación: BottomNav 6, /productos 307, inactivos link | PR 2 | `npx jest BottomNav` | GET /productos → 307; BottomNav sin Productos | Revertir BottomNav + productos/page + inactivos + test |
| 3 | product-management: revalidatePath + copies | PR 3 | `npx jest AddPurchaseButton AddSaleButton category` | Crear categoría refresca filtros; modales muestran "sección Inventario" | Revertir category + AddPurchaseButton + AddSaleButton + test |
| 4 | Cierre: gates + verificación manual | (en PR 3) | `npm test && tsc && lint && build` | Flujo manual completo | N/A |

## Fase 1: inventory-ui — FAB crear producto + botón crear categoría

**1.1 Parametrizar `AddProductButton` (modo controlado + fallback legacy)**
Desc: interface AddProductButtonProps { onSuccess?; open?; onOpenChange? }; isControlled = open !== undefined && onOpenChange !== undefined; currentOpen = isControlled ? open : isOpen; click delega; ProductForm solo con !isControlled && currentOpen; clases exactas FAB (fixed bottom-24 right-6 w-14 h-14 bg-[#ff385c] z-40 aria-label).
AC: sin props → comportamiento actual (fallback router.refresh en ProductForm:125-129); modo controlado no renderiza interno; sin código muerto.
Riesgos: R6 cambio API (props opcionales; único caller legacy desaparece con redirect).
Deps: —.

**1.2 Integrar FAB + modal + botón categoría en `inventario/page.tsx`**
Desc: productFormOpen estado; handleProductCreated (fetchProducts con filtros actuales → setProducts + setError); handleCreateCategory (Swal patrón CategorySelector:99-160 — title, input text, inputLabel, maxlength 100, confirmButtonColor #ff385c, cancelButtonColor #6a6a6a, inputValidator vacío/>100; isConfirmed → createCategory({name: trim}) → éxito: getCategoryOptions + setCategories + Swal éxito; error P2002: Swal error sin mutar); FAB + ProductForm directo z-[60] al final del main (fuera de loading/error) SIN wrapper z-[70]; botón "Nueva categoría" en header (button-secondary STYLE.md).
AC: escenarios spec inventory-ui (FAB z-40 bajo modales z-[60]/BottomNav z-50; click abre "Nuevo Producto"; crear respeta filtros AND sin resetear; categoría disponible; duplicado P2002 → Swal error sin duplicar).
Riesgos: R1 lista stale (onSuccess obligatorio); R3 z-index/anidamiento (sin wrapper).
Deps: 1.1.

**1.3 Crear test FAB `src/app/inventario/components/InventarioPage.test.tsx`**
Desc: mock actions (getProductsWithBranchStock, getBranchOptions, getCategoryOptions, createCategory), sweetalert2, next/navigation, BranchContext (patrón MoveStockModal.test/ExportWizard.test). Casos: FAB presente; click → ProductForm "Nuevo Producto"; submit → getProductsWithBranchStock con filtros actuales; Swal categoría → createCategory(name.trim()); duplicado → Swal error.
AC: escenarios 1-5 spec inventory-ui; verde.
Riesgos: mocks frágiles (patrones existentes mitigan).
Deps: 1.2.

## Fase 2: app-navigation — BottomNav 6 ítems + redirect /productos

**2.1 Quitar ProductIcon + ítem de BottomNav**
Desc: eliminar ProductIcon (14-18) + ítem (53); quedan 6: dashboard, compras, ventas, inventario, sucursales, clientes.
AC: 6 ítems; sin referencias a ProductIcon; BottomNavMasMenu intacto.
Riesgos: —.
Deps: —.

**2.2 Convertir /productos en server page con redirect 307**
Desc: reemplazar productos/page.tsx (client 166 líneas) por server page: import redirect de next/navigation + redirect("/inventario"). No borrar productos/components/ (AddPurchaseButton/AddSaleButton importan ProductForm por ruta).
AC: GET /productos → 307 Location /inventario; sin 'use client'; sin UI propia.
Riesgos: R8 bookmarks (307 reversible); R5 huérfanos (no se borran).
Deps: —.

**2.3 Actualizar link de retorno de inactivos**
Desc: inactivos/page.tsx:99 href="/productos" → "/inventario"; copy "Volver a productos" → "Volver a inventario".
AC: link → /inventario; grep href="/productos" sin coincidencias navegables (revalidatePath no son navegación).
Riesgos: —.
Deps: —.

**2.4 Actualizar BottomNav.test.ts (7 → 6 + highlight)**
Desc: toHaveLength(6); retirar "Productos" del arrayContaining; highlight usa /inventario + getByRole link /inventario/i con clase text-[#ff385c].
AC: 6 links; highlight /inventario; verde.
Riesgos: —.
Deps: 2.1.

## Fase 3: product-management — revalidatePath + copies + verificación

**3.1 createCategory revalida /inventario**
Desc: actions/category.ts:37 agregar revalidatePath("/inventario") junto a revalidatePath('/categorias'). Sin cambios de contrato.
AC: revalida ambas; P2002 sin regresión; jest category verde.
Riesgos: —.
Deps: —.

**3.2 Actualizar copies stale → "sección Inventario"**
Desc: AddPurchaseButton.tsx:193 + AddSaleButton.tsx:274 "Primero creá un producto en la sección Productos" → "sección Inventario". Sin cambios de flujo. AddSaleButton incluido por decisión design.
AC: grep "sección Productos" = 0 en src/.
Riesgos: R2 (verificado: ningún test asevera texto viejo).
Deps: —.

**3.3 Verificar AddPurchaseButton.test.tsx + asertar copy**
Desc: suite existente verde (import ProductForm por ruta no roto); agregar aserción `screen.getByText(/sección Inventario/i)` en escenario 0 productos.
AC: jest AddPurchaseButton AddSaleButton verdes.
Riesgos: bajo.
Deps: 3.2.

## Fase 4: Cierre — verificación integral

**4.1 Gates completos**
Desc: npm test + tsc --noEmit + lint + build; corregir fallos.
AC: 4 gates verdes.
Deps: Fases 1-3.

**4.2 Verificación manual**
Desc: /inventario FAB rosa; FAB abre "Nuevo Producto" y alta aparece respetando filtros; "Nueva categoría" crea y queda en InventoryFilters; duplicado error; GET /productos → 307; BottomNav 6; inactivos → /inventario; modal compra/venta "sección Inventario".
AC: success criteria proposal; sin merge a main.
Deps: 4.1.

## Delivery Plan (auto-chain + feature-branch-chain)

- Rama tracker: `feat/unificar-productos-inventario` — NO se mergea a main.
- PR 1 (Fase 1 + test): commits — `feat(inventory-ui): parametrize AddProductButton with controlled open/onOpenChange/onSuccess`, `feat(inventory-ui): add create-product FAB and create-category button to /inventario`, `test(inventory-ui): add InventarioPage FAB test`
- PR 2 (Fase 2): `feat(app-navigation): remove Productos item from BottomNav`, `feat(app-navigation): redirect /productos to /inventario (307)`, `fix(app-navigation): point inactivos back-link to /inventario`, `test(app-navigation): update BottomNav tests to 6 items`
- PR 3 (Fase 3): `fix(product-management): revalidate /inventario in createCategory`, `fix(product-management): update stale "sección Productos" copy in purchase/sale buttons`, `test(product-management): assert updated copy in AddPurchaseButton`
- Rollback global: revertir rama feature restaura /productos original (307 reversible).