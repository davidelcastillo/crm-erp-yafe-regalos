# Delta for Sale with Branch

## ADDED Requirements

### Requirement: Sales Search and Pagination

The system MUST extend `getSales` to accept an optional `search` term and pagination params. When a search term is provided, the action SHALL return only sales containing at least one item whose product name or code contains the term (case-insensitive). Results SHALL be paginated with `take`/`skip`, and the total matching count SHALL be returned. Existing branch, date, and payment-method filters SHALL remain supported and compose with the search.

#### Scenario: Search sales by product
- GIVEN sales containing item "Perno" and sales containing item "Tuerca"
- WHEN calling getSales with search "perno"
- THEN only sales with at least one "Perno" item SHALL be returned
- AND matching SHALL be case-insensitive

#### Scenario: Empty search returns all sales
- GIVEN sales records exist
- WHEN calling getSales without a search term
- THEN all sales within the other active filters SHALL be returned

#### Scenario: Paginated results
- GIVEN 25 sales matching the search
- WHEN calling getSales with take=10 and skip=0
- THEN 10 sales SHALL be returned
- AND the total count of 25 SHALL be available for pagination

### Requirement: Sales Page Search Input

The `/ventas` page SHALL render a search input that triggers the server-driven product search with 300 ms debounce while preserving the existing branch, date, and payment-method filters.

#### Scenario: Search from sales page
- GIVEN the sales page with existing filters applied
- WHEN typing "perno" in the search input
- THEN the sales list SHALL refresh with matching sales
- AND the existing filters SHALL remain applied
