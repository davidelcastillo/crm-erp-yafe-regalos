# Branch Reporting Specification

## Purpose

Generate operational and financial reports filtered by branch, enabling management to assess performance, inventory levels, and transaction activity per location.

## Requirements

### Requirement: Sales by Branch

The system MUST provide a report endpoint that aggregates sales totals and counts grouped by branch, with optional date range filtering.

#### Scenario: Sales report filtered by branch and date
- GIVEN Branch 1 has 5 sales ($15,000 total) and Branch 2 has 3 sales ($9,000 total)
- WHEN requesting sales report for Branch 1
- THEN the result SHALL show $15,000 total with 5 transactions
- AND Branch 2 data SHALL NOT be included

#### Scenario: Empty period returns zero
- GIVEN Branch 1 has no sales in January
- WHEN requesting sales report for Branch 1 in January
- THEN the result SHALL show $0 total with 0 transactions

### Requirement: Inventory by Branch

The system MUST report all products with their stock levels for a given branch, including products with zero stock.

#### Scenario: Full inventory for branch
- GIVEN Branch 1 has products A (10), B (5), C (0)
- WHEN requesting inventory for Branch 1
- THEN ALL products A, B, C SHALL be listed
- AND stock values SHALL be 10, 5, and 0 respectively

### Requirement: Branch Performance Comparison

The system SHOULD provide a comparison view showing key metrics (total sales, transaction count, top products) across all branches for a given period.

#### Scenario: Compare two branches
- GIVEN two branches with different sales volumes
- WHEN requesting the comparison report
- THEN each branch SHALL show its total sales, count, and top product