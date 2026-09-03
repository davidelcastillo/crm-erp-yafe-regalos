# Delta para Sale with Branch (fix-fase4-correcciones)

## ADDED Requirements

### Requirement: Refresco de Lista Post-Venta

La página `/ventas` (cliente) DEBE recargar su lista de ventas tras registrar una venta con éxito. El botón de venta DEBE notificar a la página tras el éxito (patrón reloadKey/onSuccess que se añade a las dependencias del useEffect de carga). `router.refresh()` por sí solo NO DEBE considerarse suficiente para recargar la lista. (FIX-FASE4 issue 7)

#### Scenario: La lista se actualiza tras vender
- GIVEN la página /ventas con una lista de ventas cargada
- WHEN se registra una venta con éxito
- THEN la página DEBE recargar la lista y mostrar la nueva venta sin recarga manual

#### Scenario: Refresco sin cambiar filtros
- GIVEN ventas en la sucursal seleccionada y sin búsqueda activa
- WHEN se registra una venta con éxito
- THEN la lista DEBE recargarse aunque branchId y búsqueda no cambien
