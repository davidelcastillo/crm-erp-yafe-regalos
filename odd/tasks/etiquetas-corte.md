# Etiquetas: cantidad del stock y canal de corte

Objetivo: que «Todos» imprima tantas etiquetas como unidades hay en la sucursal (hoy pone una por producto) y que la hoja deje canal entre etiquetas para cortar a mano, con marcas de corte.
Rama: `feat/etiquetas-corte` (desde `main` = `fce4125`). Entrega: commits locales y PR. Verificación: `npm run test:local-db`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, y la mirada del usuario sobre el PDF.

## Specs

- **S1** — «cuando pongo imprimir todos, si bien selecciona todos los productos, no pone sus cantidades, por ejemplo si tengo 4 del producto 1 me lo selecciona como 1 solo». Con «Todos» (y al tildar un producto) la cantidad debe arrancar en el **stock de esa sucursal**; lo que el usuario escriba a mano manda sobre el stock.
- **S2** — «las etiquetas no dejan espacio para cortar, osea si bien el tamaño es correcto, como lo cortamos a mano necesitamos un poco mas de espacio». Tiene que haber canal entre etiquetas.
- **S3** — «podriamos quitar una fila o una colmna y distribuirlas un poquito a las etiquetas una de otras». Decisión del usuario del 2026-10-21: **«Mantener 9×8 y achicar la etiqueta»** — la grilla sigue en 9 × 8 = 72 y el canal sale de achicar la etiqueta dibujada dentro de su celda.
- **S4** — «ademas si es posible agregarle la marca de corte». Decisión del usuario: **«Ticks en las esquinas»** — marcas cortas en las cuatro esquinas de cada etiqueta, dentro del canal, sin cruzar la hoja.
- **S5** — Nada más cambia: el contenido de la etiqueta (código, `$`, importe, `@feria_conexx`), sus colores, la tipografía y el orden de llenado (columna por columna) quedan como están. No se toca el esquema, ni la base, ni las demás pantallas.

### Geometría decidida

| Medida | Valor |
|---|---|
| Hoja | A4 horizontal, 297 × 210 mm |
| Grilla | 9 columnas × 8 filas = **72 por hoja** |
| Celda (paso de la grilla) | 33 × 26,25 mm — entra exacta: 9 × 33 = 297 y 8 × 26,25 = 210 |
| Etiqueta dibujada | **30 × 23,5 mm** |
| Canal | **3 mm** horizontal y **2,75 mm** vertical (la mitad a cada lado de la etiqueta) |
| Marcas de corte | ticks de 1,1 mm, separados 0,15 mm del borde de la etiqueta, en las cuatro esquinas |

El contenido interno se conserva tal cual (caja del código de 1 a 7,9 mm, caja del precio de 9 a 20,7 mm y `@feria_conexx` hasta 23,25 mm): entra en los 23,5 mm de alto sin reacomodar nada.

## Tasks

- **T1** [S1] — inline — hecha — `LabelSelector`: la cantidad efectiva es el stock de la sucursal (acotado a 1..999) salvo que el usuario haya escrito otra cosa; tildar ya no escribe cantidades en el estado. RED: 2 casos (campos en 1 en vez del stock) → GREEN 9/9.
- **T2** [S2,S3] — inline — hecha — `label-layout.ts`: separadas **celda** (`CELL_*`, paso de la grilla, sigue entrando exacta en A4) y **etiqueta** (`LABEL_WIDTH/HEIGHT` = 30 × 23,5), con `GUTTER_*` y `LABEL_INSET_*`; las posiciones ahora incluyen la sangría.
- **T3** [S4] — inline — hecha — Geometría pura `cutMarksForSlot` (8 ticks por etiqueta: dos por esquina) y `drawCutMarks` en el generador, que reemplaza la grilla de bordes pegados que había antes.
- **T4** [S2–S4] — inline — hecha — Pines: canal 3 y 2,75 mm, etiqueta 30 × 23,5, contenido de la plantilla (hasta 20,7 mm) dentro del alto nuevo, marcas de corte dentro de la hoja y fuera de cada etiqueta, y presencia de las marcas en el PDF (40 trazos para 5 etiquetas). `strokeOps` cuenta operadores `S` en los streams inflados.
- **T5** [S1–S5] — inline — hecha — Checks (L5), muestra regenerada y PR.

## Log

- **L1 — Pedido, verbatim**: «Ahora en producción acabo de detectar 2 cosas que se podrian mejorar del PDF de los precios, 1. cuando pongo imprimir todos, si bien selecciona todos los productos, no pone sus cantidades, por ejemplo si tengo 4 del producto 1 me lo selecciona como 1 solo. 2. El PDF final esta bien pero las etiquetas no dejan espacio para cortar, osea si bien el tamaño es correcto, como lo cortamos a mano necesitamos un poco mas de espacio, asi que podriamos quitar una fila o una colmna y distribuirlas un poquito a las etiquetas una de otras, ademas si es posible agregarle la marca de corte».
- **L2 — Estado leído antes de escribir**: en `LabelSelector`, la cantidad por defecto era `"1"` para todas las filas y «Todos» sólo tildaba, así que 4 unidades del producto 1 daban 1 etiqueta. En la hoja, la grilla 9 × 8 **entra exacta** en A4 horizontal (0 mm libres) y el generador dibujaba un rectángulo de borde alrededor de cada celda de 33 × 26,25 mm: bordes que se tocan, inútiles para cortar a mano.
- **L3 — Decisiones del usuario**: «9 etiquetas a lo largo, 8 a lo alto, ya las conte»; después, sobre cómo conseguir el canal, eligió «Mantener 9×8 y achicar la etiqueta (recomendado)» y, sobre las marcas, «Ticks en las esquinas (recomendado)».
- **L4 — T1 implementada y verificada**: RED observado (2 fallos: los campos mostraban 1 en vez del stock) → GREEN 9/9 en `LabelSelector.test.tsx`, con el pin actualizado de `quantity: 1` a `quantity: 2` en el caso que genera el PDF. `tsc` limpio. La regla quedó: `quantities` guarda **sólo** lo que el usuario corrigió, así destildar y volver a tildar no pierde lo escrito.
- **L5 — T2–T5 y checks (2026-10-21)**: la hoja mantiene 9 × 8 = 72 porque la celda sigue siendo el paso de la grilla (9 × 33 = 297 y 8 × 26,25 = 210, exacto) y el canal sale de achicar la etiqueta a 30 × 23,5 mm. El contenido interno no se movió: la caja del código va de 1 a 7,9 mm, la del precio de 9 a 20,7 mm y el handle termina en 20,7 mm, así que todo entra en los 23,5 mm. Las marcas son 4 ticks de 1,1 mm por etiqueta separados 0,15 mm del borde, y **todos caen dentro de la hoja** (el más externo arranca a 0,125 mm del borde). Pines nuevos: `label-layout.test.ts` verifica las 8 marcas por etiqueta y que ninguna pise la etiqueta ni se salga de la hoja; `label-print.test.ts` verifica que el PDF trae 8 trazos por etiqueta en negro de trazo (`RG`). Checks: `npm run test:local-db -- --runInBand` → **89 suites / 682 tests**; `npx tsc --noEmit` → 0; `npm run lint` → 0 errores / 35 warnings; `npm run build` → OK. Muestra regenerada en `docs/PDF Precios/etiquetas-muestra.pdf` (72 etiquetas, 141 KB) para la revisión del usuario. **Riesgo declarado**: que las hojas nuevas no se alineen con etiquetas adhesivas pre-cortadas de 33 × 26,25 mm; con esta geometría están pensadas para imprimir en papel y cortar a mano. Sin cambios de esquema ni de datos.
