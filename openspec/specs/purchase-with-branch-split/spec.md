# Purchase with Branch Split Specification

## Purpose

Enable purchases with stock distribution across multiple branches. Each purchase line item can be split into quantities targeting different branches, with validation ensuring totals are consistent and each branch receives positive stock.

## Requirements

### Requirement: PurchaseForm Component

The system MUST provide a `PurchaseForm` Client Component that renders a form with: product selector (reusing `searchProducts`), branch split grid showing each selected branch with a quantity input, total quantity summary, and submit button. The form SHALL validate that split quantities sum ≥ total purchase quantity.

#### Scenario: Render purchase form with branch split
- GIVEN the purchase form modal is open for Product A (total qty 10)
- WHEN Branch 1 and Branch 2 are selected
- THEN quantity inputs for both branches SHALL display
- AND a running total SHALL show the sum of split quantities

#### Scenario: Split sum validated client-side
- GIVEN split quantities of 6 and 6 (total 12)
- WHEN the total exceeds the purchase quantity of 10
- THEN the submit button SHALL show an error "La suma supera el total"

### Requirement: createPurchaseWithBranchSplit Server Action

The `createPurchaseWithBranchSplit` Server Action SHALL accept a purchase header (supplierId, date, paymentMethod) and an array of `{productId, branchId, quantity, price}` entries. Each entry SHALL validate: branch must exist and be active, product must exist and be active, quantity ≥ 1. The operation SHALL execute in a Prisma transaction.

#### Scenario: Successful split purchase
- GIVEN a purchase of Product A (qty 10, price $100) split into Branch 1 (qty 6) and Branch 2 (qty 4)
- WHEN calling createPurchaseWithBranchSplit
- THEN a Purchase record SHALL be created
- AND PurchaseItem records SHALL be created for each split
- AND BranchProduct for Branch 1 SHALL increase by 6
- AND BranchProduct for Branch 2 SHALL increase by 4
- AND Product.stock SHALL increase by 10

#### Scenario: Inactive product rejected
- GIVEN a purchase including an inactive product
- WHEN calling createPurchaseWithBranchSplit
- THEN the action SHALL reject with PRODUCT_INACTIVE

#### Scenario: Invalid branch rejected
- GIVEN a purchase with a non-existent branchId
- WHEN calling createPurchaseWithBranchSplit
- THEN the action SHALL reject with BRANCH_NOT_FOUND