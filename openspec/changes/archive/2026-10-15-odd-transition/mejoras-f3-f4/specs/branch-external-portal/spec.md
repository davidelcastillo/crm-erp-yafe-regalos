# Branch External Portal Specification

## Purpose

Standalone read-only branch inventory portal at `/sucursal/[branchId]/inventory` for the `branch_user` role: no admin chrome, responsive table, full inventory including zero-stock items.

## Requirements

### Requirement: Portal sin Chrome de Administración

The portal pages under `/sucursal/*` SHALL render without the `BottomNav`. The `Navbar` SHALL remain visible. This applies to the branch inventory page and the portal login.

**Traza**: Item 6.

#### Scenario: Inventory page without BottomNav

- GIVEN a branch_user opens /sucursal/5/inventory
- WHEN the page renders
- THEN the BottomNav SHALL NOT appear
- AND the Navbar SHALL remain visible

### Requirement: Tabla de Inventario Responsive

`ExternalInventoryTable` SHALL use a responsive layout: on mobile a 2-column grid (column 1 = code + name with the name wrapping instead of truncating; column 2 = stock + price stacked and right-aligned) and on `sm+` the 4-column grid `[60px_1fr_80px_100px]` mirroring the header. Numerics SHALL be right-aligned, rows SHALL keep `py-3` padding, and the table SHALL NOT require horizontal scrolling.

**Traza**: Item 7.

#### Scenario: Mobile two-column layout

- GIVEN a ~360px viewport rendering the portal table
- WHEN the rows render
- THEN column 1 SHALL show the code and the full wrapped name
- AND column 2 SHALL show stock and price right-aligned

#### Scenario: Desktop mirrors header columns

- GIVEN a ≥640px viewport
- WHEN the table renders
- THEN rows SHALL align with the header's code, name, stock, and price columns

#### Scenario: Zero-stock product still listed

- GIVEN a product with stock 0 at the branch
- WHEN the portal loads the inventory
- THEN the product SHALL remain visible in the table (non-goal of Item 5: the export filter MUST NOT apply here)
