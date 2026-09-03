# Domain: branch-export-pdf — Delta

## Delta

`ExportWizard` amplía su contenedor de `max-w-lg` a `max-w-xl` para acomodar con holgura la tabla de cantidades del paso de selección, manteniéndose como gold standard STYLE.md (bottom-sheet, `rounded-t-3xl`, `p-6`, `animate-slide-up`, overlay con blur, CTA Rausch). No se toca el contrato funcional: los 3 pasos del wizard, la llamada a `getBranchProductsForExport({ branchId })`, la generación de PDF (`exportBranchProductsPdf`), la regla de exportar solo productos con stock > 0 y la firma de props permanecen intactos. `ExportWizard.test.tsx` SHALL seguir en verde sin cambios de aserción.

## Requirements

1. **Contenedor ampliado a `max-w-xl` (SHALL)** — El contenedor principal de `ExportWizard` SHALL usar `max-w-xl` en lugar de `max-w-lg`, conservando `bg-white w-full rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto` y el overlay con blur existentes.

2. **Contrato del wizard intacto (SHALL)** — El wizard SHALL conservar sus 3 pasos (selección de sucursal, selección de productos con stock > 0, confirmación/generación), su firma de props (`open`, `onClose`, `branches`) y su flujo de confirmación. NO SHALL cambiar el nombre ni la firma de las actions consumidas.

3. **Llamada a `getBranchProductsForExport({ branchId })` sin cambios (SHALL)** — El paso de productos SHALL seguir invocando `getBranchProductsForExport` con el argumento de objeto `{ branchId }`, y la aserción del test SHALL permanecer `toHaveBeenCalledWith({ branchId: 1 })`.

4. **Exportación solo con stock > 0 sin cambios (SHALL)** — La regla de incluir únicamente productos con `stock > 0` (en la action, en la lista de productos disponibles del wizard y en la validación del PDF) SHALL conservarse; la regla SHALL NOT aplicarse a `getExternalBranchInventory` del portal externo.

5. **Balance visual de la tabla ampliada (SHOULD)** — Con el contenedor más ancho, la tabla de cantidades del paso de selección SHOULD distribuirse sin desbalanceo visual (columnas de nombre, código y stock con espaciado coherente), sin generar scroll horizontal.

6. **Regresión de tests (SHALL)** — `ExportWizard.test.tsx` SHALL pasar sin cambios de aserción; si el agrandado altera un snapshot, este SHALL actualizarse en el mismo commit y la cobertura funcional SHALL mantenerse.

## Scenarios

#### Scenario: Export con tabla ampliada

- GIVEN el wizard abierto con una sucursal seleccionada y varios productos con stock > 0
- WHEN se renderiza el paso de selección de productos
- THEN el contenedor SHALL presentar `max-w-xl`
- AND la tabla de cantidades SHALL mostrarse completa sin desbordes ni scroll horizontal

#### Scenario: Paso 2 mantiene la llamada con objeto

- GIVEN el admin selecciona la sucursal id 1
- WHEN el wizard carga los productos disponibles
- THEN SHALL invocar `getBranchProductsForExport({ branchId: 1 })`
- AND la lista SHALL renderizar sin el error "Expected object, received number"

#### Scenario: Productos con stock 0 excluidos del export

- GIVEN 3 productos en la sucursal, uno con stock 0
- WHEN se exporta
- THEN el PDF SHALL incluir solo los 2 productos con stock > 0
- AND el wizard SHALL mostrar solo 2 checkboxes

#### Scenario: Test de regresión intacto

- GIVEN `ExportWizard.test.tsx` mockea la action
- WHEN el test se ejecuta tras el agrandado del contenedor
- THEN la aserción SHALL seguir siendo `toHaveBeenCalledWith({ branchId: 1 })`
- AND el test SHALL pasar en verde

## Out of Scope

- No se modifican las actions `getBranchProductsForExport` ni `exportBranchProductsPdf`.
- No se cambian los pasos, textos ni la lógica de generación de PDF.
- No se rediseñan otros modales ni la tabla de movimientos.
- No se altera el portal externo de sucursal (`/sucursal/*`).