# Branch External Portal Specification

## Purpose

Provide a read-only external inventory view at `/sucursal/[branchId]/inventory` for branch users (`branch_user` role), secured by dedicated middleware that validates role, branch membership, and HTTP verb.

## Requirements

### Requirement: External Inventory Page

The system MUST render `/sucursal/[branchId]/inventory` as a read-only page showing the branch's inventory with product code, name, stock, and base price, plus a simple search input. The page MUST NOT render mutation controls (no create, edit, delete, or move buttons).

#### Scenario: Render branch inventory
- GIVEN a branch_user assigned to branchId=5 with inventory
- WHEN navigating to /sucursal/5/inventory
- THEN the page SHALL display products with code, name, stock, and price
- AND no mutation buttons SHALL be present

#### Scenario: Simple search filters list
- GIVEN branch inventory with multiple products
- WHEN typing a term in the search input
- THEN matching products SHALL display

### Requirement: Branch Middleware Guard

The system MUST provide `src/middleware/branch.ts` that SHALL allow a request only when: (1) the session user has role `branch_user` in `app_metadata`, (2) the user's `branchId` claim equals the branchId in the URL, and (3) the HTTP method is GET. Any other case SHALL respond 403.

#### Scenario: Allowed GET for own branch
- GIVEN a branch_user with branchId=5
- WHEN requesting GET /sucursal/5/inventory
- THEN the request SHALL proceed to the page

#### Scenario: Different branch rejected
- GIVEN a branch_user with branchId=5
- WHEN requesting GET /sucursal/6/inventory
- THEN the middleware SHALL respond 403

#### Scenario: Non-GET verb rejected
- GIVEN a branch_user with branchId=5
- WHEN requesting POST /sucursal/5/inventory
- THEN the middleware SHALL respond 403

#### Scenario: Non-branch_user role rejected
- GIVEN a session with role admin or no role claim
- WHEN requesting GET /sucursal/5/inventory
- THEN the middleware SHALL respond 403
