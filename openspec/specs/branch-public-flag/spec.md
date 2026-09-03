# Domain: branch-public-flag — Delta

## Delta

**Nueva capability** — no existe spec base en `openspec/specs/branch-public-flag/spec.md`. Introduce el flag de visibilidad pública por sucursal: `Branch.isPublic Boolean @default(false)` en `prisma/schema.prisma`, con **opt-in explícito** (ninguna sucursal queda pública por defecto; las filas existentes reciben `false`). El flag se persiste vía `createBranch`/`updateBranch` (schemas zod con `isPublic`) y se expone en la UI de `BranchManager` (ver delta `branch-management-ui`). Es el insumo de autorización del catálogo público (ver delta `external-branch-catalog`).

## Requirements

1. **Campo de schema (MUST)**: el sistema SHALL agregar `isPublic Boolean @default(false)` al modelo `Branch` en `prisma/schema.prisma`. El default SHALL ser `false` para que ninguna sucursal existente o nueva quede pública sin decisión explícita.
2. **Migración dev y prod (MUST)**: el sistema SHALL generar la migración con `npx prisma migrate dev --name branch_is_public` (aplica a dev) y SHALL aplicarla a la BD de producción siguiendo el proceso de la memoria #100 (`apply_migration` por partes, con el `project_ref` correcto). Post-migración el sistema SHALL verificar: (a) columna presente en `Branch`, (b) filas existentes con `isPublic = false`, (c) sin pérdida de datos.
3. **Persistencia en create (MUST)**: `createBranchSchema` SHALL incluir `isPublic: z.boolean().default(false)`; la action `createBranch` SHALL persistir `validatedData.isPublic` en el `tx.branch.create` dentro de la transacción existente (sin romper el provisioning de `createBranchUser`).
4. **Persistencia en update (MUST)**: `updateBranchSchema` SHALL incluir `isPublic: z.boolean().optional()`; la action `updateBranch` SHALL persistir `isPublic` en el `prisma.branch.update` solo cuando el campo venga definido (patrón idéntico a `isActive`), sin tocar `authUserId`.
5. **Opt-in explícito (MUST NOT)**: el sistema SHALL NOT marcar sucursales como públicas de forma automática — ni el default de schema, ni el default de zod, ni una migración de datos SHALL setear `isPublic = true` sin intervención del admin.
6. **Rollback (SHOULD)**: el cambio de schema SHALL ser reversible con `DROP COLUMN Branch.isPublic` (SQL inverso de la migración) en dev y prod, sin pérdida de datos (columna nueva con default).

## Scenarios

#### Scenario: Toggle isPublic persiste al crear
- GIVEN un admin crea una sucursal con el checkbox "Sucursal pública" marcado
- WHEN `createBranch` valida el payload con `createBranchSchema` y ejecuta la transacción
- THEN la Branch SHALL persistirse con `isPublic = true`
- AND el retorno SHALL incluir la branch con `isPublic: true`

#### Scenario: Crear sin marcar queda no pública
- GIVEN un admin crea una sucursal sin tocar el checkbox "Sucursal pública"
- WHEN `createBranchSchema` aplica el default
- THEN la Branch SHALL persistirse con `isPublic = false`

#### Scenario: Toggle isPublic persiste al editar
- GIVEN una sucursal existente con `isPublic = true` y el admin la edita desmarcando el checkbox
- WHEN `updateBranch` recibe `isPublic: false`
- THEN la Branch SHALL quedar con `isPublic = false`
- AND `authUserId` y el resto de campos no enviados SHALL permanecer intactos

#### Scenario: Migración sin pérdida
- GIVEN la BD dev/prod con filas existentes en `Branch`
- WHEN se aplica la migración `branch_is_public`
- THEN la columna `isPublic` SHALL existir con `false` en todas las filas previas
- AND ningún dato pre-existente SHALL perderse

#### Scenario: Rollback de la migración
- GIVEN la migración aplicada en dev y prod
- WHEN se revierte con `DROP COLUMN Branch.isPublic`
- THEN las filas y el resto de columnas de `Branch` SHALL permanecer sin pérdida

## Out of Scope

- **Evaluación del flag en la action del catálogo**: pertenece a `external-branch-catalog`.
- **UI del toggle, badge y botón "Portal"**: pertenece a `branch-management-ui`.
- **Provisioning de usuarios de sucursal** (`createBranchUser` en `src/lib/utils/supabaseAuth.ts`): intacto, aunque el rol `branch_user` deje de autorizar el portal.
- **RLS en Supabase**: pendiente de seguridad independiente.