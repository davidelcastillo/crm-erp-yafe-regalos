# Dashboard Customization Specification

## Purpose

Make the dashboard configurable by period and branch. Admins can switch between 7/30/90-day or custom date ranges and scope metrics to a single branch or all branches combined.

## Requirements

### Requirement: Period and Branch Selectors

The dashboard SHALL render a Period selector (7, 30, 90 días, Personalizado) and a Branch selector ("Todas" plus active branches). Changing either SHALL re-fetch the metrics.

#### Scenario: Change period
- GIVEN the dashboard with the default 30-day period
- WHEN selecting "7 días"
- THEN metrics SHALL refresh for the last 7 days

#### Scenario: Custom date range
- GIVEN the Period selector
- WHEN choosing "Personalizado" and picking start and end dates
- THEN metrics SHALL reflect the chosen range

#### Scenario: Scope to branch
- GIVEN active branches
- WHEN selecting branch "Sucursal X"
- THEN metrics SHALL reflect only branch X
- AND selecting "Todas" SHALL aggregate all branches

### Requirement: Generic Stats Action

The system MUST provide a `getStats(type, startDate, endDate, branchId?)` Server Action returning metrics for the given date range and optional branch. When branchId is omitted, metrics SHALL aggregate across all branches.

#### Scenario: Global stats
- GIVEN sales and purchases across two branches
- WHEN calling getStats without branchId
- THEN metrics SHALL aggregate across all branches

#### Scenario: Branch-scoped stats
- GIVEN sales at Branch 1 and Branch 2
- WHEN calling getStats with branchId=1
- THEN metrics SHALL include only Branch 1 data

#### Scenario: Invalid date range rejected
- GIVEN startDate after endDate
- WHEN calling getStats
- THEN the action SHALL reject with a validation error

### Requirement: Context Labels

Dashboard cards SHALL display a context label "(Sucursal X)" when a specific branch is selected and "(Todas)" when aggregating all branches.

#### Scenario: Label reflects scope
- GIVEN branch "Sucursal Centro" selected
- WHEN rendering dashboard cards
- THEN each card SHALL display "(Sucursal Centro)"

#### Scenario: Label for global scope
- GIVEN "Todas" selected
- WHEN rendering dashboard cards
- THEN each card SHALL display "(Todas)"
