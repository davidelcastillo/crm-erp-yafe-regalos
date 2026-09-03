# Domain: branch-portal-login — Delta (Removed)

## Delta

**Capability eliminada** — el login del portal externo de sucursales deja de existir porque el portal pasa a ser público condicionado (`external-branch-catalog`). Se eliminan: `src/actions/auth.branch.ts` (`loginBranch`), `src/actions/auth.branch.test.ts`, `src/app/sucursal/[branchId]/login/page.tsx`, `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx`, `src/lib/supabase/branch.ts` (contiene `isPortalLoginPath` + la `decideBranchAccess` async muerta + `getBranchIdFromPath` sin uso) y `src/lib/supabase/branch.test.ts`. El rol `branch_user` deja de ser modelo de autorización del portal. **Consecuencia en specs**: el delta de restyle `openspec/specs/branch-portal-login-ui/spec.md` queda obsoleto (sus archivos objetivo se eliminan) y SHALL tratarse en archive (marcar obsoleto o eliminar). Verificación: la ruta devuelve 404 y el grep de símbolos eliminados no arroja referencias.

## Requirements

1. **Eliminación de archivos (MUST)**: el sistema SHALL eliminar los 6 archivos: `src/actions/auth.branch.ts`, `src/actions/auth.branch.test.ts`, `src/app/sucursal/[branchId]/login/page.tsx`, `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx`, `src/lib/supabase/branch.ts` y `src/lib/supabase/branch.test.ts`.
2. **Ruta 404 (MUST)**: un GET a `/sucursal/<id>/login` SHALL devolver 404 (la página ya no existe); el proxy SHALL NOT tratarla como excluida ni como ruta especial (se elimina `isPortalLoginPath` del flujo — ver delta `app-middleware`).
3. **Grep sin referencias (MUST)**: el sistema SHALL verificar por grep que `loginBranch`, `isPortalLoginPath` y `PortalLoginForm` no tengan referencias restantes en `src/` tras aplicar los tracks B/D/F (las únicas referencias actuales — `proxy.ts`, `proxy.test.ts`, `auth.branch.*`, `lib/supabase/branch.*`, páginas del login — están todas dentro del scope de eliminación).
4. **`proxy.test.ts` sin `requireActual` (MUST)**: `src/proxy.test.ts` SHALL eliminar el mock de `@/lib/supabase/branch` (líneas 28-31, usa `jest.requireActual` de `isPortalLoginPath` — se rompería al borrar el módulo) y SHALL eliminar `getUserBranchId` del mock de `@/lib/supabase/auth` si el proxy deja de usarlo (ver delta `app-middleware`).
5. **Código muerto del módulo eliminado (MUST)**: la `decideBranchAccess` async de `src/lib/supabase/branch.ts` (nadie la llama — la función pura viva es `src/middleware/branch.ts`) y `getBranchIdFromPath` (sin uso) SHALL desaparecer junto con el módulo.

## Scenarios

#### Scenario: Login del portal devuelve 404
- GIVEN un usuario (anónimo o autenticado) navega a `/sucursal/5/login`
- WHEN se solicita la ruta
- THEN el sistema SHALL devolver 404 (página inexistente, sin formulario, sin redirect)

#### Scenario: Grep sin `loginBranch`
- GIVEN el change aplicado (tracks B/D/F)
- WHEN se ejecuta grep por `loginBranch` en `src/`
- THEN no hay coincidencias (el símbolo y su action han sido eliminados)

#### Scenario: Grep sin `isPortalLoginPath`
- GIVEN el change aplicado
- WHEN se ejecuta grep por `isPortalLoginPath` en `src/`
- THEN no hay coincidencias (eliminado de `proxy.ts` y del módulo borrado)

#### Scenario: Grep sin `PortalLoginForm`
- GIVEN el change aplicado
- WHEN se ejecuta grep por `PortalLoginForm` en `src/`
- THEN no hay coincidencias (form y página eliminados)

#### Scenario: `proxy.test.ts` compila sin el módulo eliminado
- GIVEN el mock de `@/lib/supabase/branch` removido de `src/proxy.test.ts`
- WHEN se ejecuta `npm test`
- THEN los tests del proxy pasan sin importar `isPortalLoginPath`
- AND `npx tsc --noEmit` SHALL pasar sin referencias a los módulos eliminados

#### Scenario: Spec de restyle obsoleta
- GIVEN `openspec/specs/branch-portal-login-ui/spec.md` describe el restyle de `PortalLoginForm`
- WHEN el change se archiva
- THEN esa spec SHALL marcarse obsoleta o eliminarse (sus archivos objetivo ya no existen)

## Out of Scope

- **Login central admin** (`/login`, `src/actions/auth.ts`): intacto; el manejo residual de `branch_user` en su redirect se conserva como deuda no bloqueante.
- **Provisioning de usuarios de sucursal** (`createBranchUser`): intacto (aunque `branch_user` deje de autorizar el portal).
- **Limpieza de `isAuthorizedForBranch`/`getUserBranchId` en `src/lib/supabase/auth.ts`**: deuda documentada, fuera de alcance.
- **Migración o borrado de datos** de `Branch.authUserId`: no se toca (los datos persisten; solo muere el flujo de login).