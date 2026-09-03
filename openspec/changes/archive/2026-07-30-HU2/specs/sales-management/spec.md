# Delta for Sales Management

## ADDED Requirements

### Requirement: Branch Association on Sale

The `createSale` Server Action MUST require a `branchId` parameter. The sale record SHALL include a branchId foreign key. Inventory MUST be deducted from the specified branch's BranchInventory.

#### Scenario: Create sale with branch
- GIVEN Product A has stock 10 at Branch 1
- WHEN creating a sale for 3 units at Branch 1
- THEN the sale SHALL record branchId=1
- AND BranchInventory[Product A, Branch 1] SHALL decrease to 7

#### Scenario: Sale list filtered by branch
- GIVEN sales exist at Branch 1 and Branch 2
- WHEN viewing sales under Branch 2 context
- THEN only sales with branchId=2 SHALL be shown

#### Scenario: Insufficient stock at branch rejected
- GIVEN Product A has stock 1 at Branch 1
- WHEN attempting to create a sale for 5 units at Branch 1
- THEN the action SHALL fail with INSUFFICIENT_STOCK
- AND the sale SHALL NOT be created