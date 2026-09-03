# Delta for Purchase Management

## ADDED Requirements

### Requirement: Branch Association on Purchase

The `createPurchase` Server Action MUST require a `branchId` parameter. The purchase record SHALL include a branchId foreign key. Received inventory MUST be added to the specified branch's BranchInventory.

#### Scenario: Create purchase with branch
- GIVEN the user is on /compras with Branch 2 selected
- WHEN creating a purchase for Product A (qty 10)
- THEN the purchase SHALL record branchId=2
- AND BranchInventory[Product A, Branch 2] SHALL increase by 10

#### Scenario: Purchase list filtered by branch
- GIVEN purchases exist at Branch 1 and Branch 2
- WHEN viewing purchases under Branch 1 context
- THEN only purchases with branchId=1 SHALL be shown

#### Scenario: Missing branchId rejected
- GIVEN a createPurchase call without branchId
- WHEN the action validates the input
- THEN it SHALL reject with validation error