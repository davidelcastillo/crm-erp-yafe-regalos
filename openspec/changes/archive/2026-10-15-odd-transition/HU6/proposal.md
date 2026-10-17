# Proposal: HU6 - Product Label PDF Generation

## Intent
Enable merchants to generate print-ready PDF label sheets for physical products. Products have auto-generated codes (AAA000 format from HU2) and base prices (from HU1). The PDF must render each label at exactly 22mm × 28mm on A4 portrait sheets (91 labels/sheet, column-major order) with a precise brand design: pink background (#fcd2d3), two rounded rectangles for code/price (#ffeff3), and fixed business identifier "@feria_conexx" in Shrikhand font.

## Scope

### In Scope
- Server Action `generateProductLabels(selection: {productId: string, quantity: number}[])` returning PDF Blob
- `LabelSelector` modal component (product search via existing `searchProducts`, qty inputs, dynamic sheet count message)
- "Imprimir Etiquetas" button in `/productos` and `/inventario` page headers
- Pure layout library `src/lib/label-layout.ts` (label positions, rendering instructions)
- `pdf-lib` dependency for precise PDF generation with embedded Shrikhand TTF font
- Unit, integration, and E2E tests

### Out of Scope
- Stock validation/deduction on label printing (labels are informational only)
- Multi-language or configurable business identifier (fixed `@feria_conexx`)
- Custom label sizes or layouts (22×28mm A4 portrait is the only spec)
- Historical print logs or reprint tracking
- Client-side PDF generation (security/consistency requires Server Action)

## Capabilities

### New Capabilities
- `label-printing`: Generate PDF label sheets for selected products with precise brand design

### Modified Capabilities
- `product-management`: Adds "Imprimir Etiquetas" action button to product list views
- `inventory-management`: Adds "Imprimir Etiquetas" action button to inventory list view

## Approach
Reuse existing `searchProducts` Server Action for product lookup. Build a pure-TS layout library (`label-layout.ts`) that computes A4 grid positions (7 cols × 13 rows = 91 labels/sheet, column-major order) and emits drawing instructions. Server Action uses `pdf-lib` to render: draw pink background, two rounded rectangles per label, centered code in sans-serif, price with Shrikhand `$` + sans-serif amount formatted as ARS, bottom `@feria_conexx` in Shrikhand. Embed Shrikhand TTF from `src/lib/fonts/`. Return Blob for browser download. UI: `LabelSelector` modal triggered from page headers, reuses `ProductSearch` component, tracks selections with qty ≥1, shows dynamic "N etiquetas en P hoja(s) A4" message, validates input before calling Server Action.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/actions/label-print.ts` | New | Server Action for PDF generation |
| `src/lib/label-layout.ts` | New | Pure layout calculation & rendering instructions |
| `src/lib/fonts/Shrikhand-Regular.ttf` | New | Embedded TTF font asset |
| `src/components/ui/LabelSelector.tsx` | New | Product selection modal with qty inputs |
| `src/app/productos/page.tsx` | Modified | Add "Imprimir Etiquetas" button + modal trigger |
| `src/app/inventario/page.tsx` | Modified | Add "Imprimir Etiquetas" button + modal trigger |
| `package.json` | Modified | Add `pdf-lib` dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Font embedding fails on Vercel (fs access) | Medium | Bundle font as base64 or use `next/font` local fallback; test deploy early |
| PDF rendering differs from spec (mm precision) | Low | Unit tests verify exact coordinates/colors; pixel-perfect PDF snapshots |
| Large selections cause memory/timeouts | Low | Validate reasonable max labels (e.g., 500); stream PDF pages if needed |
| `pdf-lib` bundle size impact | Low | Tree-shakeable; only imports used modules (~100KB) |

## Rollback Plan
Revert `package.json` (remove `pdf-lib`), delete new files (`label-print.ts`, `label-layout.ts`, `LabelSelector.tsx`, font), remove button/modal imports from `productos/page.tsx` and `inventario/page.tsx`. No DB migration needed.

## Dependencies
- `pdf-lib` (stable version)
- Shrikhand TTF from Google Fonts (local file)
- Existing `searchProducts` Server Action (HU3/HU8)
- Existing `Product` Prisma model with `code`, `price`, `name`

## Success Criteria
- [ ] PDF generates with exact label dimensions (22×28mm), colors (#fcd2d3, #ffeff3), fonts (Shrikhand for `$` and `@feria_conexx`, sans-serif for code/price)
- [ ] 91 labels per A4 sheet, column-major fill order, multi-page for >91 labels
- [ ] UI: button in both pages opens modal, search works, qty validation (≥1), dynamic sheet count message
- [ ] Server Action validates input, returns Blob, handles errors gracefully
- [ ] Unit tests pass (layout math, rendering instructions), integration test verifies PDF structure, E2E verifies 3-label flow