# Domain: inventory-ui — Delta

## Delta

`/inventario` pasa a ser la única superficie de gestión de productos: se agrega (1) un FAB "Agregar producto" que reutiliza `AddProductButton` parametrizado con la prop opcional `onSuccess`, (2) el estado `productFormOpen` y el handler `handleProductCreated` que re-ejecuta `fetchProducts` respetando los filtros activos, (3) un botón "Nueva categoría" en el header que abre un Swal input siguiendo el patrón de `CategorySelector` y refresca las categorías tras crear, y (4) el render de `<ProductForm product={null} onSuccess={handleProductCreated}>` con su scrim `z-[60]` directo, sin el wrapper `z-[70]` que usaba `/productos`. El spec base (filtro controlado de sucursal, composición AND de filtros, `MoveStockModal`) no cambia: este delta solo agrega la creación de producto y de categoría.

## Requirements

1. **Estado `productFormOpen` (SHALL)** — la página SHALL declarar el estado `productFormOpen: boolean` (inicial `false`) que controla la apertura del modal de creación de producto. El FAB SHALL ser el único disparador de `setProductFormOpen(true)` y el `onClose` de `ProductForm` SHALL devolverlo a `false`.
2. **FAB "Agregar producto" (SHALL)** — `/inventario` SHALL renderizar `AddProductButton` reutilizado sin cambios de estilo: clase exacta `fixed bottom-24 right-6 w-14 h-14 bg-[#ff385c] text-white rounded-full shadow-lg hover:bg-[#e00b41] transition-colors flex items-center justify-center z-40`, icono SVG `+` de 24×24 y `aria-label="Agregar producto"`. El FAB SHALL quedar cubierto por los scrims `z-[60]` cuando un modal esté abierto (decisión resuelta: FAB `z-40` estándar).
3. **`AddProductButton` parametrizado con `onSuccess` (SHALL)** — `AddProductButton` SHALL aceptar la prop opcional `onSuccess?: (product: Product) => void` y SHALL reenviarla a `<ProductForm>`. Cuando la prop está ausente, `ProductForm` SHALL conservar su fallback actual (`router.refresh()`), garantizando compatibilidad total con los callers existentes.
4. **Modal de creación sin wrapper anidado (SHALL)** — la página SHALL renderizar `<ProductForm product={null} onSuccess={handleProductCreated} />` directamente (título "Nuevo Producto"), usando el scrim propio de `ProductForm` (`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center`) y el contenedor `bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto`. La página SHALL NOT envolver `ProductForm` en un wrapper `z-[70]` adicional.
5. **`handleProductCreated` refetchea con filtros activos (SHALL)** — al crearse un producto, la página SHALL re-ejecutar `fetchProducts(branchId, selectedCategoryId, debouncedSearch)` con los valores ACTUALES de los filtros (sin resetearlos) y SHALL actualizar la lista con `setProducts(data)`, limpiando `error`. Ante un fallo del refetch, SHALL mostrar el error visible con el patrón existente (`setError`) sin romper el cierre del modal.
6. **Botón "Nueva categoría" en el header (SHALL)** — `/inventario` SHALL mostrar un botón "Nueva categoría" junto al grupo de acciones del header (Mover Stock / Exportar / Inactivos) siguiendo `button-secondary` de STYLE.md: `px-4 py-2 min-h-[44px] text-sm font-medium text-[#222222] bg-white border border-gray-200 rounded-xl hover:bg-[#f2f2f2] transition-colors touch-manipulation`, con `aria-label="Nueva categoría"`.
7. **Flujo Swal de creación de categoría (SHALL)** — el click en "Nueva categoría" SHALL abrir `Swal.fire` con el patrón exacto de `CategorySelector.tsx:99-160`: `title: "Nueva categoría"`, `input: "text"`, `inputLabel: "Nombre"`, `inputPlaceholder: "Ej: Limpieza, Alimentos…"`, `inputAttributes: { maxlength: "100", autocapitalize: "on" }`, `showCancelButton: true`, `confirmButtonText: "Crear"`, `cancelButtonText: "Cancelar"`, `confirmButtonColor: "#ff385c"`, `cancelButtonColor: "#6a6a6a"`, `background: "#ffffff"`, `color: "#222222"`, e `inputValidator` que rechace nombre vacío (o solo espacios) y mayor a 100 caracteres. Si `isConfirmed`, SHALL llamar `createCategory({ name: modal.value.trim() })`.
8. **Refresh de categorías y feedback (SHALL)** — ante éxito, la página SHALL re-ejecutar `getCategoryOptions()` y actualizar `setCategories` (alimenta `InventoryFilters` y las cards de la lista), y SHALL mostrar Swal éxito ("Categoría creada" con `confirmButtonColor: "#ff385c"`). Ante error (incluido P2002 de nombre duplicado), SHALL mostrar Swal error con `result.error` y SHALL NOT mutar la lista local de categorías.
9. **Test del FAB en `/inventario` (SHALL)** — SHALL existir un test nuevo (Jest + RTL, actions mockeadas) que verifique: FAB presente con `aria-label="Agregar producto"`, click abre `ProductForm` ("Nuevo Producto") y el submit dispara el refetch con los filtros activos.

## Scenarios

#### Scenario: FAB visible en /inventario
- GIVEN el admin autenticado abre `/inventario` con la lista cargada
- THEN un botón circular fijo `#ff385c` (56×56, `bottom-24 right-6`, `z-40`) con `aria-label="Agregar producto"` SHALL estar visible sobre el contenido
- AND el FAB SHALL quedar por debajo del BottomNav (`z-50`) y de los scrims de modales (`z-[60]`)

#### Scenario: Click en el FAB abre el ProductForm
- GIVEN el FAB visible y sin modales abiertos
- WHEN el admin toca el FAB
- THEN `productFormOpen` SHALL pasar a `true` y se renderiza `ProductForm` con `product={null}` (título "Nuevo Producto")
- AND el scrim `z-[60]` SHALL cubrir el FAB sin wrapper adicional `z-[70]`

#### Scenario: Crear producto respeta los filtros activos
- GIVEN sucursal B1, categoría "Limpieza" y búsqueda "jabón" activas en `/inventario`
- WHEN el admin crea el producto "Jabón de Avena" desde el FAB y confirma
- THEN `handleProductCreated` SHALL re-ejecutar `fetchProducts(branchId=B1, selectedCategoryId=Limpieza, debouncedSearch="jabón")` y actualizar la lista con el resultado
- AND si el producto creado no matchea los filtros activos, SHALL NOT aparecer en la lista (comportamiento correcto del AND; los filtros SHALL NOT resetearse)

#### Scenario: Crear categoría desde /inventario (éxito)
- GIVEN el header de `/inventario` con el botón "Nueva categoría"
- WHEN el admin ingresa "Alimentos" en el Swal input y confirma
- THEN `createCategory({ name: "Alimentos" })` SHALL ejecutarse y, ante éxito, `getCategoryOptions()` SHALL refrescar `categories`
- AND la nueva categoría SHALL quedar disponible en `InventoryFilters` y en cualquier selector de categoría de la página, con Swal éxito visible

#### Scenario: Categoría duplicada
- GIVEN una categoría "Alimentos" ya existente
- WHEN el admin intenta crear "Alimentos" desde `/inventario`
- THEN `createCategory` SHALL devolver el error P2002 ("Ya existe una categoría con ese nombre") y la página SHALL mostrar Swal error
- AND la lista local de categorías SHALL NOT duplicar "Alimentos"

## Out of Scope

- No se modifica la lógica de `InventarioList`, `InventarioCard`, `InventoryFilters`, `MoveStockModal`, `MovementsModal`, `LabelSelector` ni `ExportWizard`.
- No se extrae `FloatingActionButton` a `components/ui` (alternativa descartada por minimalismo).
- No se cambia el submit ink de `ProductForm` (`bg-[#222222]`) ni el contrato de `createProduct`.
- No se tocan los componentes huérfanos de `/productos` (`ProductCard`, `DeleteButton`).