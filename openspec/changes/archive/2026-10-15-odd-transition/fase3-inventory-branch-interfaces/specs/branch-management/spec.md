# Delta for Branch Management

## ADDED Requirements

### Requirement: Branch CRUD UI

The system MUST render admin-only pages for listing, creating, editing, and deleting branches. The list page SHALL show a table with name, phone, active status, and action buttons. Delete SHALL use SweetAlert2 confirmation.

#### Scenario: Render branch list
- GIVEN an admin user on `/branches`
- WHEN the page loads
- THEN a table SHALL display all branches with name, phone, email, and active status
- AND SHALL include Create, Edit, and Delete buttons per row

#### Scenario: Create branch from UI
- GIVEN an admin user on the create branch form
- WHEN submitting valid data
- THEN the branch SHALL be persisted
- AND the user SHALL be redirected to the branch list with a success message

#### Scenario: Delete confirmed via SweetAlert2
- GIVEN an admin user clicks Delete on an existing branch
- WHEN SweetAlert2 confirmation is accepted
- THEN the branch SHALL be deleted (if no dependent data)
- AND the list SHALL update

### Requirement: Assign Stock to Branch

The system MUST provide an `assignStockToBranch` Server Action that adds stock to a specific branch's `BranchProduct`. The operation SHALL execute in a Prisma transaction, validate that the new sum of `BranchProduct.stock` across all branches ≤ `Product.stock`, and that each `BranchProduct.stock` ≥ 0.

#### Scenario: Assign stock to branch
- GIVEN Product A has stock 20 and Branch X has BranchProduct stock 0
- WHEN calling `assignStockToBranch(productId, branchId, 15)`
- THEN BranchProduct for Branch X SHALL have stock 15
- AND total `Product.stock` SHALL remain 20

#### Scenario: Assign exceeding total stock rejected
- GIVEN Product A has stock 10, with 8 already assigned to Branch Y
- WHEN calling `assignStockToBranch(productId, branchId, 5)` (would total 13 > 10)
- THEN the action SHALL reject with EXCEEDS_TOTAL_STOCK

## MODIFIED Requirements

### Requirement: Delete Branch

The system MUST NOT hard-delete a branch with transaction history (purchases, sales, or stock movements). Only branches with zero transactions and zero BranchProduct stock MAY be permanently deleted. Delete SHALL trigger a SweetAlert2 confirmation dialog.
(Previously: only transaction history check, no BranchProduct or SweetAlert2)

#### Scenario: Delete branch with history blocked
- GIVEN a branch with associated purchases, sales, or stock movements
- WHEN attempting to delete
- THEN the action SHALL reject with HAS_DEPENDENT_DATA

#### Scenario: Delete branch with stock blocked
- GIVEN a branch with BranchProduct stock > 0 but no transactions
- WHEN attempting to delete
- THEN the action SHALL reject with HAS_STOCK

#### Scenario: Delete empty branch succeeds
- GIVEN a branch with no transactions and zero BranchProduct stock
- WHEN deleting with SweetAlert2 confirmation
- THEN the branch SHALL be permanently removed