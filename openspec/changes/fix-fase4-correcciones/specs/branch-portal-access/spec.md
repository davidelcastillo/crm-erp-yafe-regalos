# Branch Portal Access Specification

## Purpose

Provide a dedicated external login and access flow for the branch portal (`/sucursal/[branchId]`) so branch users sign in without mixing with the central admin login and reach their branch inventory (GET-only) securely. (FIX-FASE4 issues 13-15)

## Requirements

### Requirement: Ruta de Login Dedicada del Portal

El sistema DEBE renderizar `/sucursal/[branchId]/login` como una página accesible sin autenticación previa (excluida del proxy), separada del login central `/login`. La Server Action `loginBranch` DEBE verificar que la sesión autenticada corresponda a la sucursal del URL (branch claim) antes de redirigir a `/sucursal/[branchId]/inventory`; si no coincide, DEBE mostrar un error en el login del portal sin redirigir al inventario. (FIX-FASE4 issue 14)

#### Scenario: Login exitoso del portal
- GIVEN credenciales válidas del usuario de la sucursal 210
- WHEN el usuario envía el login en /sucursal/210/login
- THEN el sistema DEBE redirigir a /sucursal/210/inventory

#### Scenario: Sucursal del URL no coincide con la sesión
- GIVEN una sesión branch_user de la sucursal 200
- WHEN se envía el login en /sucursal/210/login
- THEN el sistema NO DEBE redirigir al inventario
- AND DEBE mostrar un error en el login del portal

### Requirement: Redirección por Rol tras el Login Central

La acción `login` DEBE redirigir según el rol del usuario autenticado: si `role === 'branch_user'`, DEBE redirigir a `/sucursal/{app_metadata.branchId}/inventory`; si es admin, a `/dashboard`. (FIX-FASE4 issue 14)

#### Scenario: branch_user llega a su portal
- GIVEN un branch_user con app_metadata.branchId=210
- WHEN se autentica desde /login central
- THEN el sistema DEBE redirigir a /sucursal/210/inventory

### Requirement: Exclusión de Proxy Acotada

El proxy DEBE permitir acceso pre-auth SOLO a `/login` y `/sucursal/*/login`. La ruta `/sucursal/[branchId]/inventory` DEBE permanecer protegida: solo verbo GET y rol `branch_user` (middleware de sucursal). (FIX-FASE4 issue 14)

#### Scenario: Login del portal accesible sin sesión
- GIVEN un usuario no autenticado
- WHEN accede a /sucursal/210/login
- THEN el proxy DEBE permitir la solicitud sin redirigir al login central

#### Scenario: Inventario del portal protegido
- GIVEN un usuario no autenticado o sin rol branch_user
- WHEN intenta acceder a /sucursal/210/inventory
- THEN el sistema DEBE rechazar la solicitud (solo GET + branch_user)

### Requirement: Desenvolvimiento de Params Asíncronos

Las páginas del portal (`/sucursal/[branchId]/login` y `/sucursal/[branchId]/inventory`) DEBEN tipar `params` como `Promise<{ branchId: string }>` y desenvolverlo con `await` antes de usarlo. (FIX-FASE4 issue 15)

#### Scenario: Inventory page desenvuelve params
- GIVEN Next 16 con params como Promise
- WHEN BranchInventoryPage renderiza
- THEN branchId DEBE obtenerse con await params
- AND la página DEBE cargar el inventario sin el error "params is a Promise"
