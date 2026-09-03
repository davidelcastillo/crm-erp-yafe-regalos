# Branch Management Specification

## Purpose

Enable CRUD management of business branches (sucursales) with name, address, phone, email, and active status. Each branch serves as a distinct operational location for inventory and transactions.

## Requirements

### Requirement: Create Branch

The system MUST provide a Server Action to create a branch with name (required), address, phone, email, and isActive (default true). Duplicate names MUST be rejected.

#### Scenario: Create active branch
- GIVEN valid branch data (name "Sucursal Centro", address, phone, email)
- WHEN calling the create branch action
- THEN a branch SHALL be created with isActive=true
- AND the action SHALL return the created branch with an id and timestamps

#### Scenario: Duplicate name rejected
- GIVEN an existing branch named "Sucursal Centro"
- WHEN creating another branch with the same name
- THEN the action SHALL reject with DUPLICATE_NAME error

### Requirement: Read Branches

The system MUST list all branches with pagination and filter by active/inactive status. A detail view SHALL return a single branch by id.

#### Scenario: List active branches
- GIVEN 3 branches (2 active, 1 inactive)
- WHEN listing with filter active=true
- THEN exactly 2 branches SHALL be returned

#### Scenario: Get branch by id
- GIVEN a branch with id=5
- WHEN fetching by id
- THEN the branch SHALL be returned with all fields

### Requirement: Update Branch

The system MUST update any editable field of an existing branch. Deactivating a branch (isActive=false) SHALL NOT delete its historical data.

#### Scenario: Update branch details
- GIVEN an existing branch
- WHEN updating name and phone
- THEN the branch SHALL reflect the new values
- AND timestamps SHALL update

#### Scenario: Deactivate branch preserves data
- GIVEN an existing branch with transaction history
- WHEN setting isActive=false
- THEN the branch SHALL remain in the database
- AND its historical transactions SHALL be preserved

### Requirement: Delete Branch

The system MUST NOT hard-delete a branch with transaction history. Only branches with zero transactions MAY be permanently deleted.

#### Scenario: Delete branch with history blocked
- GIVEN a branch with associated purchases or sales
- WHEN attempting to delete
- THEN the action SHALL reject with HAS_DEPENDENT_DATA

#### Scenario: Delete empty branch succeeds
- GIVEN a branch with no transactions
- WHEN deleting
- THEN the branch SHALL be permanently removed