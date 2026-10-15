# Delta para Purchase with Branch Split (fix-fase4-correcciones)

## ADDED Requirements

### Requirement: Endurecimiento del Envío Cliente

El formulario de compra (cliente) DEBE: actualizar las filas de items con actualizaciones funcionales de estado (sin closures obsoletos), usar ids estables por fila, enviar `performedBy` en la compra, y bloquear la re-entrada de envío mientras se está enviando (single-flight). (FIX-FASE4 issue 3)

#### Scenario: Actualización funcional de filas
- GIVEN 2 filas de items cargadas
- WHEN se edita la cantidad de una fila
- THEN las demás filas DEBEN conservar sus valores

#### Scenario: Ids estables por fila
- GIVEN dos filas agregadas en el mismo milisegundo
- WHEN se agregan al formulario
- THEN ambas filas DEBEN tener ids únicos

### Requirement: Refresco de Lista Post-Compra

La página `/compras` (cliente) DEBE recargar su lista de compras tras registrar una compra con éxito, con el mismo patrón reloadKey que `/ventas`. (FIX-FASE4 issue 7)

#### Scenario: La lista se actualiza tras comprar
- GIVEN la página /compras con una lista cargada
- WHEN se registra una compra con éxito
- THEN la página DEBE recargar la lista y mostrar la nueva compra

## MODIFIED Requirements

### Requirement: createPurchaseWithBranchSplit Server Action

La Server Action `createPurchaseWithBranchSplit` DEBE aceptar una cabecera de compra (supplierId, date, paymentMethod) y un arreglo de entradas `{productId, branchId, quantity, price}`. Cada entrada DEBE validar: sucursal existente y activa, producto existente y activo, quantity ≥ 1. La operación DEBE ejecutarse en una transacción Prisma. Ante errores transitorios de conexión/pool de Prisma (P1001, P1008, P2024, P2034), la acción DEBE reintentar de forma acotada (número limitado de reintentos) antes de fallar, y DEBE registrar en log el primer fallo (error crudo + input validado). Los errores no transitorios (validación o datos) NO DEBEN reintentarse y DEBEN retornar el error correspondiente. (FIX-FASE4 issue 3)
(Previously: el primer intento ante un error transitorio de Prisma devolvía un error genérico sin reintento ni logging)

#### Scenario: Compra dividida exitosa
- GIVEN una compra de Producto A (qty 10, $100) dividida en Sucursal 1 (qty 6) y Sucursal 2 (qty 4)
- WHEN se invoca createPurchaseWithBranchSplit
- THEN DEBE crearse un registro Purchase y los PurchaseItem de cada tramo
- AND BranchProduct DEBE aumentar 6 en Sucursal 1 y 4 en Sucursal 2
- AND Product.stock DEBE aumentar 10

#### Scenario: Reintento ante error transitorio
- GIVEN un error transitorio P2024 en el primer intento de transacción
- WHEN se invoca createPurchaseWithBranchSplit con el mismo input
- THEN la acción DEBE reintentar y la compra DEBE registrarse correctamente
- AND el primer fallo DEBE quedar registrado en log

#### Scenario: Producto inactivo rechazado
- GIVEN una compra que incluye un producto inactivo
- WHEN se invoca createPurchaseWithBranchSplit
- THEN la acción DEBE rechazar con PRODUCT_INACTIVE sin reintentar

#### Scenario: Sucursal inválida rechazada
- GIVEN una compra con branchId inexistente
- WHEN se invoca createPurchaseWithBranchSplit
- THEN la acción DEBE rechazar con BRANCH_NOT_FOUND
