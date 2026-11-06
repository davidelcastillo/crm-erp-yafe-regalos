# Alta masiva de productos

Objetivo: crear muchos productos en una sola transacción y desde un mismo modal, porque el cliente a veces carga decenas de productos y hacerlo de a uno tarda demasiado.
Rama de trabajo: `feat/productos-alta-masiva`, creada desde `bfeae6c` (`feat/orden-listas-modales`), en `D:/SeguimientosCompras/seguimientos-compras`. El análisis se hizo sobre `91adc2f` y se verificaron las diferencias con el hermano.

## Specs

Decisiones del humano, citadas textualmente. Las citas largas son transcripción de la sesión.

- **S1.** Alta masiva en una sola transacción y en un mismo modal: «que en una misma transacción y dentro de un mismo modal,puedamos crear varios productos, porque aveces el clnte debe crear muchos productos y el proceso acrual de crear uno por uno lleva mucho tiempo».
- **S2.** El ingreso de stock genera movimiento y comprobante: «yo cada vez que hago un ingreso/egreso a una sucursal deberia: 1. Generarse el movimieno de stock. 2. Generar un PDF con el detalle del movimeinto (como ya tenemos para la parte de ingreso stock)». Aplica al stock inicial del alta masiva.
- **S3.** Nombres: «Rechazar también los ya existentes» y, sobre los inactivos, «No, solo los activos».
- **S4.** Categoría: **una por fila**, no compartida. El humano corrigió la decisión anterior: «las categorias las pognamos por cada producto una distinta».
- **S10.** Modal: el botón de nueva categoría «se ve mal, el de nueva categoria se ve salido de pantalla en pc chicas».
- **S11.** Producto creado sin stock no aparece en la vista por sucursal: «Creo los productos pero no me sale nada de la sucurasal»
- **S12.** Crear categoría desde cada fila del lote: «Si, recueperemos el de crear categoria por producto». Vuelve el atajo «+ Nueva categoría», ahora por fila y sin multiplicar las cargas.
- **S5.** Entrada: «Paso previo con dos opciones» (un producto / varios productos).
- **S6.** Tope: «50 filas» por envío.
- **S7.** Falla: «Todo o nada».
- **S8.** Bug H2, la categoría que se descarta al crear: «Corregirlo en esta entrega».
- **S9.** Sucursal: global para todo el lote (D8). Comprobante: el de ingreso actual, sin trabajo de PDF nuevo (D9). Etiquetas: unidad siguiente (T7), fuera de esta entrega. Stock 0: deja la fila de inventario en 0, sin movimiento ni comprobante. Sigue abierto solo los campos de cada fila (D5).

## Tasks

| ID | Tarea | Specs | Ruta principal | Estado | Commit |
|---|---|---|---|---|---|
| T1 | Extraer el helper de la clave del lock y mover `createProductSchema` a `src/lib/validations/product.ts`, con la regresión del alta individual | S1 | `src/app/actions/product.ts`, `src/lib/validations/product.ts` | hecho | `704d765` |
| T2 | `createProductsBatchSchema` y `createProductsBatch` solo productos (sin stock), nombres existentes activos, todo o nada | S1, S3, S4, S7 | `src/lib/validations/product.ts`, `src/app/actions/product.ts` | hecho | `171fb66` |
| T3 | Tests del lote: unitarios con Prisma mockeado y casos 1 a 8 en base local | S1, S3, S7 | `src/app/actions/product.test.ts`, `src/app/actions/product.batch.local-db.test.ts` | absorbida por T2 | — |
| T2b | Completar la prueba de T2: atomicidad después del insert, misma clave de lock que el alta individual, `revalidatePath` | S7 | `src/app/actions/product.test.ts`, `src/app/actions/product.batch.local-db.test.ts` | hecho | `589c3ff` |
| T4 | `BulkProductForm` con el paso previo y la guía en `docs/` | S1, S5, S6 | `src/app/productos/components/BulkProductForm.tsx`, `src/app/inventario/page.tsx`, `docs/` | hecho | `2ea6a63` |
| T8 | Categoría por fila en vez de compartida | S4 | `src/lib/validations/product.ts`, `src/app/actions/product.ts`, `src/app/productos/components/BulkProductForm.tsx` | hecho | `3f26f81` |
| T9 | El botón de nueva categoría desborda en pantallas chicas | S10 | `src/components/ui/CategorySelector.tsx` | hecho | `7f990a8` |
| T10 | Recuperar «+ Nueva categoría» por fila sin multiplicar las cargas | S12 | `src/components/ui/CategorySelector.tsx`, `src/app/productos/components/BulkProductForm.tsx` | pendiente | — |
| T5 | Stock inicial con sucursal global, movimiento ENTRY y comprobante sin etiquetas | S2, S11 | `src/app/actions/product.ts`, `src/app/productos/components/BulkProductForm.tsx` | pendiente (D5) | — |
| T7 | Verificar el comprobante con etiquetas de un lote real (sale gratis del panel reusado) | S2 | `src/app/inventario/components/StockMovementReceiptPanel.tsx`, `src/actions/label-print.ts` | pendiente, cambia a verificación | — |
| T6 | Corregir H2: la categoría elegida al crear se descarta | S8 | `src/app/productos/components/ProductForm.tsx`, `src/app/actions/product.ts` | pendiente | — |

Orden de entrega: T1, T2 (con T3 adentro), T2b, T4, T9, T8, T10, T6, T5 y después T7 (etiquetas).

**T3 se absorbió en T2**: el escritor hizo los tests junto con la acción, con RED observado primero (6 unitarios y 9 casos de base local). No se hizo como unidad aparte para no comitear una acción sin su prueba.

**Slice de entrega.** La rama `feat/productos-alta-masiva` está apoyada en `bfeae6c` (`feat/orden-listas-modales`), que aporta dos commits y unas 1.300 líneas ajenas a esta feature. Por eso el conteo contra `main` no mide este trabajo: el slice real es cada unidad de esta tabla, y el PR tiene que apuntar a `feat/orden-listas-modales`, no a `main`.
Actualización: D1 redefinida por el humano (stock, movimiento y comprobante). Las citas marcadas **(hermano)** son del worktree `D:/SeguimientosCompras/seguimientos-compras`, rama `feat/orden-listas-modales`, commit `bfeae6c`.

## Hallazgos del codigo actual

### Modelo de datos

- `Product` (`prisma/schema.prisma:11-28`):
  - `code` es único global (`:17`);
  - `codePrefix` puede ser nulo (`:18`);
  - `price` es `Decimal(10,2)` (`:19`);
  - `categoryId` es opcional (`:20-21`);
  - `active` es la baja lógica (`:22`), aunque `deleteProduct` borra de verdad (`src/app/actions/product.ts:205`), así que no es un soft-delete estricto;
  - `name` no tiene restricción única (`:13`).
- `Category.name` es único (`prisma/schema.prisma:157-161`).
- El stock no vive en `Product` sino en `BranchInventory`, única por `(branchId, productId)` (`prisma/schema.prisma:56-68`, `:65`).
- La auditoría de stock es `BranchMovement` con `MovementType` ENTRY/EXIT/TRANSFER_*/ADJUSTMENT y `performedBy` (`prisma/schema.prisma:163-182`).
- `Purchase` y `PurchaseItem` llevan el dinero de la entrada de mercadería (`prisma/schema.prisma:70-95`).

### Flujo actual de alta de un producto (pantalla, acción y base)

1. `/productos` solo redirige a `/inventario` (`src/app/productos/page.tsx:3-4`).
2. En `/inventario`, el botón flotante `AddProductButton` funciona en modo controlado y la página renderiza `ProductForm` con `product={null}` (`src/app/inventario/page.tsx:495-506`). El modo no controlado sigue existiendo (`src/app/productos/components/AddProductButton.tsx:56-58`).
3. Hay un segundo consumidor de `ProductForm`: el alta rápida desde compras (`src/app/compras/components/AddPurchaseButton.tsx:391-397`).
4. `ProductForm` arma el payload de alta `{ name, description, prefix, price }` (`src/app/productos/components/ProductForm.tsx:92-101`) y llama a `createProduct` (`:103-105`).
   - Si sale bien muestra un Swal y llama a `onSuccess` o a `router.refresh` (`:107-127`).
   - Si falla muestra un Swal con el error (`:129-135`).
5. `onSuccess` vuelve a pedir la lista (`src/app/inventario/page.tsx:176-184`).
6. La acción `createProduct` (`src/app/actions/product.ts:57-123`):
   - autoriza con `requireAdmin` (`:59-60`), que devuelve `{ ok, email }` (`src/lib/auth-guard.ts:13-15`, `:34`);
   - valida con `createProductSchema` (`src/app/actions/product.ts:16-21`, parse en `:62`). El esquema no acepta categoría, sucursal ni stock;
   - reintenta hasta 3 veces ante P2002 (`:65-106`, `:53-55`);
   - dentro de la transacción:
     - toma `pg_advisory_xact_lock` con una clave que es la suma de los charCodes del prefijo (`:72-73`);
     - lee los códigos de ese `codePrefix` (`:76-79`);
     - calcula el siguiente código con `getNextCode` (`:83`);
     - crea el producto con descripción "-" por defecto (`:86-94`);
   - maneja errores así: Zod devuelve los mensajes unidos (`:111-116`), "agotado" se pasa tal cual (`:117-119`) y el resto queda como mensaje genérico (`:120-121`);
   - no llama a `revalidatePath`. Otras acciones de producto sí lo hacen (`src/app/actions/product.ts:395-397`, `:522-525`).
7. `getNextCode` calcula máximo + 1 por prefijo y corta en 999 con el error "Prefijo X agotado" (`src/lib/utils/product-code.ts:13-41`, `:35-37`).

### Dónde vive cada cosa

- **Validación:** el esquema está inline en la acción (`src/app/actions/product.ts:16-21`). El esquema extendido de edición sí está en `src/lib/validations/product.ts:14-21`. El cliente no valida más allá de `required`/`maxLength` del HTML (`ProductForm.tsx:176`, `:240-247`).
- **Sucursal y stock:** el alta no inicializa nada. La fila de `BranchInventory` aparece con:
  - una compra (`src/app/actions/purchase.ts:75-90` y la inserción en crudo con `ON CONFLICT` en `:301-332`);
  - un ajuste de ENTRADA (`src/app/actions/inventory.ts:726-733`);
  - una asignación (`src/app/actions/inventory.ts:329-334`).

### Hallazgos que afectan el diseño

- **H1. El producto nuevo no se ve en la vista por sucursal.** Con una sucursal elegida, `getProductsWithBranchStock` exige al menos una fila de `BranchInventory` en esa sucursal (`src/app/actions/inventory.ts:247-254`). Un producto recién creado no aparece en `/inventario` filtrado por sucursal hasta su primera compra o ajuste.
- **H2. Bug previo: la categoría elegida al crear se descarta sin avisar.** El formulario de alta muestra `CategorySelector` (`ProductForm.tsx:274-281`), pero el payload no manda `categoryId` (`:92-101`; el comentario `:97-100` lo admite) y el esquema tampoco lo acepta (`src/app/actions/product.ts:16-21`).
- **H3. Caso previo de códigos legacy.** Un código heredado con `codePrefix` nulo y forma `AA005` queda fuera de la búsqueda (`src/app/actions/product.ts:76-79`). `getNextCode` puede generar el mismo código, la base devuelve P2002 en los 3 intentos y el usuario ve "Error al crear el producto". Afecta igual al alta individual.
- **H4. La clave del lock tiene colisiones**: por ejemplo, "AB" y "BA" dan la misma suma (`src/app/actions/product.ts:72`). Solo serializa de más, no rompe nada. Si el lote toma varios locks, hay que ordenarlos y quitar los repetidos para evitar deadlocks.
- **H5. El precio no tiene máximo** (`src/app/actions/product.ts:20`), pero la columna es `Decimal(10,2)`. Un desborde lo rechaza la base y la transacción hace rollback, así que no se guarda nada corrupto. El usuario ve un mensaje genérico. Es una advertencia previa al cambio.
- **H6. Lección de producción:** una transacción interactiva con un viaje a la base por ítem se cortaba a los 5 s (P2028) en el control de stock (`src/app/actions/stockControl.local-db.test.ts:6-9`). El lote no debe hacer un viaje por fila.

### Patrones de lote reutilizables

- **`adjustBranchStockBatch`** (`src/app/actions/inventory.ts:709-828`):
  - verifica que la sucursal esté activa (`:718-724`);
  - hace `upsert` de ENTRADA (`:726-733`);
  - crea los movimientos en un solo `createMany` con `performedBy` (`:765-774`);
  - lee el stock final en una sola consulta, sin N+1 (`:777-781`);
  - mapea los errores conocidos (`:812-827`).
- **`moveStockBatchBetweenBranches`** valida todo antes de la primera escritura, con rollback total (`src/app/actions/inventory.ts:544-577`; primera escritura en `:609`).
- **Esquemas de lote:** usan `min(1)` y un refine contra duplicados (`src/lib/validations/branchMovement.ts:52-74`, `:63-66`; `:82-99`, `:93-96`). Ninguno tiene `max`.
- **Compras** (`src/app/actions/purchase.ts:283-357`):
  - `createMany` de los ítems (`:291-299`);
  - `INSERT ... ON CONFLICT` en un solo viaje (`:301-332`);
  - timeout explícito de 20 s (`:244`, `:356`);
  - reintentos ante errores transitorios (`:369-399`);
  - validación previa fuera de la transacción (`:411-446`).
- **Alta de filas en UI:** `addItem`/`removeItem` con id por `useRef` (`src/app/compras/components/AddPurchaseButton.tsx:40-59`) y una card "Producto N" por fila (`:202-206`).

### Tests existentes relevantes

- `src/app/actions/product.test.ts` mockea Prisma (`:6-35`) y prueba la validación de `createProduct` (`:104-135`) y la autorización (`:334-337`).
- La autorización se mockea globalmente como admin (`jest.setup.ts:40-46`).
- `src/app/productos/components/ProductForm.test.tsx` mockea las acciones y Swal (`:10`, `:44-45`); tiene 11 casos (`:92-431`).
- **Patrón de base local:** `src/app/actions/stockControl.local-db.test.ts:1`, `:18`, `:20`, `:36-50` (entorno node, `resetModules`, import dinámico, fixtures con sufijo aleatorio). `src/lib/prisma.ts:37-38` rechaza bases no locales en tests.

## Diseno propuesto

### Contrato (Zod + Server Action)

Los esquemas van en `src/lib/validations/product.ts`, para usarlos en cliente y servidor. `createProductSchema` se **mueve** desde `src/app/actions/product.ts:16-21` sin cambiar sus mensajes y se reusa como esquema de fila.

```ts
export const createProductSchema = z.object({ /* idéntico a product.ts:16-21 */ });

export const createProductsBatchSchema = z.object({
  categoryId: z.number().int().positive("Categoría inválida").nullable(), // compartida para todas (D3)
  branchId: z.number().int().positive("Sucursal inválida"), // global para todo el lote (D1, D8)
  rows: z
    .array(createProductSchema.extend({
      initialStock: z.number().int().min(0, "El stock no puede ser negativo"), // D1
    }))
    .min(1, "Agregá al menos un producto")
    .max(50, "Máximo 50 productos por carga"), // D6
  // refine de nombres duplicados dentro del lote (patrón branchMovement.ts:63-66);
  // el choque con nombres que ya existen se valida en el servidor (D2 = C)
});
```

La acción vive en `src/app/actions/product.ts`:

```ts
export async function createProductsBatch(data: unknown): Promise<
  | { success: true; data: {
      products: { id: number; code: string; name: string }[]; // en el orden de las filas
      receipt: StockMovementReceipt | null;                    // null si ninguna fila trae stock
    } }
  | { success: false; error: string; rowErrors?: { row: number; field?: string; message: string }[] }
>;
```

- `row` empieza en 0; la UI muestra `row + 1`.
- Los errores de Zod se mapean por `issue.path` (`["rows", i, campo]`) a `rowErrors`, con **todas** las filas inválidas, no solo la primera.
- Los errores que no son de una fila, como `categoryId`, van en `error`.

### Transaccion y semantica de error

1. `requireAdmin`. El responsable de los movimientos es `auth.email` (`src/lib/auth-guard.ts:34`). Ojo: `requireAdmin` devuelve `email: user.email ?? ""` y `BranchMovement.performedBy` es obligatorio (`prisma/schema.prisma:173`), así que hace falta un fallback explícito antes de escribir el movimiento, no un string vacío.
2. `safeParse` del lote. Si falla, devuelve `rowErrors` sin tocar la base.
3. Validación previa fuera de la transacción: la categoría existe, la sucursal está activa y ningún nombre choca con un producto existente, sin distinguir mayúsculas e incluyendo inactivos (D2 = C). La sucursal se vuelve a comprobar dentro de la transacción, como `src/app/actions/inventory.ts:718-724`. Es el patrón de `src/app/actions/purchase.ts:411-446`, que es el único caso realmente previo a la transacción: el bloque `src/app/actions/inventory.ts:718-724` está **dentro** del `$transaction` que abre en `:717`, así que no sirve como patrón pre-transacción.
4. `prisma.$transaction(async (tx) => ..., { timeout: 20_000 })`, igual que `src/app/actions/purchase.ts:356`:
   1. **Locks:** se extrae el cálculo de la clave de `src/app/actions/product.ts:72` a un helper que usan **también** `createProduct` y el lote, para que se serialicen entre sí. Se toma un `pg_advisory_xact_lock` por clave, ordenadas y sin repetir (H4).
   2. **Códigos existentes:** un solo `findMany` con `codePrefix in [...]`, con la misma forma que `src/app/actions/product.ts:76-79`.
   3. **Códigos nuevos en memoria:** `getNextCode` por fila, agregando cada código generado a la lista de su prefijo. Así se reusa el tope de 999 y el mensaje "agotado".
   4. **Inserción:** `tx.product.createManyAndReturn(...)` en un solo viaje (Prisma 6.19.3, `package.json:16`), con `description || "-"` como en `src/app/actions/product.ts:89` y el `categoryId` compartido. Los resultados se mapean **por `code`** (generado antes del insert) para devolverlos en el orden de las filas sin depender del orden del `RETURNING`.
   5. **Stock inicial, movimiento y comprobante** (D1): ver la sección "Comprobante del ingreso inicial".
5. Reintento del lote entero ante P2002, igual que `src/app/actions/product.ts:98-105`.
6. `revalidatePath("/inventario")`, `revalidatePath("/productos")` y `revalidatePath("/movimientos")`.

**Semántica de error: todo o nada (D7).** Cualquier error aborta la transacción y no se guarda ninguna fila.
- Error de Zod: `rowErrors` con todas las filas fallidas.
- "Prefijo X agotado": `error` con ese mensaje, y `rowErrors` para las filas con ese prefijo.
- Categoría inexistente (P2003): "La categoría seleccionada no existe", como en `src/app/actions/product.ts:534-542`.
- Sucursal inactiva: "Sucursal inválida o inactiva", como en `src/app/actions/inventory.ts:723`.
- Nombre que ya existe (D2 = C): `rowErrors` en esas filas con "Ya existe un producto con ese nombre".
- Cualquier otro error: "Error al crear los productos", con `console.error`, sin `rowErrors`.
- El cliente conserva todas las filas para corregir y reenviar.

### UI del modal (mobile)

Es un componente nuevo, `src/app/productos/components/BulkProductForm.tsx`, separado de `ProductForm` para no tocar sus dos consumidores.

**Contenedor:**
- Bottom-sheet igual al actual (`ProductForm.tsx:145-148`), montado en un portal al `body` (`STYLE.md:646`).
- Altura `max-h-[90dvh]`, con scroll vertical en el cuerpo.
- Cerrar con `btn btn-icon btn-round` (`STYLE.md:531`). Si alguna fila tiene datos, se pide confirmación antes de descartar.

**Orden en el celular** (primero el contexto, después la acción; `STYLE.md:591`):
1. **Bloque "Para todas":**
   - `CategorySelector`, el mismo de `ProductForm.tsx:276-280` (D3: solo compartida);
   - `BranchPicker` para la sucursal global (`STYLE.md:603`, D8) y el "Stock inicial" por defecto con el que arranca cada fila nueva.
2. **Lista de filas:** una card por fila con el rótulo "Producto N", como en `AddPurchaseButton.tsx:202-206`. Campos por fila (D5):
   - **Nombre\***;
   - **Prefijo\***: `maxLength=4` y `autoCapitalize="characters"`; una fila nueva copia el prefijo de la anterior;
   - **Precio\***: `inputMode="decimal"`, `step=0.01`, `min=0`;
   - **Stock inicial**: `inputMode="numeric"`, entero ≥ 0, precargado con el valor por defecto.
3. **Pie fijo** (`sticky bottom-0`, `padding-bottom: env(safe-area-inset-bottom)`):
   - "+ Agregar producto", deshabilitado al llegar a 50 con el texto "Máximo 50";
   - un único `btn btn-primary` "Crear N productos" (`STYLE.md:525`, `:537`).

**Agregar y quitar filas:**
- Mismo patrón que `AddPurchaseButton.tsx:40-59`, con id estable por `useRef`.
- La última fila no se puede quitar.
- Quitar una fila con datos pide confirmación; quitar una fila vacía no.
- Al agregar una fila, el foco va a su Nombre, con `scrollIntoView({ block: "nearest" })`.

**Teclado:**
- Enter **no** envía el formulario: pasa al campo siguiente (`enterKeyHint="next"`). En el último campo de la última fila, Enter agrega una fila nueva.
- Se envía solo con el botón.
- Los inputs llevan `scroll-margin-bottom` para que el pie fijo no tape el campo con foco.

**Accesibilidad:**
- Cada input tiene un `<label htmlFor>` con id único (`bulk-row-3-name`).
- El botón de quitar lleva `aria-label="Quitar producto 3"`.
- Los targets táctiles miden 44 px o más (`STYLE.md:530`).

**Error por fila:**
- El campo lleva `aria-invalid="true"` y `aria-describedby` apuntando a un `<p>` con el mensaje.
- La card toma el borde de error, con el par `#ffe4ea` / `#8f0020` del estado de error (`STYLE.md`, sección "Carga y estados vacíos").
- Arriba de la lista va un resumen `role="alert"` ("3 filas con errores") con botones que enfocan la primera fila con error. Al fallar el envío, el foco va a ese resumen.

**Validación y resultado:**
- Antes de llamar a la acción se valida en el cliente con el mismo esquema, para no hacer un viaje inútil. El servidor sigue siendo la autoridad.
- Si sale bien y hay `receipt`: el modal se reemplaza por `StockMovementReceiptPanel` con ese snapshot, igual que `StockAdjustmentModal` (hermano `src/app/inventario/components/StockAdjustmentModal.tsx:211-223`). Se llama a `onSuccess()` para que la página vuelva a pedir la lista (`src/app/inventario/page.tsx:176-184`). El modal se cierra cuando se cierra el panel.
- Si sale bien sin `receipt` (ninguna fila con stock): Swal con la cantidad creada, `onSuccess()` y cierre.

**Desde `md`:** dos columnas, con las filas a la izquierda y el bloque "Para todas" más la acción a la derecha con `md:sticky md:top-4` (`STYLE.md:584-592`).

### Límites

- **Filas:** máximo 50 por envío (D6), validado en Zod en cliente y servidor. Los esquemas de lote actuales no tienen tope (`src/lib/validations/branchMovement.ts:56-66`, `src/lib/validations/purchase.ts:24`).
- **Tamaño del payload:** 50 filas × (255 de nombre + 500 de descripción + prefijo y precio) da menos de 50 KB. No hay `bodySizeLimit` en `next.config`, así que rige el límite por defecto de Server Actions de Next, que según su documentación es 1 MB. No lo verifiqué contra la versión instalada.
- **Viajes a la base:** constantes, cualquiera sea N: los locks (uno por clave), un `findMany`, un `createManyAndReturn` de productos, una consulta de nombres existentes (D2) y, con stock, un `createManyAndReturn` de `BranchInventory` y un `createMany` de movimientos. Esto evita el problema H6.
- **Orden:** el de las filas. Dentro de cada prefijo los códigos suben en ese mismo orden, y la respuesta respeta el orden de entrada.
  - Todos los productos comparten `createdAt`, así que `getProducts`, que ordena por `createdAt desc` (`src/app/actions/product.ts:135`), empata. `/inventario` ordena por código por defecto: el `orderBy` de `src/app/actions/inventory.ts:270` lo pisa `sortProducts` en `:283`, cuyo modo por defecto es `code` (`src/lib/product-order.ts:51-64`). Así que el empate no le afecta.
- **Falla parcial:** no existe, es todo o nada (D7). Se informa con `rowErrors`, y las filas quedan en pantalla para corregirlas.

### Plan de tests (local-db) y riesgo de regresion

**Unitarios** (`npm test`, con Prisma mockeado como en `src/app/actions/product.test.ts:6-35`; el mock tiene que sumar `createManyAndReturn`):
- El esquema acepta 1 y 50 filas, rechaza 0 y 51, y los errores llevan el índice de la fila en `path`.
- `createProductsBatch` sin sesión admin no toca Prisma, con el patrón de `src/app/actions/product.test.ts:334-337`.
- Un error de Zod devuelve `rowErrors` con todas las filas inválidas.
- `src/app/productos/components/BulkProductForm.test.tsx`:
  - agregar y quitar filas; la última no se puede quitar;
  - el tope de 50;
  - Enter no envía;
  - el error por fila se ve con `aria-invalid`/`aria-describedby` y el resumen `role="alert"`;
  - si sale bien llama a `onSuccess` y cierra; si falla conserva las filas.

**Integración contra la base local** (`npm run test:local-db -- src/app/actions/product.batch.local-db.test.ts`), con el patrón de `src/app/actions/stockControl.local-db.test.ts:1-50`. Casos RED:

1. 30 filas del mismo prefijo nuevo: se crean 30 productos con códigos `XX000` a `XX029` en el orden de las filas, y la respuesta respeta ese orden.
2. Prefijos mezclados con un `XX005` existente: la secuencia sigue en `XX006` y el otro prefijo empieza en 000.
3. La fila 17 sin nombre: `success: false`, `rowErrors` incluye la fila 16 (índice desde 0) con el campo `name`, y la cantidad de productos es igual antes y después.
4. Con `XX998` existente y 3 filas `XX`: falla con "agotado" y se crean **0** productos (rollback completo).
5. Categoría inexistente o sucursal inactiva: falla y no se escribe nada (cantidad de productos, `BranchInventory` y `BranchMovement` igual antes y después).
6. 51 filas: se rechaza sin escribir.
7. Movimiento y comprobante por cada fila con stock: ver el caso C1 en "Comprobante del ingreso inicial".
7b. Un nombre que ya existe (otra capitalización, o un producto inactivo): falla con `rowErrors` en esa fila y no se escribe nada (D2 = C).
8. **Concurrencia:** `createProduct` y `createProductsBatch` en paralelo (`Promise.all`) sobre el mismo prefijo: ambos salen bien y no se repite ningún código.

**Código compartido con riesgo de regresión:**
- **Helper de la clave del lock y esquema movido** afectan a `createProduct`. Hay que:
  - correr `src/app/actions/product.test.ts` (los mensajes de `:104-135` no cambian);
  - sumar una prueba en base local de que el alta individual sigue dando el código siguiente y el mensaje "agotado";
  - comparar la salida de `createProduct` (stdout, error y resultado) entre el commit base, en una copia temporal, y el cambio, con las mismas entradas.
- **`ProductForm`**, si D4 = (a) le agrega un enlace: correr `src/app/productos/components/ProductForm.test.tsx` (`:92-405`) y probar que compras (`AddPurchaseButton.tsx:391-397`) no muestra el enlace.
- **`OptionsMenuModal`**, si D4 = (b): `src/components/ui/OptionsMenuModal.test.tsx`.
- **`StockMovementReceipt`, `StockMovementReceiptPanel` y `generateEntryReceiptWithLabels`** se reusan sin cambios. Igual hay que correr sus suites (hermano `src/app/inventario/components/StockMovementReceiptPanel.test.tsx`, `src/lib/utils/stock-movement-pdf.test.ts` y `src/actions/label-print.combined.test.ts`) para confirmar que el comprobante del alta no exige tocarlos.
- **Cierre:** `npm run lint`, `npx tsc --noEmit`, `npm run test:local-db` y `npm run build`.

## Comprobante del ingreso inicial

Invariante del humano: «todo ingreso o egreso a una sucursal debe (1) generar el movimiento de stock y (2) generar un PDF con el detalle del movimiento, como ya pasa en el ingreso de stock». El alta masiva que asigna stock inicial es un ingreso y cumple las dos cosas.

### Qué consume el comprobante actual

- `StockMovementReceipt` (hermano `src/lib/stock-movement-receipt.ts:2-23`) es el **snapshot de una operación confirmada**, no de un producto:
  - **cabecera**: un solo `movementType` (`ENTRY | EXIT | TRANSFER`, `:3`), una sola sucursal (`branchId`, `branchName`, `branchCode`, `:5-8`), `date` (`:6`) y `reference`, que el PDF imprime como "Motivo" (`:11`);
  - **lote de filas** (`rows[]`, `:12-22`), cada una con `productId`, `code`, `name`, `quantity`, `stock` (saldo final) y `price`; `sourceStock` es solo para traslados (`:19-20`).
- Este worktree está en `91adc2f`, ancestro de `bfeae6c`. Acá el tipo todavía no tiene `branchId` ni `rows[].productId` (`src/lib/stock-movement-receipt.ts:2-22`). El hermano los agregó como **requeridos** para pedir etiquetas (hermano `odd/tasks/ingreso-con-etiquetas.md:18`, `:30`).
- El PDF (`src/lib/utils/stock-movement-pdf.ts:33-147`, igual en los dos worktrees):
  - imprime una sola sucursal (`:60`, `:72`);
  - pagina sin límite de filas (`:95-99`);
  - muestra `+N` en verde para ENTRY (`:105-107`), con las columnas Código, Nombre, Cantidad, Stock final y Precio unit. (`:121`);
  - cierra con el total "N productos · M unidades" (`:139`).
- `adjustBranchStockBatch` arma el snapshot **dentro de la transacción**:
  - con el stock final leído en la misma transacción (`src/app/actions/inventory.ts:777-781`; hermano `src/app/actions/inventory.ts:785-806`);
  - lo devuelve en `data.receipt` (`src/app/actions/inventory.ts:787-800`);
  - el modal lo pasa al panel, que genera el PDF en el navegador sin volver a escribir (hermano `StockAdjustmentModal.tsx:211-223`; `StockMovementReceiptPanel.tsx:28-44`; hermano `odd/tasks/catalogo-comprobantes-stock.md`, sección "Diseño").

**Conclusión:** sirve tal cual para un ENTRY de N productos creados, con `movementType: "ENTRY"`, la sucursal del lote y una fila por producto creado con stock. Para cada fila:
- `quantity` es el stock inicial;
- `stock` es el saldo final, que es igual a la cantidad porque el producto es nuevo; igual se toma del `BranchInventory` devuelto por la transacción, no se supone;
- `price`, `code` y `productId` salen del producto recién insertado.

Restricciones:
- Las filas con stock 0 **no** van al comprobante ni generan movimiento: no hubo ingreso. Además, el comprobante con etiquetas exige `quantity >= 1` (hermano `src/actions/label-print.ts:446`), igual que los esquemas de ajuste (`src/lib/validations/branchMovement.ts:86-90`).
- Un comprobante modela **una** sucursal. La sucursal por fila obligaría a emitir varios comprobantes (D8).

### Escritura en la transacción (paso 4.5 del diseño)

1. `rowsConStock = rows.filter((r) => r.initialStock > 0)`, en el orden de las filas.
2. `tx.branchInventory.createManyAndReturn` con `{ branchId, productId, stock: initialStock }` para esas filas. Son productos nuevos, así que no hay conflicto ni hace falta `upsert`.
   - Supuesto a confirmar en D8: las filas con 0 crean también una fila `BranchInventory` con stock 0, sin movimiento, para que el producto se vea en la vista por sucursal (H1).
3. `tx.branchMovement.createMany` ENTRY, una por fila con stock, con:
   - `quantity: initialStock`;
   - `reference` igual al motivo del comprobante (D9);
   - `performedBy` igual a `auth.email`, que es más confiable que el email que manda el cliente (hermano `StockAdjustmentModal.tsx:207`).
4. `receipt: StockMovementReceipt`, con la misma forma que hermano `src/app/actions/inventory.ts:792-806`. Cada fila se cruza por `productId` con el `BranchInventory` devuelto, para tomar `stock`.
5. Sin filas con stock, `receipt = null` y no hay movimientos.

### Qué devuelve `createProductsBatch` y dónde se arma el comprobante

- Devuelve `{ products, receipt }` (ver Contrato). La UI no necesita otra consulta: el snapshot ya trae sucursal, códigos generados, precios, cantidades y saldos.
- **Datos en el servidor, PDF en el cliente**, igual que hoy:
  - el servidor arma el snapshot dentro de la transacción, porque es el único que conoce los códigos generados y el saldo confirmado;
  - el cliente lo pasa a `StockMovementReceiptPanel`, que genera el PDF con import dinámico (`StockMovementReceiptPanel.tsx:32`);
  - un fallo del PDF no repite el alta (`:14`, `:39-41`).
- El comprobante con etiquetas lo arma el servidor a pedido, desde el mismo snapshot (hermano `src/actions/label-print.ts:462-497`), sin volver a escribir stock.

### Etiquetas de lo recién creado

- Con `bfeae6c`, el panel ya ofrece "Comprobante + etiquetas" para **cualquier** ENTRY (hermano `StockMovementReceiptPanel.tsx:46-61`, `:110-115`).
- `generateEntryReceiptWithLabels` vuelve a validar que cada producto esté activo con stock > 0 en la sucursal (hermano `src/actions/label-print.ts:354-355`, `:369`). Los productos recién creados con stock lo cumplen.
- Imprime una etiqueta por unidad (hermano `src/actions/label-print.ts:377`; `odd/tasks/ingreso-con-etiquetas.md:13`).

**Recomendación:** no escribir código de etiquetas en esta feature. Si el alta usa el panel tal cual, las etiquetas salen sin costo.
- Condición: construir la feature **sobre `feat/orden-listas-modales` ya integrada**. `bfeae6c` está 2 commits por delante del `main` del hermano y solo vive en esa rama.
- Si se construye sobre `91adc2f`, este worktree no tiene ni el botón ni `branchId`/`productId` en el tipo. Habría choque al integrar, o habría que duplicar el cambio del tipo.
- Advertencia: un lote de 50 productos con mucho stock genera muchas hojas (72 etiquetas por hoja, una por unidad). Esto ya pasa hoy con un ingreso grande y no es de esta unidad.

### Caso local-db C1: movimiento y datos del comprobante por cada fila con stock

Archivo: `src/app/actions/product.batch.local-db.test.ts`, con el patrón de `src/app/actions/stockControl.local-db.test.ts:1-50`. `requireAdmin` va mockeado con `test@feria.test` (`jest.setup.ts:44-46`).

- **Fixture:** una sucursal activa con sufijo aleatorio (con `authUserId` no nulo, como `stockControl.local-db.test.ts:43-50`) y una categoría.
- **Acción:** `createProductsBatch` con `branchId` y tres filas, todas con el prefijo nuevo `Q<sufijo>`:
  - A con `initialStock: 5`;
  - B con `initialStock: 0`;
  - C con `initialStock: 12`.
- **Se espera:**
  1. `success: true` y 3 productos en el orden A, B, C, con códigos consecutivos.
  2. `BranchInventory`: A tiene 5 y C tiene 12. B no tiene fila, o tiene una con 0, según D8.
  3. `BranchMovement` de la sucursal con esos `productId`: exactamente 2 filas, ambas `ENTRY`, con cantidades 5 y 12, `reference` igual al motivo de D9 y `performedBy` igual a `test@feria.test`.
  4. Cabecera del `receipt`:
     - `movementType: "ENTRY"`;
     - `branchId`, `branchName` y `branchCode` de la fixture;
     - `reference` igual a la de los movimientos;
     - `date` como ISO válido.
  5. `receipt.rows`: 2 filas, A y C, en ese orden. Cada una con:
     - `productId`, `code`, `name` y `price` del producto creado;
     - `quantity` igual al `BranchMovement.quantity` del mismo `productId`;
     - `stock` igual al `BranchInventory.stock` leído de la base.
  6. Cruce: cada fila del comprobante tiene **un solo** movimiento con su `productId` y su cantidad, y ningún movimiento queda sin fila en el comprobante.
  7. `generateStockMovementPdf(receipt)` devuelve bytes y no lanza error (es pdf-lib puro y corre en node).
- **Caso hermano:** el mismo lote con una sucursal inactiva no deja productos, `BranchInventory` ni `BranchMovement` (conteos iguales antes y después).
- **RED esperado:** hoy `createProductsBatch` no existe, así que falla el import. Una vez creado sin el paso 4.5, fallan los puntos 2 a 6.

## Unidades de trabajo propuestas

**Archivos que cambiarían** (una línea cada uno, con líneas propias aproximadas):

- `src/lib/validations/product.ts`: esquema de fila (movido) y de lote, ~35.
- `src/app/actions/product.ts`: `createProductsBatch` y el helper de la clave del lock, que también usa `createProduct`, ~130.
- `src/app/actions/product.test.ts`: autorización, Zod del lote y mock de `createManyAndReturn`, ~40.
- `src/app/actions/product.batch.local-db.test.ts` (nuevo): casos 1 a 8, ~220.
- `src/app/productos/components/BulkProductForm.tsx` (nuevo): el modal, ~280.
- `src/app/productos/components/BulkProductForm.test.tsx` (nuevo): tests de UI, ~200.
- `src/app/inventario/page.tsx` y, según D4, `src/app/productos/components/ProductForm.tsx`: punto de entrada, ~25.
- Guía en `docs/` y enlace en `docs/README.md`: ~40.

- Por D1 (stock inicial, movimiento y comprobante), en U4: el paso 4.5 en `src/app/actions/product.ts` (~60), el caso C1 y el caso de sucursal inactiva en el test local-db (~150), y `BranchPicker`, el campo de stock por fila y el panel en `BulkProductForm.tsx` y su test (~70 + ~50).

Total estimado: unas 1.300 líneas propias, más este documento.

**Unidades:**

| Unidad | Contenido | Líneas aprox. | Riesgo |
|---|---|---|---|
| U1. Lock compartido | Extraer el helper de la clave del lock desde `src/app/actions/product.ts:72`, mover `createProductSchema` y sumar la regresión local de `createProduct` | ~80 | Item 4 (concurrencia, locks compartidos con el alta individual). Va en commit propio y con verificador independiente. |
| U2. Acción del lote, solo productos | `createProductsBatchSchema`, `createProductsBatch` sin stock (devuelve `receipt: null`), nombres existentes (D2 = C), tests unitarios y casos 1 a 6, 7b y 8 en base local | ~370 | Depende de U1. Ningún ítem de alto riesgo propio: es una acción nueva que no cambia datos existentes. |
| U3. Modal y punto de entrada | `BulkProductForm` sin stock, sus tests, el punto de entrada (D4) y la guía en `docs/` | ~480 | Supera las ~400 líneas de forma natural; no conviene separar la UI de sus tests. |
| U4. Stock inicial, movimiento y comprobante | Paso 4.5 de la transacción, `receipt` en la respuesta, `BranchPicker` global, stock por fila, panel de comprobante y caso C1 | ~330 | Escribe stock real: según `AGENTS.md` §0.4 lleva aviso explícito y conviene verificador independiente. Reusa `StockMovementReceipt` sin cambiarlo, así que no rompe ningún contrato. Depende de U2, de U3 y de tener `feat/orden-listas-modales` (`bfeae6c`) integrada en la base. |

U2 no se parte: U4 queda como unidad nueva, para que el alta de productos se pueda revisar y entregar sin stock. El orden de entrega es U1, U2, U3 y U4.

Si se decide corregir H2 (la categoría que se descarta en el alta individual), va como unidad aparte, siguiendo la regla de un bug por vez (`AGENTS.md` §3.1).

## Decisiones abiertas

**D1. ¿La carga masiva asigna stock inicial? — DECIDIDA por el humano: sí, con movimiento y comprobante.**
- Invariante: «todo ingreso o egreso a una sucursal debe (1) generar el movimiento de stock y (2) generar un PDF con el detalle del movimiento, como ya pasa en el ingreso de stock».
- Consecuencia:
  - cada fila con stock inicial mayor a 0 deja `BranchInventory` y un `BranchMovement` ENTRY;
  - el lote devuelve un `StockMovementReceipt` ENTRY descargable desde `StockMovementReceiptPanel`.
- Diseño en "Comprobante del ingreso inicial". Lo que queda abierto pasa a D8 (sucursal) y D9 (comprobante).

**D2. ¿Qué pasa con los nombres repetidos? — DECIDIDA: C, rechazar los que ya existen.**
- Se rechaza un nombre repetido dentro del lote y también un nombre que ya existe **activo** en la base, sin distinguir mayúsculas. Un producto inactivo no bloquea (decisión del humano, S3). Se informa con `rowErrors` en la fila.
- Costo aceptado: una consulta más antes de la transacción, y una regla distinta de la del alta individual, que hoy permite repetidos (`src/app/actions/product.ts:16-21`).

**D3. ¿La categoría es compartida o va por fila? — DECIDIDA: (a), solo compartida para todo el lote (S4).**
- Pregunta asociada, también decidida: H2 se corrige en esta entrega como unidad aparte (S8, T6).

**D4. ¿Por dónde se entra al alta masiva? — DECIDIDA: (b), paso previo con dos opciones (S5).**
- (a) Enlace "Cargar varios" en el encabezado de `ProductForm`, solo en el alta y solo cuando la página pasa la prop (inventario sí, compras no). No suma toques al alta de uno, pero toca `ProductForm` y sus tests.
- (b) Paso previo "Un producto / Varios productos" con `OptionsMenuModal` (`STYLE.md:599`). Es consistente con el patrón de pasos, pero suma un toque al caso frecuente.
- (c) Una `ActionCard` o botón separado en `/inventario`. Es descubrible, pero suma una acción a la banda.
- **Recomendación: (a).**

**D5. ¿Qué campos lleva cada fila? — DECIDIDA: (a) más el stock inicial.**
- (a) Nombre, prefijo y precio. Es lo mínimo y rápido de tipear; la descripción queda en "-" y se edita después.
- (b) Lo anterior más una descripción plegable. Es completo, pero agranda cada fila y el código del modal.
- **Decidido: (a), con el stock inicial como cuarto campo** por D1. La descripción no va por fila: el alta usa "-", como el alta individual, y se edita después. Si el usuario quiere la descripción en el lote, se agrega en T4 antes de implementarlo.

**D6. ¿Cuál es el máximo de filas por envío? — DECIDIDA: 50 (S6).**
- 30: margen holgado de tiempo y de lista visible, pero puede quedar corto si cargan "decenas".
- 50: cubre "decenas" con un payload muy por debajo del límite.
- 100: menos envíos, pero una lista larga es incómoda en el celular y una sola fila mala bloquea más trabajo.
- **Recomendación: 50.**

**D7. ¿Qué pasa si una fila falla? — DECIDIDA: (a), todo o nada.**
- No se guarda ninguna fila (ni productos, ni stock, ni movimientos) y se marcan las filas con error. Sin falla parcial, no hay comprobante a medias.

**D8. ¿La sucursal del stock inicial es global para todo el lote o va por fila? — DECIDIDA: (a), global para todo el lote.**
- (a) **Global**: un `BranchPicker` arriba, en "Para todas".
  - Una sola cabecera de comprobante, que es lo que modela `StockMovementReceipt` (hermano `src/lib/stock-movement-receipt.ts:5-8`).
  - Un solo PDF, que es lo que dibuja `generateStockMovementPdf` (`src/lib/utils/stock-movement-pdf.ts:60`, `:72`).
  - Un solo pedido de etiquetas (hermano `src/actions/label-print.ts:474-477`).
  - Costo: unas 25 líneas de UI y ninguna lógica de agrupado. En el celular es un control para todo el lote.
  - Contra: para repartir entre sucursales hay que hacer un lote por sucursal.
- (b) **Por fila**: un `<select>` de sucursal en cada fila, como la excepción de compras (`STYLE.md:603`).
  - Hay que agrupar las filas por sucursal y emitir K comprobantes, K grupos de movimientos y K PDFs de etiquetas, porque el panel recibe un solo comprobante (`StockMovementReceiptPanel.tsx:6-8`).
  - Costo: unas 120 líneas más (agrupado, una lista de comprobantes en el panel o un panel nuevo, y tests por sucursal).
  - En el celular son 50 selects más y un paso extra para descargar K PDFs.
- (c) **Global con excepción por fila.** Es lo más flexible, pero tiene el mismo costo que (b) más la UI del valor por defecto.
- **Recomendación: (a), global.**
  - Cumple el invariante con un solo comprobante y reusa todo sin cambios.
  - Cargar decenas de productos "en un local" es el caso que motivó el pedido, y otra sucursal se resuelve con un segundo lote o con un traslado.
- **Decidido por el humano:** las filas con stock 0 crean una fila `BranchInventory` en 0 en esa sucursal, para que el producto se vea en la vista por sucursal (H1, `src/app/actions/inventory.ts:247-254`). No generan movimiento ni van al comprobante, porque no hubo ingreso.

**D9. ¿Qué comprobante emite el alta con stock? — DECIDIDA: (a), el comprobante de ingreso actual; las etiquetas salen gratis y T7 pasa a ser verificación.**
- (a) **El comprobante de ingreso actual, sin cambios**: `StockMovementReceipt` ENTRY más `StockMovementReceiptPanel`.
  - Con `bfeae6c` trae gratis "Comprobante + etiquetas" (hermano `StockMovementReceiptPanel.tsx:110-115`).
  - Costo: 0 líneas de PDF.
  - Contra: exige integrar antes `feat/orden-listas-modales`, y el PDF dice "Ingreso", no "Alta".
- (b) **El mismo comprobante, sin la opción de etiquetas en el alta.**
  - Costo: una prop nueva en el panel compartido (~10 líneas y un test), que se toca por un pedido que nadie hizo.
  - A favor: no depende de `bfeae6c` para el botón, aunque igual necesita el tipo con `branchId`/`productId` para no divergir.
- (c) **Un comprobante nuevo de "Alta de productos"**, con columnas extra (categoría, prefijo).
  - Costo: unas 150 líneas de PDF y sus tests, más un segundo formato que mantener.
  - Es el que más se distingue de un ingreso común.
- **Recomendación: (a).** Es el mismo documento que el humano ya acepta "como ya pasa en el ingreso de stock" y suma las etiquetas de lo recién creado sin código nuevo.
- Motivo (`reference`): recomiendo uno fijo, «ALTA DE PRODUCTOS», con el estilo de «ENTRADA»/«SALIDA» (`src/app/actions/inventory.ts:759-763`). Queda igual en el movimiento y en el PDF, y distingue el alta de un ingreso común sin un formato nuevo. Una nota libre no se pidió.

## Log

- **L1.** Pedido original (transcripto de la sesión): «agreguemos una funcionalidad de "bulk insert" osea que en una misma transacción y dentro de un mismo modal,puedamos crear varios productos, porque aveces el clnte debe crear muchos productos y el proceso acrual de crear uno por uno lleva mucho tiempo».
- **L2.** Redefinición de D1 por el humano: «yo cada vez que hago un ingreso/egreso a una sucursal deberia: 1. Generarse el movimieno de stock. 2. Generar un PDF con el detalle del movimeinto (como ya tenemos para la parte de ingreso stock)». Deja abierta la sucursal global o por fila.
- **L3.** Decisiones del humano: D2 = rechazar los que ya existen, D2b = solo los activos bloquean, D3 = categoría solo compartida, D4 = paso previo con dos opciones, D6 = 50 filas, D7 = todo o nada, H2 = corregirlo en esta entrega.
- **L4.** Verificación independiente del documento (dos pasadas, solo lectura): H1, H2, H3 y H4 confirmados con `path:line`. Citaciones corregidas: orden de `/inventario`, líneas de `moveStockBatchBetweenBranches` y `adjustBranchStockBatch`, cantidad de casos de `ProductForm.test.tsx`, y el patrón pre-transacción que estaba dentro del `$transaction`. Del comprobante: `StockMovementReceipt` modela una sola sucursal (D8 global respaldado), `reference` es el único lugar para el motivo (D9), y `label-print` ya exporta `generateEntryReceiptWithLabels` con `bfeae6c`.
- **L5.** `createManyAndReturn` existe en el client instalado (`@prisma/client` 6.19.3, `node_modules/.prisma/client/index.d.ts:2995`) y tipa dentro de `$transaction`. Pero el JSDoc no promete orden de retorno: el resultado se cruza por `code`, nunca por posición. Hoy no tiene uso en `src/`, así que este sería el primero.
- **L6.** Base: rama `feat/productos-alta-masiva` desde `bfeae6c`, en el worktree hermano con `node_modules` instalado. El worktree local (`91adc2f`) no tiene dependencias y no puede correr tests.
- **L7.** Decisiones nuevas del humano: D8 = sucursal global. D9 = el comprobante de ingreso actual, y las etiquetas anotadas como unidad siguiente (T7). Preguntó qué significa el supuesto de las filas con stock 0: queda pendiente de explicación y respuesta.
- **L8.** T1 implementado inline (el escritor delegado rechazó la unidad). Evidencia observada en el worktree hermano: `npx tsc --noEmit` sin errores; `npm test -- src/app/actions/product.test.ts` 16/16; `npm run test:local-db -- src/app/actions/product.local-db.test.ts` 2/2; `npm run lint` 0 errores y 36 avisos preexistentes. El contenedor de la base local estaba caído (`Exited (137)`): `supabase db start` informó «already running» sin ser cierto y hubo que arrancarlo con `docker start supabase_db_seguimientos-compras`. Pendiente: verificación independiente y commit de la unidad.
- **L9.** T1 verificado de forma independiente y commiteado en `704d765`. Dos correcciones del verificador: el archivo de test nuevo había roto `npx tsc --noEmit` con 6 errores (sin `import`/`export` de nivel superior, TypeScript lo trataba como script global y sus `sufijo`/`Cliente`/`prisma` chocaban con los de `purchase.scale.test.ts`), resuelto con `export {};` al final, igual que `stockControl.local-db.test.ts:208`; y el test no fijaba el conteo previo, que ahora arranca en 1.
- **L10.** `npx tsc --noEmit` sigue en rojo por una causa **previa a esta rama**: `src/app/actions/purchase.scale.test.ts:20`, `:26` y `:43` chocan con otro archivo de test sin módulo. Se comprobó sacando el archivo nuevo del árbol: los tres errores siguen ahí. O sea que la puerta de cierre de `AGENTS.md` §3.4 ya fallaba antes de esta feature y necesita una decisión aparte (un `export {};` en el archivo culpable, o revisar cuál es el otro script global).
- **L11.** Observación del entorno: `DATABASE_URL` del shell apunta a un pooler remoto de Supabase (`aws-1-us-west-2.pooler.supabase.com`). El guard de `src/lib/prisma.ts` corta antes de escribir, y por eso `AddPurchaseButton.test.tsx` falla de forma preexistente: mockea la acción con una ruta relativa equivocada (`../../actions/product`) y cae en el Prisma real.
- **L12.** Decisión del humano: las filas con stock 0 dejan `BranchInventory` en 0, sin movimiento ni fila en el comprobante. Con esto D8 queda cerrada y T5 solo espera D5 (campos por fila).
- **L13.** T2 implementado por el escritor delegado, con TDD observado: RED (6 fallos unitarios y 9 de base local por «createProductsBatch is not a function») y después GREEN de 22/22 unitarios y 9/9 de base local; `npm run lint` sin errores nuevos y `npx tsc --noEmit` sin errores nuevos (solo los tres previos de L10). El mock de `createManyAndReturn` devuelve las filas al revés a propósito para probar que la respuesta se cruza por `code`. T3 quedó absorbida: los tests se escribieron junto con la acción.
- **L14.** D5 decidida por el coordinador y sujeta a veto del humano: nombre, prefijo, precio y stock inicial por fila; sin descripción por fila (queda en "-" y se edita después).
- **L15.** Verificación independiente de `171fb66`: contratos compartidos intactos, un lock por prefijo distinto y ordenado, conteo realimentado, respuesta por `code`, precedencia de errores correcta, `tsc` sin errores nuevos. Pero **dos pruebas no prueban lo que dicen**: (a) la atomicidad es vacua, porque todos los casos de falla abortan antes del `INSERT` y los conteos no distinguen rollback de no haber escrito; (b) el caso de concurrencia puede pasar sin el lock, porque `Product.code` es único y ambas rutas reintentan ante P2002. Además `revalidatePath` no se verifica en ningún test, la rama `P2003` no se ejecuta (`:275-281`) y el `catch` de `ZodError` externo (`:253-259`) es inalcanzable. Corrección: T2b.
- **L16.** Límite heredado que conviene tener presente: el nombre se inserta sin `trim` y la comparación con existentes no recorta los nombres guardados, así que un nombre con espacios al borde esquiva el control de duplicados. Es el mismo comportamiento del alta individual, no una regresión.
- **L17.** T2b commiteado en `589c3ff` con 25/25 unitarios y 10/10 de base local. Lo que prueba y lo que no, sin adornos: el caso nuevo fuerza un fallo **después** de empezar el insert (código legacy con `codePrefix: null`, que el `findMany` no ve), y las filas hermanas no quedan. Pero el `INSERT` del lote es **una sola sentencia**, y PostgreSQL revierte una sentencia entera por sí solo: quitar el `$transaction` daría el mismo resultado observable. Así que ese test no prueba el límite de transacción; prueba que el lote no degrada a escrituras por fila (el riesgo H6) y fija el contrato de reintentos ante P2002. La atomicidad multi-sentencia recién se vuelve comprobable en T5, cuando hay escrituras de stock después del insert.
- **L18.** Límites aceptados de la verificación de T2: la rama `P2003` se cubre con un mock, no con la carrera real de categoría borrada; y la prueba de la clave del lock se apoya en el SQL emitido por ambas acciones, no en el valor de la función por separado. Nada de eso se puede forzar sin instrumentar el código de producción, que no se justifica.
- **L19.** T4 implementado: `BulkProductForm` con 10 tests de UI, el paso previo en `/inventario` y dos columnas desde `md` (solo CSS). El paso previo rompió dos casos de `src/app/inventario/components/InventarioPage.test.tsx` que afirmaban que el FAB abría el alta de a uno: se actualizaron para recorrer el menú, **conservando las aserciones** (`findByText("Nuevo Producto")`, el `getByLabelText(/nombre/i)`, el `toHaveBeenLastCalledWith` de los filtros y el cierre del modal), más un caso nuevo de "Varios productos". Resultado: 18/18 en ese archivo, 21/21 entre el modal y `ProductForm`. Compras no recibe el paso previo porque `ProductForm` no se tocó.
- **L20.** `npx tsc --noEmit` queda **limpio** en toda la rama (`a766c82`): el fallo previo era `purchase.scale.test.ts` tratado como script global, resuelto con `export {};` como en `stockControl.local-db.test.ts`. La puerta de cierre de `AGENTS.md` §3.4 vuelve a servir. Sin verificar en navegador: el apilado en celular con `display: contents`, la columna pegajosa desde `md` y el pie en la columna derecha.
- **L21.** Verificación independiente de T4 (`2ea6a63`): 10 de 10 ítems confirmados, incluido que la única vía de escritura es `createProductsBatch` (con `requireAdmin` y Zod en el servidor), que `ProductForm`, `AddProductButton` y todo compras quedaron fuera del cambio, y que el test de página no perdió ninguna aserción (la única línea eliminada fue un comentario). Hueco encontrado y corregido: durante el envío solo se deshabilitaba el botón de enviar, así que borrar una fila en vuelo perdía en silencio el error del servidor para esa fila. Ahora se deshabilitan agregar y quitar mientras `loading`, con un test que sostiene una promesa pendiente a propósito.
- **L22.** Pedido del humano, textual: «Bien, correciones, las categorias las pognamos por cada producto una distinta, sumado a eso, actualmente el boton se ve mal, el de nueva categoria se ve salido de pantalla en pc chicas. Creo los productos pero no me sale nada de la sucurasal, eso lo vemos luego?». Tres cosas: cambio de requisito en la categoría (S4 reescrita), un bug de layout (S10) y la confirmación en vivo de H1 (S11), que es exactamente lo que resuelve T5.
- **L23.** T8 commiteado en `3f26f81`: la categoría va por fila; la acción valida los ids distintos en **una** consulta y falla el lote entero marcando solo las filas afectadas. RED observado en las tres suites antes de implementar; después 28/28 unitarios, 12/12 base local y 13/13 de UI, con `tsc` limpio. **Trade-off que hay que decidir:** el modal perdió el atajo «+ Nueva categoría», porque `CategorySelector` carga y crea por su cuenta y una instancia por fila serían 50 requests y 50 botones de alta. Ahora es un select por fila con una sola carga. Si el humano quiere crear categorías desde el lote, es una unidad aparte (picker compartido con la lista inyectada).
- **L24.** T9 commiteado en `7f990a8`: el disparador del selector era `flex-1` sin `min-w-0` y no podía encogerse, así que empujaba la píldora afuera en la columna angosta. Verificado: ningún consumidor se rompe, la fila más angosta real mide 316 px y la píldora ~161 px; por debajo de ~230 px desbordaría igual. Se sumó el primer test del componente (3 casos). Ojo: el control no guarda estado propio, muestra la selección solo cuando el padre actualiza `selectedId`.
- **L25.** Verificación independiente de T8 (`3f26f81`): 8 de 8 confirmados; una categoría inexistente en una fila falla el lote antes de escribir y el conteo cubre todo el lote, y las dos categorías se leen de vuelta con su propio id. Hueco corregido: si fallaba la carga de categorías el select quedaba en «Sin categoría» sin avisar, así que se podían guardar 20 productos sin categoría creyendo que no existían. Ahora el modal avisa que no se pudieron cargar y que se guardarán sin categoría, con test (14/14 en la suite del modal). Quedan sin cubrir: el descarte silencioso de un `categoryId` a nivel de lote (aceptado: un solo consumidor interno) y el aviso de H1, que es T5.
- **L26.** Verificación de premisas de T5 (antes de que existiera el código): todas confirmadas. `BranchInventory` tiene única `(branchId, productId)`, `stock: 0` es legal y la lista filtrada por sucursal incluye stock 0 (`inventory.ts:250-256`), así que la fila en 0 es lo que arregla H1. `BranchMovement` no tiene índice único que rechace dos movimientos del lote, y `performedBy` acepta vacío: el fallback es calidad de auditoría, no un bloqueo. El patrón de `adjustBranchStockBatch` coincide con el plan (inventario → movimientos → lectura única, con `stock` posterior). Correcciones pasadas al worker: validar la sucursal antes de la transacción con `code`, cruzar por `productId` y nunca por índice, y **excluir del comprobante las filas con stock 0**, porque `label-print.ts:455` exige cantidad mínima 1 y un 0 haría fallar el botón de etiquetas en runtime sin que ninguna suite lo note.
- **L27.** T7 cambia de naturaleza: el panel del comprobante ya trae «Comprobante + etiquetas» para todo ENTRY (`StockMovementReceiptPanel.tsx:110-112`), así que las etiquetas llegan sin escribir código. Esconder el botón sería código para ocultar algo pedido. T7 queda como verificación de que el PDF combinado sale bien con un lote real, no como unidad de desarrollo. Verificado además que el ENTRY con `reference: "ALTA DE PRODUCTOS"` aparece en el historial del producto y en la lista pública de movimientos como «Entrada», sin exponer el motivo (`inventory.external.ts:102-107`), y que ningún reporte filtra por ese prefijo.
