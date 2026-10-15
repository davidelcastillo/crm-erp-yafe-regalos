# Delta for Multi-Location Inventory

## ADDED Requirements

### Requirement: getProductsWithBranchStock

The system MUST provide `getProductsWithBranchStock(filters)` that returns products with their stock per branch. It SHALL accept optional `branchId` and `categoryId` filters. Inactive products (active=false) SHALL be excluded by default.

#### Scenario: Filter by branch
- GIVEN Product A has stock 10 at Branch 1 and 5 at Branch 2
- WHEN calling getProductsWithBranchStock({ branchId: 1 })
- THEN Product A SHALL show stock=10
- AND Branch 2 data SHALL NOT appear

#### Scenario: Filter by category
- GIVEN products in categories "Electronics" and "Food"
- WHEN calling getProductsWithBranchStock({ categoryId: 1 })
- THEN only products with categoryId=1 SHALL return

#### Scenario: Excludes inactive products
- GIVEN Product A is active and Product B is inactive
- WHEN calling getProductsWithBranchStock({})
- THEN only Product A SHALL be included

### Requirement: Move Stock Between Branches

The system MUST provide `moveStockBetweenBranches(productId, fromBranchId, toBranchId, quantity)` that transfers stock atomically. It SHALL execute in a Prisma transaction, validate origin stock ≥ quantity, destination stock + quantity ≥ 0, and the invariant Σ BranchProduct.stock = Product.stock.

#### Scenario: Successful transfer
- GIVEN Product A has stock 10 at Branch 1 and 0 at Branch 2
- WHEN calling moveStockBetweenBranches(A, 1, 2, 3)
- THEN Branch 1 stock SHALL be 7
- AND Branch 2 stock SHALL be 3
- AND total Product.stock SHALL remain unchanged

#### Scenario: Insufficient origin stock rejected
- GIVEN Product A has stock 2 at Branch 1
- WHEN calling moveStockBetweenBranches(A, 1, 2, 5)
- THEN the action SHALL reject with INSUFFICIENT_STOCK

### Requirement: Get Branch Movements

The system MUST provide `getBranchMovements(filters)` returning `BranchMovement` records with optional filters: date range, fromBranch, toBranch, productId, movementType. Results SHALL be ordered by createdAt DESC.

#### Scenario: Filter by date range
- GIVEN movements on Jan 5, Jan 15, and Feb 1
- WHEN calling getBranchMovements({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
- THEN only January movements SHALL return

#### Scenario: Filter by type
- GIVEN TRANSFER and ADJUSTMENT movements
- WHEN calling getBranchMovements({ movementType: "TRANSFER" })
- THEN only TRANSFER movements SHALL return

## MODIFIED Requirements

### Requirement: Per-Branch Stock Tracking

The system MUST maintain `BranchProduct` entities (mapping productId ↔ branchId) with stock (integer ≥ 0) and updatedAt. Stock mutations MUST use Prisma transactions to prevent race conditions. All queries SHALL join `Product` with `BranchProduct` via `getProductsWithBranchStock`.
(Previously: used BranchInventory as the entity name; operations were per-branch queries without cross-branch functions)

#### Scenario: Query stock by branch
- GIVEN Product A with stock 10 at Branch 1 and 5 at Branch 2
- WHEN querying inventory for Branch 1 via getProductsWithBranchStock
- THEN Product A SHALL show stock=10
- AND Branch 2 stock SHALL NOT be included

#### Scenario: Concurrent stock deduction
- GIVEN Product A has stock 1 at a branch
- WHEN two concurrent operations attempt to deduct
- THEN exactly one SHALL succeed
- AND the other SHALL fail with INSUFFICIENT_STOCK

#### Scenario: Cross-branch query via getProductsWithBranchStock
- GIVEN Product A with stock at multiple branches
- WHEN calling getProductsWithBranchStock({}) without branch filter
- THEN ALL branches' stock SHALL be returned per product
- AND total sum SHALL equal Product.stock