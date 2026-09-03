# sale-with-branch — Delta (Modified)

## Delta

- **MODIFIED** "SaleForm Component": el `BranchSelector` es obligatorio y controlado (`value`/`onChange`) como paso 1; sin sucursal no se puede agregar productos ni confirmar; la sucursal elegida se pasa a `registerSale` y acota el `ProductSearch`.
- "createSaleWithBranch Server Action": sin cambios funcionales en este change.

## MODIFIED Requirements

### Requirement: SaleForm Component

El sistema MUST proveer el modal de venta (`AddSaleButton`) con `BranchSelector` controlado como paso 1 obligatorio. El usuario MUST seleccionar una sucursal antes de poder agregar productos o confirmar. La sucursal seleccionada SHALL usarse en `registerSale` y para acotar la búsqueda/stock de productos.
(Previously: el selector existía como dropdown requerido en el formulario, pero no controlaba el flujo de agregar productos.)

#### Scenario: Render del modal de venta

- GIVEN el modal de venta abierto
- WHEN el formulario renderiza
- THEN muestra búsqueda de producto, BranchSelector (paso 1), cantidad, precio unitario y selector de método de pago

#### Scenario: Sucursal requerida para vender

- GIVEN el modal de venta abierto sin sucursal seleccionada
- WHEN el admin intenta agregar un producto o confirmar
- THEN se muestra "Debe seleccionar una sucursal"
- AND no se puede confirmar la venta

#### Scenario: Venta con sucursal seleccionada

- GIVEN el modal de venta abierto con S1 seleccionada
- WHEN el admin agrega producto y confirma
- THEN `registerSale` recibe branchId=S1
- AND el stock se deduce de S1

## Acceptance Criteria

- [ ] Imposible agregar producto o confirmar venta sin sucursal
- [ ] El BranchSelector usa modo controlado (value/onChange), sin estado duplicado
- [ ] La venta registra branchId y deduce stock de esa sucursal

## Notes

- La action del spec base (`createSaleWithBranch`) mantiene su contrato; la UI llama `registerSale` con la sucursal — verificar equivalencia de nombres en implementación.
- La sucursal elegida acota el `ProductSearch` para no ofrecer productos sin stock en esa sucursal.
