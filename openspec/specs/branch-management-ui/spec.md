# Domain: branch-management-ui — Delta

## Delta

**Capability modificada** — modifica la spec base `openspec/specs/branch-management/spec.md` (requirements "Create Branch" y "Update Branch") y el componente `src/components/ui/BranchManager.tsx`. Cambios: (1) checkbox "Sucursal pública" (`isPublic`) en el formulario de crear y editar, junto al existente "Sucursal activa"; (2) badge "Pública" en el listado para sucursales con `isPublic = true`; (3) el botón "Portal" deja de apuntar a `/sucursal/<id>/login` (hoy línea 366) y apunta a `/sucursal/<id>/inventory`. La persistencia del campo está especificada en `branch-public-flag`; aquí se exige el mapeo UI → payload → action.

## Requirements

1. **Checkbox en el formulario (MUST)**: `BranchManager.tsx` SHALL incluir un checkbox con label "Sucursal pública" junto al checkbox "Sucursal activa", visible tanto en modo create como en modo edit. El estado SHALL vivir en `BranchForm` (campo `isPublic`), con `EMPTY_FORM` seteando `isPublic: false`, y `openEdit` SHALL precargarlo desde `branch.isPublic`.
2. **Payload y tipos (MUST)**: la interfaz `Branch` y el tipo `BranchForm` SHALL incluir `isPublic: boolean`; `handleSubmit` SHALL incluir `isPublic: form.isPublic` en el payload tanto para `createBranch` como para `updateBranch` (el mismo patrón que hoy usa `isActive`).
3. **Create Branch con isPublic (MUST)** — modifica el requirement base "Create Branch": el sistema SHALL permitir crear una sucursal con `isPublic` explícito; `createBranchSchema` con `isPublic: z.boolean().default(false)` y la action persistiendo el valor (detalle en `branch-public-flag`). Los demás contratos base (name requerido, `isActive` default true, rechazo de duplicados) SHALL permanecer.
4. **Update Branch con isPublic (MUST)** — modifica el requirement base "Update Branch": el sistema SHALL permitir actualizar `isPublic` de una sucursal existente; `updateBranchSchema` con `isPublic: z.boolean().optional()` y la action persistiéndolo solo cuando venga definido. Desactivar (o "despublicar") SHALL NOT eliminar datos históricos. El resto de campos editables SHALL permanecer sin cambios.
5. **Badge "Pública" en el listado (MUST)**: el listado SHALL mostrar un badge con el texto "Pública" para cada sucursal con `isPublic === true`, en la misma fila de badges existentes ("Principal" para id 1, "Inactiva" para `!isActive`), sin reemplazarlos.
6. **Botón "Portal" → inventory (MUST)**: el `Link` del botón "Portal" (hoy `href={\`/sucursal/${branch.id}/login\`}`) SHALL apuntar a `/sucursal/${branch.id}/inventory`. SHALL conservar el `aria-label` descriptivo (coherente con el nuevo destino, p. ej. "Ver portal de ${branch.name}") y los atributos táctiles (`min-h-[44px]`, `touch-manipulation`).
7. **Opt-in explícito (SHALL)**: el checkbox SHALL estar desmarcado por defecto en create; el admin SHALL ser quien decida hacer pública la sucursal.

## Scenarios

#### Scenario: Toggle isPublic persiste al crear
- GIVEN el modo create con el checkbox "Sucursal pública" marcado y el resto de campos válidos
- WHEN se envía el formulario
- THEN `createBranch` SHALL recibir `isPublic: true` en el payload
- AND la sucursal creada SHALL quedar persistida con `isPublic = true`

#### Scenario: Toggle isPublic persiste al editar
- GIVEN el modo edit de una sucursal con `isPublic = true` y el admin desmarca el checkbox
- WHEN se envía el formulario
- THEN `updateBranch` SHALL recibir `isPublic: false`
- AND la sucursal SHALL quedar persistida con `isPublic = false`

#### Scenario: Badge visible en el listado
- GIVEN una sucursal con `isPublic = true` y otra con `isPublic = false`
- WHEN se renderiza el listado
- THEN la primera SHALL mostrar el badge "Pública"
- AND la segunda SHALL NOT mostrar el badge

#### Scenario: Botón "Portal" abre el catálogo público
- GIVEN una sucursal con `isPublic = true` en el listado
- WHEN el admin pulsa el botón "Portal"
- THEN el navegador SHALL navegar a `/sucursal/<id>/inventory`
- AND el botón SHALL conservar `aria-label` descriptivo y `min-h-[44px]`/`touch-manipulation`

#### Scenario: Despublicar preserva datos
- GIVEN una sucursal con historial de transacciones e `isPublic = true`
- WHEN el admin la edita con el checkbox desmarcado
- THEN `isPublic` SHALL pasar a `false`
- AND el historial de la sucursal SHALL permanecer intacto

## Out of Scope

- **Evaluación de `isPublic` en el catálogo**: pertenece a `external-branch-catalog`.
- **Schema y migración** (`Branch.isPublic`, zod, actions): pertenece a `branch-public-flag`.
- **Eliminación del login del portal**: pertenece al delta removed `branch-portal-login`.
- **Estilos de color del badge**: solo se exige el label "Pública" (STYLE.md aplica en design).
- **Provisioning de usuarios de sucursal**: intacto.