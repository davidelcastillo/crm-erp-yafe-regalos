# Location-Based Transactions Specification

## Purpose

Associate every purchase and sale with a specific branch, ensuring inventory is correctly tracked per location and that branch context is carried through all financial and inventory operations.

## Requirements

### Requirement: Branch Context in UI

The system MUST provide a `BranchSelector` component and a React context (`BranchContext`) that maintains the user's selected branch across the session. Forms for purchases and sales MUST include the branch selector.

#### Scenario: BranchSelector available
- GIVEN a user on /ventas or /compras
- WHEN the form renders
- THEN a BranchSelector SHALL be visible
- AND it SHALL list only active branches

#### Scenario: Branch persists across session
- GIVEN a user selects Branch 2
- WHEN navigating from /ventas to /compras
- THEN the selected branch SHALL still be Branch 2

### Requirement: Branch in Purchase Creation

The `createPurchase` Server Action MUST accept a required `branchId` parameter. Received inventory MUST be added to the specified branch's stock.

#### Scenario: Purchase adds to branch stock
- GIVEN a purchase for Product A (qty 10) at Branch 1
- WHEN creating the purchase
- THEN BranchInventory for Product A at Branch 1 SHALL increase by 10
- AND other branches' stock SHALL be unaffected

### Requirement: Branch in Sale Creation

The `createSale` Server Action MUST accept a required `branchId` parameter. Inventory MUST be deducted from the specified branch's stock.

#### Scenario: Sale deducts from branch stock
- GIVEN Product A has stock 10 at Branch 1
- WHEN creating a sale for 3 units at Branch 1
- THEN BranchInventory for Product A at Branch 1 SHALL decrease to 7