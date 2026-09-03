# Product Soft-Delete Specification

## Purpose

Enable admins to toggle products between active and inactive states without deleting data. Inactive products are hidden from all operational selectors (purchases, sales, movements) but preserved in the database for historical records.

## Requirements

### Requirement: Toggle Product Active Status

The system MUST provide a `toggleProductActive` Server Action that switches a product's `active` flag. Deactivation SHALL trigger a SweetAlert2 confirmation. Reactivation SHALL also trigger SweetAlert2.

#### Scenario: Deactivate product
- GIVEN an active product with id=5
- WHEN calling toggleProductActive(5) with confirmed SweetAlert2
- THEN the product SHALL have active=false
- AND BranchProduct records SHALL persist unchanged

#### Scenario: Reactivate product
- GIVEN an inactive product
- WHEN calling toggleProductActive(5) with confirmed SweetAlert2
- THEN the product SHALL have active=true

### Requirement: Exclude Inactive Products from Selectors

All product selectors in purchase forms, sale forms, movement modals, and inventory listing MUST exclude products with active=false by default.

#### Scenario: Product selector hides inactive
- GIVEN Product A (active=true) and Product B (active=false)
- WHEN opening a product selector in a purchase form
- THEN only Product A SHALL appear in the list

### Requirement: Inactive Products Page

The system MUST render `/inventario/inactivos` as an admin-only page listing all inactive products with a search field and an "Activar" button per row. Reactivation SHALL use SweetAlert2 and call `reactivateProduct` Server Action.

#### Scenario: View inactive products
- GIVEN 3 inactive products
- WHEN opening /inventario/inactivos
- THEN all 3 products SHALL display with name, code, and Activar button

#### Scenario: Search filters inactive list
- GIVEN inactive products "Laptop" and "Mouse"
- WHEN typing "Laptop" in the search field
- THEN only "Laptop" SHALL display

#### Scenario: Activate from inactive page
- GIVEN an inactive product
- WHEN clicking "Activar" and confirming SweetAlert2
- THEN the product SHALL become active=true
- AND it SHALL be removed from the inactive list