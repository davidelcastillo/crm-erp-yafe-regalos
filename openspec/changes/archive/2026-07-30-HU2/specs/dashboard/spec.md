# Delta for Dashboard

## ADDED Requirements

### Requirement: Branch Selector in Dashboard

The dashboard MUST include a BranchSelector component that filters all displayed metrics (total sales, total purchases, low stock alerts, recent transactions) by the selected branch. An "All Branches" option SHALL show aggregate data.

#### Scenario: Branch filter changes metrics
- GIVEN the dashboard shows aggregate metrics
- WHEN the user selects Branch 1 from the BranchSelector
- THEN all dashboard metrics SHALL update to reflect Branch 1 data only
- AND the branch name SHALL be displayed in the header

#### Scenario: All Branches aggregate
- GIVEN the user has multiple branches
- WHEN selecting "All Branches"
- THEN metrics SHALL show totals across all branches