# Delta for Inventory UI

## ADDED Requirements

### Requirement: Stock Agregado en /productos

The `/productos` page SHALL display the aggregated stock across all branches using `sumStock(product)` in `ProductCard`, and SHALL show "0 uds" when a product has no inventory rows. The products grid container SHALL include the base `grid` class so the responsive column classes take effect.

**Traza**: Item 3.

#### Scenario: Total across branches

- GIVEN a product with 10 units at Branch 1 and 5 at Branch 2, with filter "Todas"
- WHEN /productos renders
- THEN the card SHALL show 15 uds

#### Scenario: Zero inventory shows "0 uds"

- GIVEN a product with no inventory rows
- WHEN /productos renders
- THEN the card SHALL show "0 uds" (not "—")

#### Scenario: Single-branch view still correct

- GIVEN a product with 7 units at the selected branch and 3 elsewhere
- WHEN filtering /productos by that branch
- THEN the card SHALL show 7 uds

#### Scenario: Grid renders multiple columns

- GIVEN the products page loads with several products
- WHEN the container renders
- THEN the grid SHALL apply the base `grid` class with the responsive column classes (e.g. `sm:grid-cols-2`)
