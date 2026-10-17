# purchase-with-branch-split — Delta (Modified)

## Delta

- **MODIFIED** "PurchaseForm Component": se garantiza la carga de sucursales antes de renderizar los selects de sucursal por línea; mientras `useBranch().branches` no esté poblado, se muestra estado de carga. Sin cambios funcionales en la action.

## MODIFIED Requirements

### Requirement: PurchaseForm Component

El sistema MUST proveer `AddPurchaseButton` que NO renderiza los selects de sucursal por línea hasta que las sucursales estén cargadas (`useBranch().branches` poblado); mientras carga SHALL mostrar un estado de carga. El split grid SHALL mostrar cada sucursal con input de cantidad y total acumulado; SHALL validar que la suma de split no supere el total de compra.
(Previously: los selects por línea se renderizaban sin garantía de sucursales cargadas.)

#### Scenario: Esperar carga de sucursales

- GIVEN el modal de compra abierto con sucursales aún cargando
- WHEN el formulario renderiza
- THEN NO se muestran selects de sucursal por línea
- AND se muestra "Cargando..." hasta que branches esté poblado

#### Scenario: Split grid con sucursales cargadas

- GIVEN sucursales S1 y S2 cargadas y compra de Producto A (qty 10)
- WHEN se abre el split por línea
- THEN S1 y S2 aparecen con input de cantidad
- AND el total acumulado se muestra

#### Scenario: Split sum validated client-side

- GIVEN cantidades split de 6 y 6 (total 12)
- WHEN el total supera la cantidad de compra 10
- THEN el submit muestra "La suma supera el total"

## Acceptance Criteria

- [ ] Los selects por línea solo se renderizan con branches cargados (guard `if (!ready) return <Cargando.../>`)
- [ ] Sin cambios funcionales en `createPurchaseWithBranchSplit`

## Notes

- Cambio exclusivamente de wiring/UI; la action del spec base queda intacta.
