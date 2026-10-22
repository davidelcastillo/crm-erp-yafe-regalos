# Informes en PDF: guía visual

Los PDF que genera el sistema (inventario exportado, comprobante de movimiento y comprobante de ajuste de stock) tenían la estructura de una planilla: título chico, tablas con bordes marcados y sin jerarquía. El usuario pidió que guíen la lectura. Las **etiquetas de precio no entran**: su plantilla está aprobada y usa otra tipografía a propósito.

## Specs

- **S1** — Pedido, verbatim: «El informe esta bien, muestra la información necesaria pero no guia al usuario visualmente en el recorrido de la misma, por ello propongo cambiar todos los PDF generados por el sistema (salvo el de precios), aplicar principios de ux/ui, titulos grande y en negrita, información de detalles en cuadros sin bordes marcados y con los encabezados de cada tabla con un color suave de la paleta de colores del sistema».
- **S2** — Resúmenes, verbatim: «Si es necesario incluir resumenes utiles para el usuario, no tantos, lo importante casi siempre son las tablas».
- **S3** — Modelo visual, verbatim: «Para las tablas principales aplicar lo mismo del encabezado, se pude seguir este estilo visual : imagen en /docs/PDF/modeloinforme.webp». El archivo real es **`docs/PDF/ModeloPDF.webp`** (el pedido lo nombra de dos formas distintas). Lo que muestra: título grande y en negrita con color de marca, metadatos en dos líneas chicas arriba de la tabla, **encabezados de tabla con fondo de color y texto blanco en negrita**, filas separadas por una línea muy fina (sin bordes alrededor de la tabla), aire entre secciones, y un cierre con resumen y firmas.
- **S4** — Fuera de alcance: las **etiquetas de precio** (`src/lib/labels/*`, la plantilla de 30 × 23,5 mm) y cualquier cambio de datos, campos o cálculos. El rediseño es de estructura y color, no de contenido.

## Reglas de la unidad

- **Tipografía**: la ya embebida, Poppins Regular y SemiBold (`src/lib/fonts/poppins.ts`). Título 20 pt SemiBold, encabezado de sección 13 pt SemiBold, encabezado de tabla 10 pt SemiBold en blanco, contenido 12 pt, metadatos y pie 9–10 pt.
- **Color**: título y encabezados de sección en `#be185d` (el rosa de marca del sistema, 7:1 con blanco); **encabezado de tabla con fondo `#be185d` y texto blanco**; filas alternadas `#f7f7f7` y blanco; separador de filas `#e5e7eb`; texto `#222222`; metadatos `#6a6a6a`. Nada de bordes alrededor de la tabla: sólo la línea de las filas.
- **Resúmenes**: uno solo por documento, el que el usuario necesita para decidir (totales, ajustados/pendientes). No agregar cajas nuevas ni métricas decorativas.
- **A4 vertical**, con el mismo margen en todas las páginas y numeración de página en el pie.
- **Tests**: los actuales leen el texto por el CMap `/ToUnicode` (con fuente embebida los `Tj` son ids de glifo) y afirman el `/BaseFont`. El rediseño **no puede** cambiar el texto ni el orden lógico de los datos; si un caso falla por estructura, se ajusta y se explica.

## Tasks

- **T1** — `src/lib/utils/pdf.ts` (inventario exportado) con su test. **Hecho.**
- **T2** — `src/lib/utils/stock-movement-pdf.ts` (comprobante de movimiento) con su test. **Hecho.**
- **T3** — `src/lib/utils/stock-control-pdf.ts` (comprobante de ajuste de stock) con su test. **Hecho.**
- **T4** — Documentación afectada (`docs/exportar-inventario-pdf.md`, `docs/comprobantes-stock.md`) y evidencia en este documento. **Hecho.**

## Log

- **L1 — Pedido**, verbatim en S1–S3. La imagen del modelo se pudo leer: el archivo es `docs/PDF/ModeloPDF.webp`.
- **L2 — Implementación (T1–T3).** Paleta y escala compartidas en `DOCUMENT_COLOR` / `DOCUMENT_FONT_SIZE` (`src/lib/fonts/document-fonts.ts`); los tres generadores dejaron de usar la banda gris con acento rosa y el encabezado de tabla gris. Ahora: logo arriba, título 20 pt SemiBold `#6d28d9`, metadatos 9–10 pt `#6a6a6a`, encabezado de tabla 10 pt SemiBold blanco sobre rectángulo `#6d28d9`, filas sin caja con línea fina `#e5e7eb` y alternancia `#f7f7f7`/blanco, contenido `#222222`, y un solo resumen por documento en `#6d28d9`. No cambió ningún dato, campo, rótulo, orden ni cálculo.
- **L3 — Tests.** Se agregó un caso por generador («pinta el título en violeta de marca y el encabezado de tabla en blanco»), que lee los colores por el CMap: RED observado antes del cambio (título en `[0.13,0.13,0.13]`, encabezado sin blanco) y GREEN después. `ROWS_PER_PAGE` pasó de 32 a 30 por el bloque de título más alto: el caso que lo fija se ajustó con la cuenta nueva (707,89 − 22 encabezado − 70 reservado = 615,89 → 30), sin tocar los casos de paginación (80 filas → 3 páginas, 33 → 2).
- **L4 — Evidencia observada.** `npx jest src/lib/utils --runInBand`: 6 suites, 76 tests en verde. `npx tsc --noEmit`: sin salida. `npx eslint src/lib/utils src/lib/fonts`: sin salida. `src/lib/color-tokens.test.ts`, `control/page.test.tsx` y `StockMovementReceiptPanel.test.tsx`: 15 tests en verde. Muestra generada fuera del repo en `%TEMP%\pdf-sample\out` (inventario 1 pág., movimiento 1 pág., ajuste 1 pág.; los tres con `Poppins-Regular` y `Poppins-SemiBold` embebidas).
- **L5 — Fuera de alcance respetado.** Etiquetas de precio sin tocar (S4). No se agregaron encabezados de sección nuevos («Productos», «Diferencias»): el pedido prohíbe cambiar rótulos, así que la jerarquía la dan el título, el encabezado de tabla y el resumen.

- **L2 — Implementación y evidencia (2026-10-22)**: la paleta y la escala quedaron centralizadas en `src/lib/fonts/document-fonts.ts` (`DOCUMENT_COLOR` con `brand` `#6d28d9`, `ink` `#222222`, `muted` `#6a6a6a`, `hairline` `#e5e7eb`, `zebra` `#f7f7f7`; `DOCUMENT_FONT_SIZE` con título 20). **RED observado** por el escritor: título en `[0.13,0.13,0.13]` (gris), encabezado no blanco y `ROWS_PER_PAGE` 32; verde después: **76 casos en `src/lib/utils`**. **Prueba con binarios reales** (generados en `%TEMP%`, nunca en el repo): `inventario.pdf` (1 página, embebe `Poppins-Regular` y `Poppins-SemiBold`), `movimiento.pdf` (1 página, ambas), `ajuste.pdf` (1 página, ambas). **Decisión de alcance**: no se agregaron encabezados de sección nuevos («Productos», «Diferencias») porque serían rótulos que el usuario no pidió; por eso la regla de 13 pt queda definida pero sin uso hasta que haga falta. Los datos, rótulos, orden y cálculos no cambiaron.

- **L3 — Vuelta al rosa de antes (2026-10-22), verbatim**: «lo del pdf está bien pero que sea con los colores rosa de antes». La estructura queda como está; el color de marca de los tres documentos pasa de violeta `#6d28d9` a **`#be185d`**, que es el rosa que ya usaban los PDF antes del rediseño y el `brand-rosa-texto` del sistema (7:1 con blanco, así el texto del encabezado se lee). El cambio es de una constante —`DOCUMENT_COLOR.brand` en `src/lib/fonts/document-fonts.ts`— porque los tres generadores la consumen; las tres aserciones de color de los tests se actualizaron al valor que pdf-lib escribe en el flujo (`[0.75, 0.09, 0.36]`), y `src/lib/utils` queda en **76 casos** con `tsc` 0.
