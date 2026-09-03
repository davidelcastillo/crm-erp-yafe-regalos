# Delta for Product Management

## MODIFIED Requirements

### Requirement: Product Stock Model

Products MUST maintain stock via the BranchInventory junction table instead of a global stock field. The `stock` field on the Product model MUST be removed. All stock queries MUST include a branchId filter.
(Previously: Products had a single global `stock` integer field)

#### Scenario: Create product without stock
- GIVEN valid product data (name, price, code)
- WHEN creating a product
- THEN the product SHALL be created without a global stock value
- AND the product SHALL be available across all branches

#### Scenario: Read product with branch stock
- GIVEN Product A exists with stock 10 at Branch 1 and 0 at Branch 2
- WHEN querying Product A within Branch 1 context
- THEN the returned product SHALL include stock=10
- AND the branchId SHALL be associated with the query context

#### Scenario: Product list shows per-branch stock
- GIVEN the user is viewing products under Branch 2 context
- WHEN the product list renders
- THEN each product SHALL show its stock level at Branch 2 only