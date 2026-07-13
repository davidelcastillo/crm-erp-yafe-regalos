# Label Printing Specification

## Purpose

Enable merchants to generate print-ready A4 PDF label sheets for physical products, with precise brand design: pink backgrounds (#fcd2d3), rounded rectangles (#ffeff3) for code and price, auto-generated product codes (AAA000), ARS-formatted prices, and Shrikhand-font business identifier `@feria_conexx`.

## Requirements

### Requirement: Label Layout Engine

The system MUST include a pure-TS layout library that computes exact label positions for A4 portrait (210mm × 297mm). Grid: 7 columns × 13 rows = 91 labels/sheet, each label 22mm × 28mm, column-major fill order.

#### Scenario: Single sheet, full occupancy
- GIVEN a request for 91 labels
- WHEN computing positions
- THEN the layout SHALL return 91 positions in column-major order
- AND the layout SHALL report exactly 1 page

#### Scenario: Multi-page overflow
- GIVEN a request for 95 labels
- WHEN computing positions
- THEN page 1 SHALL have 91 positions, page 2 SHALL have 4
- AND ALL positions SHALL have valid X/Y coordinates within A4 bounds

#### Scenario: Empty selection yields zero sheets
- GIVEN a request for 0 labels
- WHEN computing positions
- THEN the layout SHALL return 0 pages

### Requirement: PDF Generation Server Action

The system MUST provide `generateProductLabels(selection: {productId: number, quantity: number}[])` returning a PDF Blob. Each label: pink fill (#fcd2d3), two rounded rects (#ffeff3), code in sans-serif, price as `$ XX.XX` (Shrikhand `$` + sans-serif amount), bottom `@feria_conexx` in Shrikhand. Maximum 500 labels total.

#### Scenario: Generate valid PDF for 3 labels
- GIVEN selection of 2 products with qtys 1 and 2
- WHEN calling the Server Action
- THEN the response SHALL be a valid PDF Blob with 1 A4 page
- AND each label SHALL contain code, price, and `@feria_conexx`

#### Scenario: Invalid quantity rejected
- GIVEN a selection with quantity = 0
- WHEN calling the Server Action
- THEN it SHALL throw a Zod validation error

#### Scenario: Limit exceeded prevented
- GIVEN a selection totaling 501 labels
- WHEN calling the Server Action
- THEN it SHALL reject with LIMIT_EXCEEDED

#### Scenario: Missing product rejected
- GIVEN a selection with a non-existent productId
- WHEN calling the Server Action
- THEN it SHALL throw a NOT_FOUND error

### Requirement: Label Selector UI

The system MUST provide a `LabelSelector` modal component. Features: product search via existing `searchProducts`, quantity input per product (min 1), dynamic "N etiquetas en P hoja(s) A4" message. Submit validates all inputs before calling the Server Action.

#### Scenario: Select products and submit
- GIVEN the LabelSelector modal is open
- WHEN user selects 2 products (qty 3 and 5) and confirms
- THEN the UI SHALL display "8 etiquetas en 1 hoja(s) A4"
- AND the modal SHALL call generateProductLabels

#### Scenario: Empty selection blocked
- GIVEN the LabelSelector modal is open with no products
- WHEN the user clicks confirm
- THEN the submit button SHALL remain disabled

#### Scenario: Search filters products
- GIVEN the LabelSelector modal is open
- WHEN the user types in the search field
- THEN results SHALL filter in real-time via searchProducts

### Requirement: Print Button Trigger

The system MUST render an "Imprimir Etiquetas" button in the page header of both `/productos` and `/inventario` pages that opens the LabelSelector modal.

#### Scenario: Trigger from productos page
- GIVEN the user is on /productos
- WHEN clicking "Imprimir Etiquetas"
- THEN the LabelSelector modal SHALL open

#### Scenario: Trigger from inventario page
- GIVEN the user is on /inventario
- WHEN clicking "Imprimir Etiquetas"
- THEN the LabelSelector modal SHALL open