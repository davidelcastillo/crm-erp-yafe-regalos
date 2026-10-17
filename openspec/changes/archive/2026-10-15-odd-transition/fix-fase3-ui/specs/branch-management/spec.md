# Delta for Branch Management

> Decisions locked from the open questions:
> - Q3: The Sucursales nav link lives in a "Más" overflow menu (BottomNav keeps 6 primary items).
> - Q4: SweetAlert2 branch-delete confirmation is included in this change.

## ADDED Requirements

### Requirement: BottomNav Más Overflow Menu

The `BottomNav` MUST keep the 6 primary items and add a "Más" item that opens an overflow menu (bottom sheet anchored above the nav bar) listing secondary destinations. "Sucursales" SHALL be an entry in that menu linking to `/sucursales`. The "Más" item SHALL be highlighted as active when the pathname starts with `/sucursales` (or any other secondary route). The menu SHALL close on outside tap and on route change.

#### Scenario: Open the Más menu

- GIVEN the BottomNav renders
- WHEN the user taps "Más"
- THEN an overflow menu SHALL open above the nav bar
- AND it SHALL list "Sucursales" among the secondary items

#### Scenario: Más active on /sucursales

- GIVEN the user is on `/sucursales`
- WHEN the BottomNav renders
- THEN the "Más" item SHALL show the active color (`#ff385c`)
- AND "Sucursales" SHALL be highlighted inside the menu

#### Scenario: Navigate to sucursales from the menu

- GIVEN the Más menu is open
- WHEN the user taps "Sucursales"
- THEN the app SHALL navigate to `/sucursales`
- AND the menu SHALL close

#### Scenario: Menu closes on outside tap

- GIVEN the Más menu is open
- WHEN the user taps outside the menu
- THEN the menu SHALL close without navigating

### Requirement: SweetAlert2 Branch Delete Confirmation

The `BranchManager` SHALL replace the inline confirmation buttons with a SweetAlert2 confirmation dialog before calling `deleteBranch`. The dialog SHALL show the branch name and a warning, with a destructive red "Eliminar" confirm button and a cancel button. Errors from the action (`HAS_DEPENDENT_DATA`, `HAS_STOCK`, default branch) SHALL be displayed in a SweetAlert2 error dialog. On success the list SHALL update without a full page reload.

#### Scenario: Delete confirmation dialog

- GIVEN an admin taps the delete icon on a branch
- WHEN the SweetAlert2 dialog opens
- THEN it SHALL display "¿Eliminar sucursal {name}?"
- AND a red "Eliminar" button SHALL confirm
- AND a "Cancelar" button SHALL dismiss

#### Scenario: Cancel does nothing

- GIVEN the confirmation dialog is open
- WHEN the user cancels
- THEN no Server Action SHALL be called
- AND the branch SHALL remain in the list

#### Scenario: Confirm delete of an empty branch

- GIVEN a branch with no transactions and zero BranchInventory stock
- WHEN the user confirms
- THEN `deleteBranch` SHALL succeed
- AND the list SHALL update optimistically without a full page reload

#### Scenario: Dependent data error

- GIVEN a branch with associated transactions
- WHEN the user confirms
- THEN `deleteBranch` SHALL reject with HAS_DEPENDENT_DATA
- AND SweetAlert2 SHALL display "No se puede eliminar una sucursal con transacciones asociadas"

#### Scenario: Stock error

- GIVEN a branch with BranchInventory stock > 0 and no transactions
- WHEN the user confirms
- THEN `deleteBranch` SHALL reject with HAS_STOCK
- AND SweetAlert2 SHALL display "La sucursal tiene stock asignado. Mové el stock antes de eliminarla."

#### Scenario: Default branch protected

- GIVEN the branch id=1 (Principal)
- WHEN the admin attempts to delete it
- THEN no delete control SHALL be rendered for it
- AND `deleteBranch` SHALL reject if invoked directly

### Requirement: Branch Delete Non-Functional Requirements

- Branch deletion MUST NOT be destructive without explicit SweetAlert2 confirmation.
- The delete flow SHALL NOT require a full page reload on success (optimistic list update).
- The delete action SHALL enforce both dependency and stock guards in a single pass, rejecting with stable error codes.

## MODIFIED Requirements

### Requirement: Delete Branch

The system MUST NOT hard-delete a branch with transaction history OR with BranchInventory stock > 0. Only branches with zero transactions and zero BranchInventory stock MAY be permanently deleted. Deletion SHALL be preceded by a SweetAlert2 confirmation dialog showing the branch name and a "¿Estás seguro?" message with cancel and confirm buttons; the action SHALL reject with HAS_DEPENDENT_DATA or HAS_STOCK respectively. Branch id=1 (Principal) SHALL be undeletable.
(Previously: hard-delete blocked only for branches with transactions, using inline confirmation buttons; no stock guard)

#### Scenario: Delete branch with history blocked

- GIVEN a branch with associated purchases or sales
- WHEN the admin confirms deletion via SweetAlert2
- THEN the action SHALL reject with HAS_DEPENDENT_DATA
- AND SweetAlert2 SHALL display the error message

#### Scenario: Delete branch with stock blocked

- GIVEN a branch with BranchInventory stock > 0 but no transactions
- WHEN the admin confirms deletion via SweetAlert2
- THEN the action SHALL reject with HAS_STOCK
- AND SweetAlert2 SHALL display "La sucursal tiene stock asignado. Mové el stock antes de eliminarla."

#### Scenario: Delete empty branch succeeds

- GIVEN a branch with no transactions and zero BranchInventory stock
- WHEN the admin confirms deletion via SweetAlert2
- THEN the branch SHALL be permanently removed
- AND the list SHALL update optimistically without a full page reload

### Requirement: Read Branches

The system MUST list all branches with pagination and filter by active/inactive status. A detail view SHALL return a single branch by id. The list view SHALL render each branch with name, phone, email, and active status, plus Create, Edit, and Delete actions, and SHALL be reachable from the BottomNav "Más" menu.

#### Scenario: List active branches

- GIVEN 3 branches (2 active, 1 inactive)
- WHEN listing with filter active=true
- THEN exactly 2 branches SHALL be returned

#### Scenario: Get branch by id

- GIVEN a branch with id=5
- WHEN fetching by id
- THEN the branch SHALL be returned with all fields

#### Scenario: Render branch list with actions

- GIVEN an admin user on `/sucursales`
- WHEN the page loads
- THEN a card list SHALL display all branches with name, phone, email, and active status
- AND each row SHALL include Create, Edit, and Delete controls
- AND the BottomNav "Más" item SHALL be highlighted

## UI/UX Details

- Más menu: white bottom sheet anchored above the BottomNav, `rounded-t-3xl`, slide-up animation; entries use icon + label with ≥ 44px touch targets.
- Active color `#ff385c`; inactive secondary text `#6a6a6a`.
- SweetAlert2 delete dialog: `icon: "warning"`, red destructive confirm button (e.g., `confirmButtonColor: "#dc2626"`), `background: "#ffffff"`, `color: "#222222"`.
- User-facing strings in Spanish (app language): "Más", "Sucursales", "¿Eliminar sucursal {name}?", "Eliminar", "Cancelar".

## Acceptance Criteria

- [ ] BottomNav shows "Más"; Sucursales is reachable from the overflow menu and navigates to `/sucursales`.
- [ ] "Más" is highlighted while on `/sucursales`.
- [ ] Delete always asks for SweetAlert2 confirmation; cancelling performs no action.
- [ ] `deleteBranch` rejects with HAS_STOCK for stocked branches and HAS_DEPENDENT_DATA for transactional branches; both surfaced via SweetAlert2.
- [ ] Successful delete updates the list without a full page reload.
- [ ] Branch id=1 has no delete control and is rejected server-side.
- [ ] Unit tests cover the delete guards and the Más-menu active state; zero regressions.
