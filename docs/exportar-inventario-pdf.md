# Exportar inventario a PDF

Desde **Inventario** → botón **"Exportar productos"** el admin genera un PDF con el stock de una sucursal. El PDF se genera en el servidor con `pdf-lib` y se descarga como `inventario-<branchCode>-<YYYYMMDD>.pdf`.

## Cómo usarlo

1. En `/inventario`, tocar **"Exportar productos"** → se abre el asistente.
2. **Paso 1 — Elegir sucursal.** Obligatorio; el botón *Continuar* queda deshabilitado hasta elegir una.
3. **Paso 2 — Seleccionar productos.** Aparecen solo los productos **con stock** en esa sucursal (checkbox + contador de seleccionados). El checkbox **"Todos"** selecciona de una vez todos los productos con stock de la sucursal, y vuelve a destildarlos; queda marcado también cuando se seleccionan a mano todos los de la lista.
4. **Paso 3 — Generar PDF.** El botón *Generar PDF* queda deshabilitado si no hay nada seleccionado. La descarga arranca automáticamente.

## Detalles

| Tema | Decisión |
|------|----------|
| Componente | `ExportWizard` (client component, `src/app/inventario/components/ExportWizard.tsx`) |
| Server Action | `exportBranchProductsPdf(branchId, selectedProductIds)` (`src/app/actions/inventory.ts`) |
| Re-validación server-side | Se valida que la sucursal exista y que **todos** los productos seleccionados pertenezcan a esa sucursal con `stock > 0`. Si alguno no cumple, se rechaza **sin** generar el PDF. |
| Generación | `generateProductsPdf(rows, meta)` (`src/lib/utils/pdf.ts`) con `pdf-lib`: tabla de columnas **Código \| Nombre \| Stock \| Precio**, filas alternadas, paginación automática. `meta` aporta `branchName`, `branchCode` y `date`. |
| Tipografía | **Poppins** embebida (Regular y SemiBold, SIL OFL 1.1) desde `src/lib/fonts/poppins.ts` en base64, para que el PDF funcione también con el import dinámico en el navegador. Escala compartida en `DOCUMENT_FONT_SIZE` (`src/lib/fonts/document-fonts.ts`): título 15 pt, contenido 12 pt, encabezados de columna y metadatos 10 pt, pie 9 pt. |
| Encabezado | Banda superior en cada página: logo del local (PNG en base64 en `src/lib/utils/pdf-logo.ts`, derivado de `public/logo.webp` porque `pdf-lib` no embebe webp), nombre de la sucursal con su código (`Sucursal Depósito (DEP)`) y la línea `Inventario al DD/MM/YYYY` con la fecha de exportación |
| Filas | Mismo orden que la lista: por nombre de producto. Stock y Precio alineados a la derecha; un nombre que no entra en su columna se corta con `...` para no pisar el Stock |
| Totales | Una sola vez, al pie de la última página: `N productos · M unidades` (`M` = suma del stock de las filas exportadas) |
| Paginación | 32 filas por página (`ROWS_PER_PAGE`); el encabezado, el hueco, los títulos y la línea de totales reservada dejaron menos lugar para filas. Pie en **cada** página: `Página X de Y` |
| Precios | Formato `es-AR`, moneda ARS (ej. `$1.250,00`) |
| Salida | PDF en `base64`, descargado como Blob |
| Nombre de archivo | `inventario-<branchCode>-<YYYYMMDD>.pdf` (ej. `inventario-DEP-20260806.pdf`) |
| Sin cambios con el rediseño | Nombre de archivo, contrato de la Server Action `{ pdfBase64, filename }`, autorización solo `admin`, re-validación server-side de sucursal/stock, los 3 pasos del asistente y los datos exportados (ni columnas ni consultas nuevas) |

## Comprobantes de movimientos

El resultado de **Mover Stock** y **Entrada / Salida** también ofrece **Descargar comprobante**, con el mismo estilo visual. Es un documento de la operación confirmada, no otra exportación del inventario ni una nueva modificación de stock. Ver [contenido, descarga y manejo de errores](comprobantes-stock.md).

## Regenerar el logo

El logo va embebido como PNG en base64 dentro de `src/lib/utils/pdf-logo.ts` porque `pdf-lib` no embebe webp. Cuando cambie `public/logo.webp`, se rehace así:

```bash
node -e "require('sharp')('public/logo.webp').resize({width:320}).png({compressionLevel:9,palette:true}).toBuffer().then(b=>console.log(JSON.stringify(b.toString('base64'))))"
```

La cadena que imprime (31005 bytes → 41340 caracteres) se pega entre comillas simples en `LOGO_PNG_BASE64`, y después conviene correr `npx jest src/lib/utils/pdf.test.ts`: el caso del logo afirma que la página embebe un XObject de imagen, así que un base64 vacío o roto lo hace fallar.

## Errores

- Los errores **no pierden el estado del asistente** (sucursal y productos elegidos se conservan).
- Si la re-validación falla, se muestra el mensaje en pantalla y no se descarga nada.

## Checklist de verificación

- [ ] Sin sucursal elegida, el paso 1 bloquea el avance.
- [ ] El checkbox "Todos" del paso 2 selecciona todos los productos con stock de la sucursal (y ninguno sin stock), y lo destilda al volver a tocarlo.
- [ ] Sin productos seleccionados, el paso 3 deshabilita *Generar PDF*.
- [ ] El PDF muestra el logo del local, el nombre de la sucursal con su código (ej. `Sucursal Depósito (DEP)`) y `Inventario al DD/MM/YYYY`.
- [ ] El PDF muestra Código, Nombre, Stock y Precio, ordenados por nombre; un nombre largo se corta con `...` y no pisa el Stock.
- [ ] Al pie de la última página aparece `N productos · M unidades`, con `M` igual a la suma del stock exportado.
- [ ] Con más de 32 productos, la tabla continúa en la siguiente sin truncarse y **cada** página dice `Página X de Y`.
- [ ] El nombre del archivo es `inventario-<branchCode>-<YYYYMMDD>.pdf`.
