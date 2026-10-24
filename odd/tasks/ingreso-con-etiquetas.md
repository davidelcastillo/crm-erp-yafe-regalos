# Comprobante de ingreso con etiquetas

Cuando se registra un ingreso de stock, al final hay tres salidas: el comprobante,
el comprobante **más** las etiquetas de lo ingresado, y cerrar. La última hoja de
etiquetas se completa con etiquetas vacías para escribir a mano.

## Specs

- **S1** «cuando registramos un ingreso de stock, en movimeintos, que se llame a la función que impreme los precios y que la opción de imprimir las etiquetas de esos productos que se ingresarom»
- **S2** «que al finalizar la carga, salgan 3 botones, uno que imprima el comprobante en pdf, otro que imprima el pdf de comprobante mas la etiquets de los productos que se ingresaron con sus cantidades, y otro que sea de cerrar»
- **S3** Alcance confirmado por el usuario: **solo el comprobante de un ingreso** (`movementType === "ENTRY"`). Egresos y traslados conservan sus botones actuales.
- **S4** «para optimizar la hoja, cuando por ejemplo solo haya que imprimir 5 etiquetas, para que no quede toda la hoja en blanco, que imprima las etiquetas pero sin precio y sin codigo, asi lo anotamos aqui de ultima y reutilizamos ese espacio». Confirmado: las de relleno van **totalmente vacías** y se **completa la hoja siempre** (72 etiquetas por hoja).
- **S5** Cantidad confirmada por el usuario: «si ingreso 20 productos 6, se deberian ahcer 20 etiquetas del producto 6» → una etiqueta por **unidad ingresada**, con el código y el precio reales del producto.
- **S6** Ninguna de las tres salidas vuelve a registrar el movimiento: solo generan PDF, como el comprobante de hoy.

## Tasks

- [x] **T1** [S1, S2, S5] — `StockMovementReceipt` lleva `branchId` y `rows[].productId` (requeridos, no opcionales): el traslado (`src/app/actions/inventory.ts:654`) y el ajuste (`:792`) los completan y el receipt se tipa como la interfaz. Fixture de `MoveStockModal.test.tsx:98` actualizada. Commit `1dc6433`.
- [x] **T2** [S4, S5] — `generateProductLabels` acepta `fillLastSheet`: `renderLabelsPdf` calcula los slots hasta completar la hoja (72) y `drawLabel` con contenido `null` dibuja solo el fondo rosa. Sin el flag el PDF sale igual que antes. Commit `1dc6433`.
- [x] **T3** [S1, S2, S5] — `generateEntryReceiptWithLabels(receipt)` en `src/actions/label-print.ts:431`: Zod (rechaza `movementType !== "ENTRY"`), `requireAdmin`, re-validación de productos con stock en la sucursal y **un solo PDF** = comprobante + hojas de etiquetas con la última rellenada. `copyPages` conserva los textos (lo fija el test). Commit `1dc6433`.
- [x] **T4** [S2, S3] — `StockMovementReceiptPanel`: `savePdf` es el único camino de Blob; un ingreso muestra «Descargar comprobante», «Comprobante + etiquetas» y «Cerrar comprobante». Egreso y traslado, igual que antes. Commit `1dc6433`.
- [x] **T5** [S1–S6] — Tests: `label-print.combined.test.ts` (8 casos, incluido que el PDF combinado conserva texto del comprobante **y** código/precio de las etiquetas con el lector de PDFs), `label-print.test.ts` +3 (relleno, regresión sin flag, segunda hoja), panel +4 y expectativas de receipt actualizadas. Checks: `npm run test:local-db` **111/111 suites y 850/850 tests**, `npx tsc --noEmit` 0, `npm run lint` 0 errores, `npm run build` OK. Commit `1dc6433`.

## Log

- **L1** — Pedido original (ver S1, S2, S4).
- **L2** — Estado leído antes de escribir: el comprobante (`StockMovementReceiptPanel`) hoy tiene un botón de descarga por lado y «Cerrar»; `generateProductLabels({ branchId, selections: [{ productId, quantity }] })` arma hojas A4 horizontales de 9×8 = 72 etiquetas y **re-valida en el servidor** que el producto esté activo con stock > 0 en la sucursal; `StockMovementReceipt.rows` **no** tiene `productId` ni el comprobante `branchId`, así que hoy no alcanza para pedir etiquetas. No hay ningún `copyPages` en el repo: el PDF combinado es lo único nuevo de infraestructura.
- **L3** — Decisiones del usuario: solo ingreso; relleno totalmente vacío; completar la hoja siempre; cantidad = unidades ingresadas.
- **L4** — Relleno y combinación se resuelven en el servidor: el comprobante y las etiquetas ya se generan con pdf-lib embebiendo Poppins/Shrikhand, así que el PDF combinado se arma copiando páginas y **el test de T5 es el que decide** si los textos sobreviven; si no sobreviven, el relleno se descarta y se dibuja todo en un único documento desde el principio.
- **L5** — Implementación delegada al worker (`Allowed edit surfaces` con los 11 archivos). El copiado de páginas **sí** conserva los textos: el lector encuentra `Ingreso`, la sucursal, el motivo, el handle en Shrikhand y los `$`; código y precio van con Helvetica y el test los lee como WinAnsi (igual que `label-print.test.ts`), así que no hizo falta unificar el dibujo. El worker dejó `branchId`/`productId` opcionales por una fixture fuera de sus superficies; el orquestador los pasó a **requeridos** y actualizó `MoveStockModal.test.tsx` para que `tsc` impida borrarlos mañana.
- **L6** — Sin verificación en navegador: la prueba visual del PDF (que el comprobante y las etiquetas salgan en el orden y la escala correctos al imprimir) queda para el usuario.
