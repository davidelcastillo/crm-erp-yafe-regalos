# Delta for Inventory UI

## MODIFIED Requirements

### Requirement: Inventory Page with Filters

The system MUST render `/inventario` as an admin-only page showing products with their stock per branch. Filters SHALL include branch selector (default "Todas"), category multi-select, and a unified search input with 300 ms debounce. The unified search SHALL be server-driven and match product name, code, description, or category name (case-insensitive); an empty query SHALL return the full unfiltered list. The page SHALL display: product name, code, stock by each visible branch, total stock, and action buttons.
(Previously: filters were branch selector and category multi-select only; search was a client-side input covering name and description with no category match)

#### Scenario: Load inventory with all branches
- GIVEN 2 branches and 3 products with stock
- WHEN the admin opens /inventario
- THEN all products SHALL display with stock columns per branch
- AND total stock SHALL equal the sum of branch stocks

#### Scenario: Filter by single branch
- GIVEN products with stock at Branch 1 and Branch 2
- WHEN selecting "Branch 1" in the branch filter
- THEN only Branch 1 stock column SHALL show
- AND products with zero stock at Branch 1 SHALL show 0

#### Scenario: Filter by category
- GIVEN products in categories "Electronics" and "Food"
- WHEN selecting "Electronics" in the category filter
- THEN only electronic products SHALL display

#### Scenario: Unified search matches multiple fields
- GIVEN products where "perno" matches one by name, one by code, and one by category name
- WHEN typing "perno" in the unified search input
- THEN all matching products SHALL display after the 300 ms debounce

#### Scenario: Empty search returns full list
- GIVEN the unified search input is cleared
- WHEN the query becomes empty
- THEN the full product list SHALL display without filtering

## ADDED Requirements

### Requirement: Export Products Button

The inventory page SHALL include an "Exportar productos" button alongside the stock actions. The button SHALL open the export wizard (see `branch-export-pdf`).

#### Scenario: Open export wizard
- GIVEN the inventory page is loaded
- WHEN clicking "Exportar productos"
- THEN the 3-step export wizard SHALL open
