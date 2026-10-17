# Delta for Branch Management

## ADDED Requirements

### Requirement: Hidratación de Opciones de Sucursal (Self-Heal)

The `BranchProvider` MUST re-sync `branches` when the `initialBranches` prop becomes non-empty after mount, and MUST fetch a fallback via `refreshBranches()` (which calls `getBranchOptions`) when the list is empty after mount. The re-sync MUST NOT clobber a manual `refreshBranches()` result, MUST NOT trigger extra DB calls on every navigation, and MUST preserve the route-group reset of the selected branch.

**Traza**: Item 1.

#### Scenario: Hydration after login without reload

- GIVEN the provider mounted pre-auth with `initialBranches = []` and the user then logs in
- WHEN the root layout re-renders with a non-empty `initialBranches`
- THEN `branches` SHALL update to the new list immediately
- AND the branch selector SHALL show the branches without a full page reload

#### Scenario: Fallback fetch when empty after mount

- GIVEN the provider is mounted with an empty `initialBranches`
- WHEN the mount guard runs and `branches` is still empty
- THEN the provider SHALL call `getBranchOptions` once
- AND on success SHALL set `branches` to the fetched options

#### Scenario: No extra DB calls per navigation

- GIVEN `branches` is already populated
- WHEN the user navigates between internal pages (e.g. /ventas → /compras)
- THEN the provider SHALL NOT re-fetch `getBranchOptions`
- AND the route-group reset SHALL still clear the selected branch

#### Scenario: Manual refresh wins

- GIVEN the user or a form calls `refreshBranches()`
- WHEN the provider later receives a stale `initialBranches` prop
- THEN the manual refresh result SHALL NOT be overwritten
