# Delta para Branch Management (fix-fase4-correcciones)

## ADDED Requirements

### Requirement: Botón de Login del Portal por Sucursal

En la lista de sucursales (BranchManager), el sistema DEBE mostrar por cada sucursal un botón que navegue al login del portal externo `/sucursal/{branchId}/login`, con estilo secundario, min-h-[44px] y touch-manipulation, ubicado en el clúster de acciones existente. (FIX-FASE4 issue 13)

#### Scenario: Botón visible por sucursal
- GIVEN la lista de sucursales con al menos una sucursal
- WHEN se renderiza cada sucursal
- THEN DEBE mostrarse un botón que navegue a /sucursal/{id}/login

#### Scenario: Navegación al login del portal
- GIVEN una sucursal con id=210
- WHEN el admin pulsa el botón del portal
- THEN el sistema navega a /sucursal/210/login

## MODIFIED Requirements

### Requirement: Borrar Sucursal

El sistema NO DEBE borrar de forma dura una sucursal con historial de transacciones. Solo las sucursales sin transacciones PUEDEN borrarse permanentemente. Antes de invocar `deleteBranchUser`, el sistema DEBE validar que `authUserId` tenga formato UUID válido; si no lo es, DEBE registrarlo en log y OMITIR la eliminación del usuario Auth sin abortar el borrado de la sucursal. Si el usuario Auth no existe, el borrado de la sucursal NO DEBE abortarse (fallo no fatal registrado en log). Los errores genuinos de transporte/API de Supabase DEBEN seguir abortando la transacción. El cambio DEBE incluir un script de backfill de una sola ejecución (sin DDL) que establezca `authUserId` a NULL en las sucursales con valores placeholder/no-UUID. (FIX-FASE4 issue 12)
(Previously: abortaba el borrado cuando authUserId no era UUID o el usuario Auth no existía, produciendo "Expected parameter to be UUID but is not")

#### Scenario: Borrado bloqueado con historial
- GIVEN una sucursal con compras o ventas asociadas
- WHEN se intenta borrar
- THEN la acción DEBE rechazar con HAS_DEPENDENT_DATA

#### Scenario: Borrado de sucursal vacía
- GIVEN una sucursal sin transacciones
- WHEN se borra
- THEN la sucursal DEBE eliminarse permanentemente

#### Scenario: authUserId no UUID no bloquea el borrado
- GIVEN una sucursal vacía con authUserId no UUID (placeholder)
- WHEN se borra la sucursal
- THEN la sucursal DEBE borrarse
- AND el skip del usuario Auth DEBE registrarse en log

#### Scenario: Usuario Auth inexistente no bloquea
- GIVEN una sucursal vacía con authUserId UUID válido pero sin usuario Auth correspondiente
- WHEN se borra la sucursal
- THEN la sucursal DEBE borrarse sin abortar

#### Scenario: Backfill de authUserId a NULL
- GIVEN sucursales con authUserId placeholder o no-UUID
- WHEN se ejecuta el script de backfill
- THEN authUserId DEBE quedar en NULL en esas sucursales
