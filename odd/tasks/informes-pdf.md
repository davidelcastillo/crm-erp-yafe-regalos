# Informes en PDF: guía visual

Los PDF que genera el sistema (inventario exportado, comprobante de movimiento y comprobante de ajuste de stock) tenían la estructura de una planilla: título chico, tablas con bordes marcados y sin jerarquía. El usuario pidió que guíen la lectura. Las **etiquetas de precio no entran**: su plantilla está aprobada y usa otra tipografía a propósito.

## Specs

- **S1** — Pedido, verbatim: «El informe esta bien, muestra la información necesaria pero no guia al usuario visualmente en el recorrido de la misma, por ello propongo cambiar todos los PDF generados por el sistema (salvo el de precios), aplicar principios de ux/ui, titulos grande y en negrita, información de detalles en cuadros sin bordes marcados y con los encabezados de cada tabla con un color suave de la paleta de colores del sistema».
- **S2** — Resúmenes, verbatim: «Si es necesario incluir resumenes utiles para el usuario, no tantos, lo importante casi siempre son las tablas».
- **S3** — Modelo visual, verbatim: «Para las tablas principales aplicar lo mismo del encabezado, se pude seguir este estilo visual : imagen en /docs/PDF/modeloinforme.webp». El archivo real es **`docs/PDF/ModeloPDF.webp`** (el pedido lo nombra de dos formas distintas). Lo que muestra: título grande y en negrita con color de marca, metadatos en dos líneas chicas arriba de la tabla, **encabezados de tabla con fondo de color y texto blanco en negrita**, filas separadas por una línea muy fina (sin bordes alrededor de la tabla), aire entre secciones, y un cierre con resumen y firmas.
- **S4** — Fuera de alcance: las **etiquetas de precio** (`src/lib/labels/*`, la plantilla de 30 × 23,5 mm) y cualquier cambio de datos, campos o cálculos. El rediseño es de estructura y color, no de contenido.

## Reglas de la unidad

- **Tipografía**: la ya embebida, Poppins Regular y SemiBold (`src/lib/fonts/poppins.ts`). Título 20 pt SemiBold, encabezado de sección 13 pt SemiBold, encabezado de tabla 10 pt SemiBold en blanco, contenido 12 pt, metadatos y pie 9–10 pt.
- **Color**: título y encabezados de sección en `#6d28d9` (la acción de marca, 7,1:1 con blanco); **encabezado de tabla con fondo `#6d28d9` y texto blanco**; filas alternadas `#f7f7f7` y blanco; separador de filas `#e5e7eb`; texto `#222222`; metadatos `#6a6a6a`. Nada de bordes alrededor de la tabla: sólo la línea de las filas.
- **Resúmenes**: uno solo por documento, el que el usuario necesita para decidir (totales, ajustados/pendientes). No agregar cajas nuevas ni métricas decorativas.
- **A4 vertical**, con el mismo margen en todas las páginas y numeración de página en el pie.
- **Tests**: los actuales leen el texto por el CMap `/ToUnicode` (con fuente embebida los `Tj` son ids de glifo) y afirman el `/BaseFont`. El rediseño **no puede** cambiar el texto ni el orden lógico de los datos; si un caso falla por estructura, se ajusta y se explica.

## Tasks

- **T1** — `src/lib/utils/pdf.ts` (inventario exportado) con su test.
- **T2** — `src/lib/utils/stock-movement-pdf.ts` (comprobante de movimiento) con su test.
- **T3** — `src/lib/utils/stock-control-pdf.ts` (comprobante de ajuste de stock) con su test.
- **T4** — Documentación afectada (`docs/exportar-inventario-pdf.md`, `docs/comprobantes-stock.md`) y evidencia en este documento.

## Log

- **L1 — Pedido**, verbatim en S1–S3. La imagen del modelo se pudo leer: el archivo es `docs/PDF/ModeloPDF.webp`.
