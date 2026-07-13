# HU6 - Product Label PDF Generation

## Implementation Tasks

### 1. Server Action: PDF Generation (`label-print.ts`)
- Accept product selections with IDs and quantities
- Validate qty >=1 per product
- Use `pdf-lib` to render labels with exact design:
  - Pink background (#fcd2d3)
  - Rounded rectangles (#ffeff3) with 5mm radius
  - Code in sans-serif, price in Shrikhand font
  - Embed Shrikhand TTF font
- Return PDF Blob for download
- Handle errors (font load failures, invalid inputs)
- Status: Pending
- Priority: High
- [x] Completed

### 2. Layout Library: Column-Major Order (`label-layout.ts`)
- Calculate positions for 7 columns x 13 rows per sheet
- Handle multiple pages for >91 labels
- Output: X/Y coordinates in mm, rendering instructions
- Status: Pending
- Priority: High
- [x] Completed

### 3. UI: LabelSelector Modal (`LabelSelector.tsx`)
- Integrate with existing ProductSearch component
- Add quantity inputs per product
- Track selections in Map<string, number>
- Show dynamic message: "N etiquetas en P hoja(s) A4"
- Status: Pending
- Priority: High
- [x] Completed

### 4. UI: "Imprimir Etiquetas" Buttons
- Add to `/productos` and `/inventario` page headers
- Trigger LabelSelector modal on click
- Status: Pending
- Priority: Medium
- [x] Completed

### 5. Dependency: `pdf-lib` Installation
- Add to `package.json`
- Status: Pending
- Priority: Low
- [x] Completed

### 6. Unit Tests for Layout Library
- Verify coordinate math (first/last label, page boundaries)
- Column-major ordering logic
- Status: Pending
- Priority: High
- [x] Completed

### 7. Server Action Tests
- Mock `pdf-lib` for PDF generation logic
- Validate input validation
- Verify font embedding
- Status: Pending
- Priority: High
- [x] Completed

### 8. Integration Tests
- Test end-to-end flow: search -> select -> PDF generation
- Check different selection quantities
- Status: Pending
- Priority: High
- [x] Completed

### 9. E2E Tests
- Simulate full user workflow
- Verify PDF download initiates
- Validate PDF content (dimensions, fonts, text)
- Status: Pending
- Priority: High
- [x] Completed

### 10. PDF Specification Validation
- Test label dimensions (22x28mm)
- Verify colors and font rendering
- Status: Pending
- Priority: High
- [x] Completed

## Order of Execution
1. Install dependencies
2. Implement core logic (Server Action + Layout)
3. Build UI components
4. Add UI triggers
5. Implement tests
6. Validate output