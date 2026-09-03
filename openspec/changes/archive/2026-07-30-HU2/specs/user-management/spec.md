# Delta for User Management

## ADDED Requirements

### Requirement: Optional Branch Assignment

The user profile MAY include an optional `branchId` reference. When assigned, the system SHOULD default to that branch for transaction forms and dashboard views. Unassigned users SHALL see "All Branches" aggregate or be prompted to select a branch.

#### Scenario: User with preferred branch
- GIVEN User A has branchId=1 assigned
- WHEN the user logs in
- THEN the BranchContext SHALL default to Branch 1
- AND transaction forms SHALL pre-select Branch 1

#### Scenario: User without branch assignment
- GIVEN User B has no branchId assigned
- WHEN the user navigates to /ventas
- THEN the system SHALL prompt the user to select a branch
- AND no default branch SHALL be pre-selected