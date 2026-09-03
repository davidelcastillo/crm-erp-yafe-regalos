# Domain: product-management — Delta

## Delta

No existe spec base en `openspec/specs/product-management/spec.md`; el delta se define contra el comportamiento actual verificado en código: `createCategory` en `src/app/actions/category.ts:29-55` (el contrato de CRUD de categorías vive en `openspec/specs/category-management/spec.md` y no cambia). Este delta: (1) `createCategory` agrega `revalidatePath("/inventario")` junto al `revalidatePath('/categorias')` existente (línea 37), sin cambios de schema ni mensajes; y (2) actualiza el copy stale de `AddPurchaseButton.tsx:193` ("Primero creá un producto en la sección Productos" → "sección Inventario"), cambio menor de texto incluido en scope por decisión de spec.

## Requirements

1. **`createCategory` revalida `/inventario` (SHALL)** — la Server Action `createCategory` SHALL ejecutar `revalidatePath("/inventario")` además del `revalidatePath('/categorias')` existente, tras una creación exitosa. El orden del flujo (`createCategorySchema.parse` → `prisma.category.create` → revalidación → retorno `{ success: true, data }`) SHALL permanecer intacto.
2. **Contrato de `createCategory` sin cambios (SHALL NOT)** — el schema Zod `{ name }` (1-100 caracteres), el rechazo de nombres duplicados con P2002 → "Ya existe una categoría con ese nombre", y el resto de mensajes de error SHALL NOT modificarse.
3. **Copy de `AddPurchaseButton` actualizado (SHALL)** — la línea 193 de `src/app/compras/components/AddPurchaseButton.tsx` SHALL reemplazar el texto "Primero creá un producto en la sección Productos" por "Primero creá un producto en la sección Inventario". El flujo del componente (import de `ProductForm` por ruta de archivo, apertura en `z-[70]`, `handleProductCreated`) SHALL NOT cambiar.

## Scenarios

#### Scenario: createCategory revalida ambas rutas
- GIVEN un admin crea la categoría "Limpieza" desde `/inventario` (o desde `/categorias`)
- WHEN `createCategory` completa con éxito
- THEN `revalidatePath('/categorias')` SHALL ejecutarse como hasta ahora
- AND `revalidatePath("/inventario")` SHALL ejecutarse también, invalidando el cache de ambas rutas

#### Scenario: createCategory rechaza duplicados (sin regresión)
- GIVEN una categoría "Limpieza" existente
- WHEN se llama `createCategory({ name: "Limpieza" })`
- THEN la action SHALL devolver `{ success: false, error: "Ya existe una categoría con ese nombre" }` (P2002)
- AND SHALL NOT crear filas ni ejecutar revalidación

#### Scenario: AddPurchaseButton sin regresión y con copy correcto
- GIVEN el modal de nueva compra abierto con 0 productos registrados
- THEN el mensaje SHALL decir "Primero creá un producto en la sección Inventario"
- AND el botón "Crear producto" SHALL seguir abriendo `ProductForm` (import por ruta de archivo) y el alta SHALL refrescar el autocomplete como hasta ahora

## Out of Scope

- No se modifica el schema de Prisma, migraciones ni seed.
- No se tocan `updateCategory`, `deleteCategory`, `getCategories`, `getCategoryById` ni `getCategoryOptions`.
- No se reemplaza el import por ruta de archivo de `ProductForm` en `AddPurchaseButton` por una URL de página.
- No se agrega `revalidatePath` a `createProduct` (el refresh de `/inventario` tras crear producto es responsabilidad del cliente vía `handleProductCreated`).