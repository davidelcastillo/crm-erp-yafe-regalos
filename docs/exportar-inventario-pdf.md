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
| Generación | `generateProductsPdf(rows)` con `pdf-lib`: tabla de columnas **Código \| Nombre \| Stock \| Precio**, paginación automática (se corta la página cuando se llena) |
| Precios | Formato `es-AR`, moneda ARS (ej. `$1.250,00`) |
| Salida | PDF en `base64`, descargado como Blob |
| Nombre de archivo | `inventario-<branchCode>-<YYYYMMDD>.pdf` (ej. `inventario-DEP-20260806.pdf`) |

## Errores

- Los errores **no pierden el estado del asistente** (sucursal y productos elegidos se conservan).
- Si la re-validación falla, se muestra el mensaje en pantalla y no se descarga nada.

## Checklist de verificación

- [ ] Sin sucursal elegida, el paso 1 bloquea el avance.
- [ ] El checkbox "Todos" del paso 2 selecciona todos los productos con stock de la sucursal (y ninguno sin stock), y lo destilda al volver a tocarlo.
- [ ] Sin productos seleccionados, el paso 3 deshabilita *Generar PDF*.
- [ ] El PDF muestra Código, Nombre, Stock y Precio.
- [ ] Con más productos de los que entran en una página, la tabla continúa en la siguiente sin truncarse.
- [ ] El nombre del archivo es `inventario-<branchCode>-<YYYYMMDD>.pdf`.
