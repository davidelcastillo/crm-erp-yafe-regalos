# Branch Export PDF Specification

## Purpose

Export the product list of a selected branch to PDF. The export uses an object-shaped branch argument and includes only products with stock greater than zero.

## Requirements

### Requirement: ExportWizard llama a la acción con `{ branchId }`

The `ExportWizard` SHALL invoke `getBranchProductsForExport` with an object argument `{ branchId }` and SHALL NOT pass a bare number. The action SHALL reject a non-object payload. The unit test asserting the call signature MUST be updated to `{ branchId: 1 }` in the same commit as the fix.

**Traza**: Item 2.

#### Scenario: Export with object argument

- GIVEN the user selects branch id 1 in the ExportWizard
- WHEN the wizard loads available products
- THEN it SHALL call `getBranchProductsForExport({ branchId: 1 })`
- AND the products list SHALL render without an "Expected object, received number" error

#### Scenario: Regression test matches new signature

- GIVEN `ExportWizard.test.tsx` mocks the action
- WHEN the test submits with branch 1
- THEN the assertion SHALL be `toHaveBeenCalledWith({ branchId: 1 })`
- AND it SHALL pass in the same commit as the fix

### Requirement: Exportación solo de productos con stock > 0

The export path SHALL include only products with `stock > 0`: the action filter, the wizard's available-products list, and the PDF validation SHALL all exclude zero-stock rows. This is verify-only — no code change is required. The system MUST NOT apply this filter to `getExternalBranchInventory`: the external portal SHALL keep zero-stock items.

**Traza**: Item 5.

#### Scenario: Zero-stock product excluded from export

- GIVEN 3 products at a branch, one with stock 0
- WHEN exporting
- THEN the PDF SHALL include only the 2 products with stock > 0
- AND the wizard SHALL render only 2 checkboxes

#### Scenario: Portal inventory keeps zero-stock items (non-goal)

- GIVEN a product with stock 0 at a branch
- WHEN the external portal loads the branch inventory
- THEN the product SHALL still be listed
