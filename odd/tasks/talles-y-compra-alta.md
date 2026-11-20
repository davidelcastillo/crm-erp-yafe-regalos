# Talles por cantidad y compra desde el alta

Objetivo: (1) una prenda no única puede cargarse con varios talles y una cantidad
por talle; (2) el costo cargado en un alta (prenda o producto) genera una
**transacción de compra** visible en `/compras`, sin tocar el flujo existente de
compras. Rama: `feat/prendas-pedidos` (continúa la línea de prendas).

Fuera de alcance (decisiones tomadas): el corte de caja no cambia (las compras no
descuentan caja; el corte solo suma ventas + ingresos/egresos de caja manuales);
`registerPurchase` y el botón de /compras quedan intactos; reportes de
costo/ganancia siguen fuera (los ya declarados en `prendas-pedidos.md`).

## Specs

- **S1.** «En talles, agreguemos que cuando son mas de una cantidad, pueda haber
  varios talles y diferentes cantidades de cada talle.» **Decidido (elección del
  dueño)**: filas «Talle + Cantidad» que se agregan y quitan; la cantidad total se
  calcula sola como la suma de las filas. La prenda única mantiene UN solo talle
  (cantidad 1, como hoy). La cantidad total sigue gobernando el ingreso de stock.
- **S2.** «cuando yo pongo el costo de una prenda, eso se contempla como un gasto?
  es decir, sale luego en la parte de gastos? Deberia ser asi, es mas, si es
  posible generemos una transaccion de compra con el precio ese, las cantidades
  que fueses y que esa transaccion se muestre tambien en la pantalla de compras»
  **Decidido (elección del dueño)**: la compra se genera **solo si el costo es >
  0**; se registra en la MISMA transacción del alta como `Purchase` +
  `PurchaseItem` (precio = costo unitario, cantidad = cantidad total, subtotal y
  totalAmount calculados) con la sucursal elegida en el alta, y aparece en
  `/compras` como cualquier compra. **El stock no se toca** en esa compra: el alta
  ya ingresa su stock con su movimiento `ENTRY`; reusar `registerPurchase`
  contaría el stock dos veces, así que la compra del alta es solo registro.
- **S3.** «estaria bueno que esto tambien este para los productos normales, que
  pueda poner el costo que me salio desde la creación y que tambien se registre
  como compra» **Decidido (elección del dueño: individual + masiva)**:
  - Alta individual de producto: gana «Sucursal», «Cantidad inicial» y «Costo».
    Con cantidad ≥ 1 se crea la fila de inventario y su movimiento `ENTRY`; con
    costo > 0 además la compra (S2). Sin cantidad ni costo, el alta queda como
    hoy.
  - Alta masiva: gana «Costo» por fila (ya tiene sucursal global y cantidad por
    fila); las filas con costo > 0 y stock > 0 generan **una sola compra del
    lote**.
- **S4.** «no remplaza la parte de compras, solo lo vuelve más agil»: ni
  `registerPurchase`, ni `AddPurchaseButton`, ni la vista de `/compras` cambian;
  solo reciben compras nuevas por el camino del alta.

## Diseño

- **Talles**: tabla hija `PrendaTalle { productId, talle, cantidad }` como única
  fuente de verdad del talle; `PrendaDetalle.talle` se quita (una fuente, no
  dos). Prenda única = una fila (talle, 1). La edición reemplaza las filas
  enteras, igual que estilos y medidas. `db push` local (datos de prueba pueden
  perder el string de talle: base desechable). Producción todavía no tiene
  prendas, así que el cambio no necesita migración de datos real; el SQL final se
  define al publicar la rama.
- **Compra del alta**: helper compartido (usado por prenda, producto individual y
  lote) que crea `Purchase` + `PurchaseItem` dentro de la transacción del alta,
  sin tocar stock. Nunca llama a `registerPurchase`.
- La cantidad de la compra es la cantidad total del alta (en prendas, la suma de
  las filas de talle).

## Tasks

| ID | Tarea | Specs | Ruta principal | Estado | Commit |
|---|---|---|---|---|---|
| T1 | Esquema `PrendaTalle` (y `talle` fuera de `PrendaDetalle`) + helper `compraDelAlta` + `createPrenda`/`updatePrenda`/`getPrenda` con talles[] y compra. Zona de plata (compras): verificación independiente | S1, S2 | `prisma/schema.prisma`, `src/app/actions/prenda.ts`, `src/lib/validations/prenda.ts` | hecho | `9fe1133` |
| T2 | `PrendaForm`: filas «Talle + Cantidad» (única = un talle como hoy), cantidad total derivada, textos y accesibilidad según `STYLE.md` | S1 | `src/app/inventario/components/PrendaForm.tsx` | hecho | `9fe1133` |
| T3 | Producto individual: `ProductForm` gana sucursal, cantidad inicial y costo; `createProduct` crea inventario + ENTRY y compra con el helper. Zona de plata: verificación independiente | S3, S4 | `src/app/actions/product.ts`, `src/app/productos/components/ProductForm.tsx` | hecho | `2704c3b` |
| T4 | Alta masiva: costo por fila → una compra del lote con el helper (solo filas con costo>0 y stock>0) | S3, S4 | `src/app/actions/product.ts`, `src/app/productos/components/BulkProductForm.tsx` | hecho | `2704c3b` |
| T5 | Suite completa, lint, tsc, prueba visual del dueño, docs y cierre | S1–S4 | — | pendiente | — |

## Log

- **L1 — Pedido original, verbatim**: «En talles, agreguemos que cuando son mas de
  una cantidad, pueda haber varios talles y diferentes cantidades de cada talle.
  Temas de dinero, cuando yo pongo el costo de una prenda, eso se contempla como
  un gasto? es decir, sale luego en la parte de gastos? Deberia ser asi, es mas,
  si es posible generemos una transaccion de compra con el precio ese, las
  cantidades que fueses y que esa transaccion se muestre tambien en la pantalla
  de compras, estaria bueno que esto tambien este para los productos normales,
  que pueda poner el costo que me saliodesde la creación y que tambien se
  registre como compra, no remplaza la parte de compras, solo lo vuelve más
  agil».
- **L2 — Decisiones del dueño (2026-11-20)**: compra solo con costo > 0;
  productos normales en alta individual Y masiva; talles como filas «Talle +
  Cantidad». Aclaración entregada antes de decidir: hoy el costo NO es un gasto
  (queda en la ficha); los gastos de mercadería son las compras de `/compras`;
  `registerPurchase` suma stock, así que la compra del alta no puede reusarlo
  (contaría doble); el corte de caja no descuenta compras y no se toca.
- **L3 — Exploración inicial**: consumidores de `talle` = `prenda.ts`,
  `PrendaForm.tsx`, `validations/prenda.ts` (ni PDF ni pedidos lo usan).
  `ProductForm` no tiene selector de sucursal ni cantidad; el alta masiva ya
  tiene sucursal global y `initialStock` por fila (crea fila de inventario
  siempre, ENTRY solo con stock > 0). `Purchase` = cabecera con `branchId` y
  `totalAmount`; `PurchaseItem` = `price`, `quantity`, `subtotal`.
- **L4 — T1+T2 commiteadas juntas** (`9fe1133`, «feat(prendas): talles por cantidad y compra del alta con costo»): `PrendaTalle` (PK compuesta `productId+talle`, cuelga de `PrendaDetalle` como estilos/medidas) y `talle` sale de `PrendaDetalle` (una sola fuente de verdad; el `db push` local pierde el dato de prueba del string, base desechable). La cantidad total pasa a ser **derivada del servidor** (suma de filas, nunca la manda el cliente; `createPrendaSchema` sin `cantidad`). Zod suma los talles repetidos en una fila. La compra del alta vive en `src/lib/compra-alta.ts` (`registrarCompraDelAlta`, solo `Purchase`+`PurchaseItem`, jamás stock) y `createPrenda` la llama con costo > 0 dentro de la misma transacción. `updatePrenda` reemplaza las filas de talle enteras y `getPrenda` las devuelve. RED: 17 fallos del contrato nuevo observados antes de implementar → GREEN 22/22 (prenda.test), 9/9 (PrendaForm, con test nuevo de filas: agregar/quitar/total derivado), 3 suites de integración en base local (prenda/pedido/reserva) con la compra verificada end-to-end (`totalAmount`/`price`/`subtotal`), tsc 0, lint 0. Ajuste de limpieza en las tres suites local-db: las compras del alta retienen la sucursal por el FK (`Branch` sin cascade hacia `Purchase`), así que se borran antes en before/afterAll. Prueba visual del dueño pendiente junto con T3/T4.
- **L5 — T3+T4 delegadas** a `gentle-ai-worker` (mwp4o9m8-1-u100) con superficies acotadas a `product.ts`, `validations/product.ts`, `ProductForm` y `BulkProductForm` (+ tests); sin cambios de esquema, sin tocar `registerPurchase` ni `/compras` (S4). Zona de plata: verificación independiente al volver.
- **L6 — T3+T4 commiteadas** (`2704c3b`, «feat(productos): compra y stock opcional desde el alta individual y masiva»). Doble firma: worker + verificación independiente (`gentle-ai-verify` mwp58gp9-2-famo, veredicto **PASS** en S2–S4 y en doble conteo/atomicidad/guardián, sin bloqueantes). Lo que se fijó: el único camino de compra es `registrarCompraDelAlta` (nunca `registerPurchase`, grep en el diff); las cuatro escrituras del alta individual y las del lote comparten UNA transacción; `requireAdmin` primero; sin los campos nuevos, ambos flujos quedan idénticos a hoy (early return sin `branchId`); UNA cabecera por lote con `totalAmount` exacto; filas con costo>0 y stock>0 únicamente. RED del worker: 10 fallos/8 pases + 5 fallos de formularios → GREEN 18/18 (suite nueva del contrato), 45/45 formularios, 133/133 consumidores, tsc 0, lint 0. Integración end-to-end agregada por el coordinador contra Postgres local (la que el worker no podía correr): individual con costo 4.5×3 → stock 3, ENTRY y compra totalAmount 13.5; lote con 4 filas → UNA compra 24.5 con 2 items (la de stock 0 y la de costo 0 fuera). Limpieza del FK `Purchase→Branch` agregada en las dos suites local-db. Suite completa **1147/1147**, tsc 0, lint 0.
- **L7 — Deudas declaradas por el verificador (no bloqueantes)**: (1) no hay test que fuerce un fallo tardío de la compra para observar el rollback (la atomicidad es estructural); (2) `totalAmount` suma floats y recién redondea al persistir en `Decimal(10,2)` (heredado de T1; riesgo de 1 centavo con costos de 3 decimales); (3) diferencia deliberada confirmada contra el lote: el alta individual con cantidad 0 no crea fila de inventario (S3 lo pide así, mientras el lote la crea con stock 0 por S11 de la línea de alta masiva).
