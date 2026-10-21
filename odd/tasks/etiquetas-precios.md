# Etiquetas de precio y ajustes de la ronda 2

Objetivo: seis ajustes pedidos por el usuario sobre la versión publicada, con el PDF de etiquetas de precio como pieza central (reemplaza el intento anterior, que nunca llegó a usarse).
Rama: `feat/etiquetas-ronda-2` (sale de `origin/main` @ `81d303c`) · Runner: `npm run test:local-db` cuando la unidad toca base; `npx jest` para las puras y de componente.

## Specs

Pedido original en L1 (verbatim). Las respuestas de producto dadas por el usuario quedan en L2 y se citan acá.

- **S1**: «Boton para ir a inactivos en PC».
- **S2**: «Desactivar click fuera de los modales en exportar y, mover stock, entrada salida y eso, para el caso de compras/ventas el click esta desactivo por fuera del modal, asi esta bien porque si llego a dar un click afuera por error se sale».
- **S3**: «CAMBIO IMPORTATANTE : anteriormente intente hacer la opción de que el sistema me genere un pdf con las imagenes del codigo + el precio asi yo lo imprimimia y lo pegaba directamente en mis productos, nunca funciono, tengo una plantilla de como se deberia ver el diseño y el tamaño y todo, si queres le decimos a otro modelo que vea la imagen y copie y especifique el diseño asi, el diseño esta en la carpeta docs\PDF Precios, ademas en alguno de los promts anteriores (en carpetas promt ver1,2,3) indique masomenos como queria el diseño pero al parecer no me entendia la ia en ese momento, nose como podriamos hacer, por lo lado del diseño, deberia ser un modal del tipo de ingreso /egreso witzard, seleccionamos la sucursal y despues los productos para que genere el pdf, deberia haber un boton para seleccionar todos y se deberia poder seleccionar la cantidad total del producto x, por ejemplo si tengo 5 productos 1, y selecciono que quiero crear las etiquetas para los 5, despues en el PDF deberia aparecer 5 veces esa etiqueta del producto».
- **S4**: «En imprimir/listar productos, ya sea en inventario, sucursales o demas, ordenar alfabeticamente por codePrefix y numericamente con code, osea si tengo el codigo AAA001, BBB888, AAA099, deberia verse : AAA001-AAA099-BBB888; Tambien agregar la opción para ordenar por ultima fecha de modificación, que se pueda cambiar entre estas 2.»
- **S5**: «Cuando se imprimen el catalogo de la sucursal, se muestran los productos inactivos -> corregir eso, solo deberian listarse productos activos».
- **S6** (L2, respuestas): formato de hoja **A4 horizontal 9 × 8 = 72 etiquetas** por hoja; en la caja blanca superior va **el código del producto en texto**; después de elegir sucursal se ofrecen **los productos activos con stock > 0 en esa sucursal**; el orden por código con cambio a fecha de modificación va **en todas las listas del sistema** (inventario, sucursal, PDF, etc.).

### S3 — diseño medido de la plantilla (`docs/PDF Precios/precios.png`)

La imagen es un A4 horizontal (2000 × 1414 px @ 171 dpi). Medido píxel a píxel: grilla de 9 columnas × 8 filas, celda 217,25 × 166,4 px, líneas de corte negras de 4 px. Todo lo de abajo está expresado en mm para la celda de **33,00 × 26,25 mm** (S6) y en porcentaje de la celda para que escale.

Colores: fondo de etiqueta `#fcd2d3`; cajas `#ffeff3`; `$`, `@feria_conexx` y el código `#6b2b43`; líneas de corte `#000000`.

| Pieza | Medida en la plantilla | En mm (celda 33 × 26,25) |
| --- | --- | --- |
| Celda (paso de grilla) | 217,25 × 166,4 px | 33,00 × 26,25 |
| Línea de corte | 4 px | 0,6 |
| Caja del código: ancho | 81 % de la celda | 26,7 (centrada: 3,15 por lado) |
| Caja del código: alto | 26,4 % | 6,9 |
| Caja del código: desde el borde superior | 3,8 % | 1,0 |
| Caja del código: radio de esquina | 18 px | 2,7 |
| Separación entre cajas | 1,3 mm | 1,3 |
| Caja del precio: alto | 44,5 % | 11,7 |
| Caja del precio: desde el borde superior | 34,5 % | 9,0 |
| Caja del precio: radio de esquina | 23 px | 3,4 |
| `$`: sangría desde la caja | 11 px | 1,7 |
| `$`: alto visible | 35 px | 5,5 (centrado vertical en la caja) |
| `@feria_conexx`: alto visible | 16 px | 2,5–3,2 |
| `@feria_conexx`: desde el borde superior | justo debajo de la caja del precio | 20,7 |
| `@feria_conexx`: ancho | 154 px (88 % de la caja) | 23,4 |
| Margen inferior libre | 8 px | 1,3 |

Contenido por etiqueta, en este orden: **código** centrado en la caja superior (Helvetica-Bold, ajustado para no pasar el 90 % del ancho de la caja); **`$`** a la izquierda de la caja del precio en Shrikhand; **precio** a la derecha del `$`, alineado a la misma base (Helvetica-Bold); **`@feria_conexx`** centrado debajo de la caja del precio en Shrikhand. Sin nombre de producto, sin stock y sin otros datos.
Distribución de la hoja: 72 etiquetas, **llenando columna por columna** (de arriba abajo, después la columna siguiente); las etiquetas de la última hoja quedan en las primeras posiciones.

## Tasks

- **T1** [S1] — Botón **Inactivos** en la barra de acciones de PC de `/inventario` (hoy solo existe como tarjeta en celular).
- **T2** [S2] — Nada de cierre por click afuera en los modales con datos: exportar, mover stock, entrada/salida, movimientos del producto, caja, cerrar caja, producto, cliente, categoría y sucursal. Compras y ventas quedan como están (ya no cierran así).
- **T3** [S5] — El listado y el PDF de exportación de una sucursal dejan fuera los productos inactivos.
- **T4** [S4] — Orden compartido por código (`AAA001 → AAA099 → BBB888`) como default, con cambio a última fecha de modificación, en las listas de la app y en el PDF de exportación.
- **T5** [S3, S6] — Etiquetas de precio: generador nuevo según la plantilla + wizard (sucursal → productos con cantidad y «Todos») + su acceso en `/inventario`.
- **T6** — Cierre: suite completa, `tsc`, `lint`, `build`, evidencia por spec y documento espejo en Engram.

## Log

- **L1 — Pedido del usuario, verbatim**: «Hola, carga en memoria lo ultimo del repo, hay algunos cambios para hacer respescto a la ultima versión, te los ennumero : Boton para ir a inactivos en PC / Desactivar click fuera de los modales en exportar y, mover stock, entrada salida y eso, para el caso de compras/ventas el click esta desactivo por fuera del modal, asi esta bien porque si llego a dar un click afuera por error se sale / CAMBIO IMPORTATANTE : anteriormente intente hacer la opción de que el sistema me genere un pdf con las imagenes del codigo + el precio asi yo lo imprimimia y lo pegaba directamente en mis productos, nunca funciono, tengo una plantilla de como se deberia ver el diseño y el tamaño y todo, si queres le decimos a otro modelo que vea la imagen y copie y especifique el diseño asi, el diseño esta en la carpeta docs\PDF Precios, ademas en alguno de los promts anteriores (en carpetas promt ver1,2,3) indique masomenos como queria el diseño pero al parecer no me entendia la ia en ese momento, nose como podriamos hacer, por lo lado del diseño, deberia ser un modal del tipo de ingreso /egreso witzard, seleccionamos la sucursal y despues los productos para que genere el pdf, deberia haber un boton para seleccionar todos y se deberia poder seleccionar la cantidad total del producto x, por ejemplo si tengo 5 productos 1, y selecciono que quiero crear las etiquetas para los 5, despues en el PDF deberia aparecer 5 veces esa etiqueta del producto / En imprimir/listar productos, ya sea en inventario, sucursales o demas, ordenar alfabeticamente por codePrefix y numericamente con code, osea si tengo el codigo AAA001, BBB888, AAA099, deberia verse : AAA001-AAA099-BBB888; Tambien agregar la opción para ordenar por ultima fecha de modificación, que se pueda cambiar entre estas 2. / Cuando se imprimen el catalogo de la sucursal, se muestran los productos inactivos -> corregir eso, solo deberian listarse productos activos.»
- **L2 — Definiciones de producto (respuestas del usuario, verbatim)**: «Sí: A4 horizontal, 9 × 8 (72 por hoja)» · «El código del producto, en texto» · «Activos con stock > 0 en esa sucursal» · «En todas las listas del sistema, inventario, sucursal, pdf, etc».
- **L3 — Estado del código antes de escribir** (leído, no supuesto): la funcionalidad de etiquetas existe pero **nunca fue alcanzable** — `src/app/inventario/page.tsx:34` declara `labelSelectorOpen` y nadie llama `setLabelSelectorOpen(true)`, así que no hay botón. Además el generador estaba mal por tres motivos independientes: (a) geometría de otra plantilla (A4 vertical 7 × 13, etiqueta 22 × 28 mm parada, márgenes de 1 mm y rectángulos sin esquina redondeada); (b) **una página por etiqueta** (`pdfDoc.addPage` dentro del bucle) en vez de 72 por hoja; (c) `embedFont` con un TTF sin `fontkit` registrado y sin la dependencia instalada, así que la acción fallaba. El wizard usaba un buscador en vez del patrón sucursal → productos de los hermanos. La corrección es reescribir el layout y el generador y reemplazar el modal por el wizard de T5.
- **L4 — Plantilla medida**: ver §S3. La medición se hizo con `sharp` sobre los píxeles (perfiles de color por fila y columna, bounding boxes de las cajas y del texto), no a ojo: pasos de grilla, colores exactos, insets, alturas y radios salen de ahí.
- **L5 — Decisión informada de T2**: se desactiva el cierre por click afuera en **todos** los modales con datos (no solo los tres nombrados), porque el motivo que dio el usuario —un click al costado borra lo cargado— vale igual para caja, cierre, producto, cliente, categoría y sucursal. Los menús (☰ y el de «más» del navbar) y el buscador de productos siguen cerrando por click afuera: no tienen datos propios. Compras y ventas quedan intactas porque ya estaban así.
