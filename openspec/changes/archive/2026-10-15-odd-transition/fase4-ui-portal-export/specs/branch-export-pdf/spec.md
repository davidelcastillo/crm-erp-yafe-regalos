# Branch Export PDF Specification

## Purpose

Enable admins to export a branch's product list to a PDF through a 3-step wizard. The export covers products with stock at the selected branch and is generated server-side with pdf-lib, following the `label-print` base64 pattern.

## Requirements

### Requirement: Export Wizard

The system MUST provide an `ExportWizard` Client Component with 3 steps: (1) select branch, (2) select products via checkboxes with a running counter, (3) generate PDF. Step 1 MUST be completed before advancing; step 3 MUST be disabled when no product is selected. The wizard SHALL surface errors without losing wizard state.

#### Scenario: Branch selection required
- GIVEN the wizard is open on step 1
- WHEN attempting to advance without a branch
- THEN advancement SHALL be blocked with a validation error

#### Scenario: Product selection with counter
- GIVEN a branch with 3 products having stock
- WHEN reaching step 2
- THEN checkboxes SHALL render only for products with stock at that branch
- AND a counter SHALL display the number of selected products

#### Scenario: Generate disabled without selection
- GIVEN no products selected on step 2
- WHEN rendering step 3
- THEN the "Generar PDF" button SHALL be disabled

### Requirement: Export Server Action

The system MUST provide `exportBranchProductsPdf(branchId, selectedProductIds)` that validates the branch exists and that every selected product belongs to the branch, then generates the PDF. Validation failures MUST be returned without generating a file.

#### Scenario: Membership re-validated server-side
- GIVEN selectedProductIds contains a product not belonging to the branch
- WHEN calling exportBranchProductsPdf
- THEN the action SHALL reject
- AND no PDF SHALL be generated

#### Scenario: Valid export returns PDF
- GIVEN a branch with products and a valid selection
- WHEN calling exportBranchProductsPdf
- THEN a base64 PDF SHALL be returned with rows Código | Nombre | Stock | Precio

### Requirement: PDF Generation

The system MUST provide `generateProductsPdf(rows)` using pdf-lib to produce a table with columns Código | Nombre | Stock | Precio. Stock values SHALL come from the branch's BranchInventory. The PDF SHALL break pages when rows overflow a single page. The download file SHALL be named `inventario-<branchCode>-<YYYYMMDD>.pdf`.

#### Scenario: Multi-page table
- GIVEN more products than fit on one page
- WHEN generating the PDF
- THEN the table SHALL continue on the following page without truncation

#### Scenario: Download file name
- GIVEN branch code "DEP" on 2026-08-06
- WHEN the client triggers the download
- THEN the file SHALL be named inventario-DEP-20260806.pdf
