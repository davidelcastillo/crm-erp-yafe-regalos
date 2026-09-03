# Branch Movements Specification

## Purpose

Track all stock transfers and adjustments between branches via `BranchMovement` records. Each movement records the product, origin branch, destination branch, quantity, type (TRANSFER or ADJUSTMENT), and the user who performed it.

## Requirements

### Requirement: Record Movement on Transfer

The system MUST create a `BranchMovement` record of type `TRANSFER` whenever stock is moved from one branch to another via `moveStockBetweenBranches`. The record SHALL include: productId, fromBranchId, toBranchId, quantity, type, and userId.

#### Scenario: Movement created on successful transfer
- GIVEN Product A has stock 10 at Branch 1 and 0 at Branch 2
- WHEN transferring 3 units from Branch 1 to Branch 2
- THEN a BranchMovement SHALL be created with type TRANSFER
- AND fromBranchId=1, toBranchId=2, quantity=3

### Requirement: Record Movement on Adjustment

The system MAY create `BranchMovement` records of type `ADJUSTMENT` when stock is assigned via `assignStockToBranch`. If the action adds stock to a branch (no origin), origin SHALL be null.

#### Scenario: Adjustment on stock assignment
- GIVEN Product A has available stock at the product level
- WHEN assigning 5 units to Branch 1 via assignStockToBranch
- THEN a BranchMovement SHALL be created with type ADJUSTMENT
- AND fromBranchId=null, toBranchId=1, quantity=5

### Requirement: View Movements Page

The system MUST render `/movements` as an admin-only page showing a table of BranchMovement records with columns: date/time, product name, origin branch, destination branch, quantity, type, user name. Filters SHALL include date range, origin branch, destination branch, product, and movement type.

#### Scenario: View movements with filters
- GIVEN 10 BranchMovement records across different dates and branches
- WHEN opening /movements
- THEN all records SHALL display in a paginated table ordered by createdAt DESC

#### Scenario: Filter by movement type
- GIVEN TRANSFER and ADJUSTMENT records
- WHEN selecting filter movementType="TRANSFER"
- THEN only TRANSFER records SHALL display