# Delta for Location-Based Transactions

## ADDED Requirements

### Requirement: Purchase with Branch Split

The system MUST provide `createPurchaseWithBranchSplit` Server Action that accepts an array of `{productId, branchId, quantity, price}` entries. Each entry SHALL be validated: quantity ≥ 1, sum of split quantities ≤ product's total purchase quantity, each branch stock updated independently. The operation SHALL execute in a Prisma transaction.

#### Scenario: Split purchase across branches
- GIVEN a purchase of Product A (total qty 10) and two branches (Branch 1, Branch 2)
- WHEN calling createPurchaseWithBranchSplit with [{ branchId: 1, qty: 6 }, { branchId: 2, qty: 4 }]
- THEN Product A stock at Branch 1 SHALL increase by 6
- AND Product A stock at Branch 2 SHALL increase by 4
- AND Product.stock SHALL increase by 10

#### Scenario: Split sum exceeds total rejected
- GIVEN a purchase of Product A (total qty 10)
- WHEN calling createPurchaseWithBranchSplit with splits totaling 12
- THEN the action SHALL reject with SPLIT_EXCEEDS_TOTAL

### Requirement: Sale with Branch

The system MUST provide `createSaleWithBranch` Server Action that requires a `branchId` and validates stock availability at that specific branch. The operation SHALL execute in a Prisma transaction. `PaymentMethod` SHALL accept only `EFECTIVO`, `TRANSFERENCIA`, or `MIXTO`.

#### Scenario: Sale deducts from branch stock
- GIVEN Product A has stock 10 at Branch 1
- WHEN creating a sale for 3 units at Branch 1
- THEN BranchProduct for Product A at Branch 1 SHALL decrease to 7
- AND Product.stock SHALL decrease to 7

#### Scenario: Sale with insufficient branch stock rejected
- GIVEN Product A has stock 2 at Branch 1 and 10 at Branch 2
- WHEN creating a sale for 5 units at Branch 1
- THEN the action SHALL reject with INSUFFICIENT_BRANCH_STOCK

## MODIFIED Requirements

### Requirement: Branch in Purchase Creation

The `createPurchase` Server Action MUST be replaced with `createPurchaseWithBranchSplit`. The new action accepts a required array of branch splits instead of a single `branchId`.
(Previously: single branchId, single quantity)

#### Scenario: Purchase adds to branch stock
- GIVEN a purchase for Product A (qty 10) with split [{ branchId: 1, qty: 10 }]
- WHEN calling createPurchaseWithBranchSplit
- THEN BranchProduct for Product A at Branch 1 SHALL increase by 10
- AND other branches' stock SHALL be unaffected

### Requirement: Branch in Sale Creation

The `createSale` Server Action MUST be replaced with `createSaleWithBranch`. The required `branchId` parameter SHALL validate stock at the specified branch before proceeding.
(Previously: accepted branchId but stock validation was at product level)

#### Scenario: Sale deducts from branch stock
- GIVEN Product A has stock 10 at Branch 1
- WHEN creating a sale for 3 units at Branch 1
- THEN BranchProduct for Product A at Branch 1 SHALL decrease to 7

## REMOVED Requirements

### Requirement: Branch Context in UI — BranchContext

(Reason: Replaced by explicit `BranchSelector` components in each modal (PurchaseForm, SaleForm). Session-wide BranchContext is unnecessary because branch selection varies per transaction.)
(Migration: Forms now use per-invocation branch selection. Remove BranchContext provider.)

#### Scenario: BranchSelector available
- GIVEN a user on /ventas or /compras
- WHEN the form renders
- THEN a BranchSelector SHALL be visible
- AND it SHALL list only active branches