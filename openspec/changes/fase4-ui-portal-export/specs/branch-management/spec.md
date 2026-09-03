# Delta for Branch Management

## MODIFIED Requirements

### Requirement: Create Branch

The system MUST provide a Server Action to create a branch with name (required), code (required, unique), address, phone, email, and isActive (default true). Duplicate names and duplicate codes MUST be rejected. After the branch row is inserted, the action MUST provision a Supabase Auth user with `app_metadata: { role: 'branch_user', branchId }` (see `branch-user-provisioning`). If Auth user creation fails, the action MUST compensate by deleting the created branch row. The action SHALL return the branch plus one-time temporary credentials (email and password); credentials MUST NOT be persisted in the application database.
(Previously: created the branch row only, with no code field and no Auth user provisioning)

#### Scenario: Create active branch
- GIVEN valid branch data (name "Sucursal Centro", code "CEN", address, phone, email)
- WHEN calling the create branch action
- THEN a branch SHALL be created with isActive=true and code "CEN"
- AND an Auth user SHALL be created with app_metadata { role: 'branch_user', branchId }
- AND the action SHALL return the branch and one-time credentials
- AND the credentials SHALL NOT be stored in the database

#### Scenario: Duplicate name rejected
- GIVEN an existing branch named "Sucursal Centro"
- WHEN creating another branch with the same name
- THEN the action SHALL reject with DUPLICATE_NAME error

#### Scenario: Duplicate code rejected
- GIVEN an existing branch with code "CEN"
- WHEN creating another branch with code "CEN"
- THEN the action SHALL reject with DUPLICATE_CODE error

#### Scenario: Auth user creation failure compensates
- GIVEN the Auth user creation fails after the branch row was inserted
- WHEN calling the create branch action
- THEN the branch row SHALL be deleted
- AND the action SHALL return an error without credentials

### Requirement: Update Branch

The system MUST update any editable field of an existing branch, including code (unique). Deactivating a branch (isActive=false) SHALL NOT delete its historical data. Updating a branch SHALL NOT create, modify, or delete the associated Auth user.
(Previously: no code field, and no statement about Auth user behavior on update)

#### Scenario: Update branch details
- GIVEN an existing branch
- WHEN updating name and phone
- THEN the branch SHALL reflect the new values
- AND timestamps SHALL update

#### Scenario: Update code does not touch Auth user
- GIVEN an existing branch with an Auth user
- WHEN updating the branch code
- THEN the branch SHALL reflect the new code
- AND the Auth user email SHALL remain unchanged

#### Scenario: Deactivate branch preserves data
- GIVEN an existing branch with transaction history
- WHEN setting isActive=false
- THEN the branch SHALL remain in the database
- AND its historical transactions SHALL be preserved

### Requirement: Delete Branch

The system MUST NOT hard-delete a branch with transaction history. Only branches with zero transactions MAY be permanently deleted. Before deleting the branch row, the action MUST delete the associated Auth user; if Auth user deletion fails, the branch deletion SHALL abort and no row SHALL be removed.
(Previously: deleted the branch row only, with no Auth user cleanup)

#### Scenario: Delete branch with history blocked
- GIVEN a branch with associated purchases or sales
- WHEN attempting to delete
- THEN the action SHALL reject with HAS_DEPENDENT_DATA

#### Scenario: Delete empty branch succeeds
- GIVEN a branch with no transactions
- WHEN deleting
- THEN the Auth user SHALL be deleted first
- AND the branch SHALL be permanently removed

#### Scenario: Auth user deletion failure aborts
- GIVEN the Auth user deletion fails
- WHEN attempting to delete an otherwise empty branch
- THEN the branch row SHALL NOT be removed
- AND the action SHALL return an error
