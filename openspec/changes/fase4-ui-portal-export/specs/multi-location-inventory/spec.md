# Delta for Multi-Location Inventory

## MODIFIED Requirements

### Requirement: Default Branch Seed

The system MUST create a default branch on first migration if no branches exist, migrating all existing global stock data to this branch. The default branch SHALL be seeded with the unique code "DEP".
(Previously: default branch was created with no code field)

#### Scenario: Existing stock migrated
- GIVEN products with global stock before migration
- AFTER running the migration
- THEN each product SHALL have a BranchInventory entry in the default branch
- AND the stock value SHALL match the previous global stock

#### Scenario: Default branch code seeded
- GIVEN no branches exist before migration
- AFTER running migration and seed
- THEN the default branch SHALL exist with code "DEP"

## ADDED Requirements

### Requirement: Branch Product Search and Flat Projection

The system MUST extend `getProductsWithBranchStock` with an optional `search` param. When provided, the query SHALL match products whose name, code, or description contains the term (case-insensitive) OR whose category name contains the term. An empty search SHALL return the unfiltered list. The action SHALL also expose a flat projection `code | name | stock | price` per branch for export consumption (see `branch-export-pdf`), where stock comes from BranchInventory.

#### Scenario: Search matches across fields
- GIVEN Product "Perno 8mm" (code "P-8", category "Ferretería") and Product "Tuerca"
- WHEN searching with term "perno"
- THEN products matching name, code, description, or category name SHALL be returned

#### Scenario: Empty search returns full list
- GIVEN products exist
- WHEN calling getProductsWithBranchStock without search
- THEN the full list SHALL be returned unfiltered

#### Scenario: Flat projection for export
- GIVEN a branch with products and BranchInventory stock
- WHEN calling the projection action
- THEN each product SHALL include code, name, stock (from BranchInventory), and price
