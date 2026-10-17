# PDF de inventario personalizado

Unidad de trabajo sobre el PDF que exporta el asistente de `/inventario`. Hoy es
solo una tabla plana (Código | Nombre | Stock | Precio); el cliente quiere ver su
marca en el papel.

Rama: `fix/bugs-usuarios`. Nada de esto se publica sin OK del usuario.

## Specs

- **S1** — Pedido textual del usuario: «pero me gustaria que personalicemos el pdf
  que se exporta, que le agregemos el logo del local, el nombre de la sucursal y
  que en general lo hagamos mas bonito, actualmente es solo una tabla plana».
- **S2** — El logo del local tiene que estar en el PDF. El único logo del proyecto
  es `public/logo.webp`, que **no se toca** (pdf-lib no embebe webp: se deriva un
  PNG).
- **S3** — El nombre de la sucursal tiene que verse en el PDF (hoy no aparece: solo
  va en el nombre del archivo, `inventario-<código>-<fecha>.pdf`).
- **S4** — El resto tiene que verse mejor que una tabla plana: encabezado, tabla
  legible y pie. Sin cambiar los datos que se exportan ni los cálculos: el PDF
  sigue saliendo de las filas que ya manda el servidor.
- **S5** — Restricciones del proyecto: nada de datos nuevos en el PDF que no salgan
  de lo ya consultado; sin cambios en la autorización (solo `admin`), en la
  validación de la selección ni en el archivo que se descarga (mismo nombre).

## Tasks

- **T1** [S2] — Logo en el PDF: convertir `public/logo.webp` a un PNG chico y
  embebido (base64) en un módulo, para no depender de leer archivos en runtime.
  Estado: pendiente.
- **T2** [S3] — Pasar el nombre de la sucursal (y la fecha) al generador desde el
  action, sin cambiar la consulta ni el resto del contrato. Estado: pendiente.
- **T3** [S4] — Rediseño del PDF: banda de encabezado con el logo y la sucursal,
  tabla con fila de títulos y filas alternadas, números alineados a la derecha,
  línea de totales y pie con «Página X de Y». Estado: pendiente.
- **T4** [S4] — Verificación: tests del generador y del action, `eslint`, `tsc`, y
  el PDF mirado por el usuario en la app. Estado: pendiente.

## Log

- **L1 — Pedido original, verbatim**: «Esta todo ok, una ultima cosa, todos los
  flujos andan bien, pero me gustaria que personalicemos el pdf que se exporta, que
  le agregemos el logo del local, el nombre de la sucursal y que en general lo
  hagamos mas bonito, actualmente es solo una tabla plana».
- **L2 — Reconocimiento previo**: el generador es `src/lib/utils/pdf.ts` (107
  líneas, A4, `ROWS_PER_PAGE` exportado) y lo llama el Server Action
  `src/app/actions/inventory.ts:911` con las filas ya armadas; el nombre del
  archivo lo arma `buildExportFileName(branch.code, new Date())`. `sharp` está
  disponible para derivar el PNG. El test del generador vive en
  `src/lib/utils/pdf.test.ts` y el del action en `src/app/actions/inventory.test.ts`
  (que fija la llamada `generateProductsPdf(rows)`, así que la firma nueva obliga a
  actualizarlo).
