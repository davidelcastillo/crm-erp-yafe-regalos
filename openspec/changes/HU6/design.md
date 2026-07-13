# Design: HU6 - Product Label PDF Generation

## Technical Approach

The solution implements a pure-TS layout library (`label-layout.ts`) that calculates exact label positions on A4 sheets (210mm × 297mm) in column-major order (7 columns × 13 rows = 91 labels/sheet). A Server Action (`label-print.ts`) uses `pdf-lib` to render labels based on layout instructions, embedding the Shrikhand TTF font. The UI consists of a reusable `LabelSelector` modal that leverages the existing `ProductSearch` component, triggered from page headers in `/productos` and `/inventario`. The Server Action returns a PDF Blob for client-side download, ensuring security and consistency.

## Architecture Decisions

### Decision: PDF Generation Library

**Choice**: `pdf-lib`  
**Alternatives considered**: 
- `pdfkit` (more flexible but larger bundle)
- Browser-based jsPDF (client-side only, security/inconsistency concerns)
- Server-side canvas + canvas-print (complex setup, font embedding challenges)

**Rationale**: 
- `pdf-lib` is tree-shakeable (~100KB impact) and actively maintained
- Supports embedding custom TTF fonts (required for Shrikhand)
- Provides precise PDF drawing operations needed for exact millimeter positioning
- Works well in Vercel serverless environment
- Integrates naturally with Server Actions for secure PDF generation

### Decision: Layout Calculation: Column-Major Order

**Choice**: Column-major order (fill columns left-to-right, top-to-bottom within each column)  
**Alternatives considered**: 
- Row-major order (fill rows top-to-bottom, left-to-right within each row)
- Snaking pattern (alternating row directions)

**Rationale**: 
- Matches typical label sheet cutting patterns (guillotine cuts vertical strips first)
- Aligns with common label printer expectations
- Simpler coordinate math: x = column × labelWidth + margin, y = row × labelHeight + margin
- Spec explicitly mentions "column-major order"

### Decision: Font Embedding Approach

**Choice**: Embed Shrikhand TTF as base64 in `pdf-lib` document  
**Alternatives considered**: 
- Using `next/font` with `@next/font/google` (requires Vercel Edge, complicates Server Action)
- Loading font from public URL (network dependency, potential CORS/issues)
- Converting text to paths (loses text editability, increases PDF size significantly)

**Rationale**: 
- Guarantees font availability regardless of runtime environment
- Maintains text selectability in generated PDF
- Simple implementation within Server Action
- Acceptable bundle impact (TTF ~30KB base64-encoded)

### Decision: UI Component Placement

**Choice**: Reuse existing `ProductSearch` component within new `LabelSelector` modal  
**Alternatives considered**: 
- Building completely new search component from scratch
- Modifying `ProductSearch` to accept quantity inputs directly

**Rationale**: 
- Leverages existing, tested, accessible search component
- Maintains consistent UX across the application
- Separates concerns: product search vs. label-specific controls (quantity)
- Minimizes code duplication and surface area for bugs

## Data Flow

```plaintext
User Action                                   Server Action
                                               ┌─────────────────────┐
LabelSelector Modal → Product Search →        │ searchProducts()    │
(product selection + qty)  qty input:                                              : results) ─────────────→  │ (existing action)     │
                                               └─────────────────────┘
                                                       │
                                               ┌─────────────────────┐
                                               │ generateProductLabels()│
                                               │ (new action)          │
                                               └─────────────────────┘
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           ▼                                                       ▼
                  label-layout.ts (pure calculations)                     pdf-lib (PDF rendering)
                           │                                                       │
                           ▼                                                       ▼
                  Layout instructions (positions, text, colors)         Font embedding + drawing operations
                           │                                                       │
                           └───────────────────────┬───────────────────────────────┘
                                                   ▼
                                             PDF Blob (returned to client)
                                                   │
                                                   ▼
                                          Browser download/print dialog
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/actions/label-print.ts` | Create | New Server Action for PDF generation using `pdf-lib` |
| `src/lib/label-layout.ts` | Create | Pure TypeScript library for label position calculations and rendering instructions |
| `src/lib/fonts/Shrikhand-Regular.ttf` | Create | Embedded TTF font asset (base64 embedded in PDF generation) |
| `src/components/ui/LabelSelector.tsx` | Create | Modal component for product selection with quantity inputs |
| `src/app/productos/page.tsx` | Modify | Add "Imprimir Etiquetas" button in header, integrate LabelSelector modal |
| `src/app/inventario/page.tsx` | Modify | Add "Imprimir Etiquetas" button in header, integrate LabelSelector modal |
| `package.json` | Modify | Add `pdf-lib` dependency |

## Interfaces / Contracts

### LabelPrint Server Action Interface
```typescript
// src/app/actions/label-print.ts
export interface LabelProductSelection {
  productId: string;   // References Product.id (as string for compatibility)
  quantity: number;    // Number of labels to generate for this product (≥ 1)
}

export interface LabelGenerationResult {
  success: true;
  data: Blob;          // PDF Blob for download
}

export interface LabelGenerationError {
  success: false;
  error: string;       // Human-readable error message
}

export type LabelPrintResult = LabelGenerationResult | LabelGenerationError;

// Server Action signature
export async function generateProductLabels(
  selection: LabelProductSelection[]
): Promise<LabelPrintResult>;
```

### Label Layout Interface
```typescript
// src/lib/label-layout.ts
export interface LabelPosition {
  index: number;           // Zero-based label index
  page: number;            // Zero-based page number
  x: number;               // X position in mm from left edge
  y: number;               // Y position in mm from top edge
}

export interface LabelRenderingInstructions {
  backgroundColor: string; // Hex color (#fcd2d3)
  rectColor: string;       // Hex color (#ffeff3)
  rectRadius: number;      // Corner radius in mm
  code: {
    text: string;          // Product code (e.g., "AAA000")
    font: string;          // Sans-serif (Helvetica/Arial equivalent)
    size: number;          // Font size in pt
    color: string;         // Text color (black)
  };
  price: {
    currencySymbol: string;// "$" (rendered in Shrikhand)
    amount: string;        // Formatted price (e.g., "1.250,00")
    font: string;          // Shrikhand for $, sans-serif for amount
    size: number;          // Font size in pt
    color: string;         // Text color (black)
  };
  businessId: {
    text: string;          // "@feria_conexx"
    font: string;          // Shrikhand
    size: number;          // Font size in pt
    color: string;         // Text color (black)
  };
}

// Pure function that calculates layout for given selections
export function calculateLabelLayout(
  selections: LabelProductSelection[]
): LabelRenderingInstructions[];

// Constants for label/sheet dimensions
export const LABEL_WIDTH_MM = 22;
export const LABEL_HEIGHT_MM = 28;
export const SHEET_WIDTH_MM = 210;   // A4 width
export const SHEET_HEIGHT_MM = 297;  // A4 height
export const MARGIN_H_MM = 5;        // Horizontal margin
export const MARGIN_V_MM = 5;        // Vertical margin
export const COLS_PER_SHEET = 7;     // Columns
export const ROWS_PER_SHEET = 13;    // Rows
export const LABELS_PER_SHEET = 91;  // COLS_PER_SHEET * ROWS_PER_SHEET
```

### LabelSelector Component Interface
```typescript
// src/components/ui/LabelSelector.tsx
interface LabelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onLabelPrint: (selection: LabelProductSelection[]) => Promise<void>;
}

interface LabelSelectorState {
  query: string;
  results: ProductSearchResult[];
  loading: boolean;
  error: string | null;
  selections: Map<string, number>; // productId → quantity
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | `label-layout.ts` | - Verify coordinate calculations for edge cases (first/last label, page boundaries)<br>- Test column-major ordering logic<br>- Validate margin and spacing calculations<br>- Test rendering instructions structure |
| **Unit** | `label-print.ts` Server Action | - Mock `pdf-lib` to verify correct API calls<br>- Test input validation (empty selections, invalid quantities)<br>- Verify font embedding calls<br>- Test error handling (font load failures, PDF generation errors) |
| **Integration** | Product search + label generation | - Use real `searchProducts` action with test data<br>- Verify end-to-end flow from search to PDF generation<br>- Test with various selection quantities (single, multi-product, boundary values)<br>- Validate PDF Blob properties (type, size > 0) |
| **E2E** | Full user workflow | - Visit `/productos` or `/inventario`<br>- Click "Imprimir Etiquetas" button<br>- Search for product, select quantity ≥ 1<br>- Verify modal shows correct sheet count message<br>- Submit form and verify PDF download initiates<br>- Validate downloaded PDF has correct dimensions, colors, fonts, and content |

## Migration / Rollout

**No migration required.** This feature adds new UI elements and server actions without modifying existing data structures or behavior.

**Rollout Plan**:
1. Deploy backend changes (Server Actions, lib files) first
2. Deploy frontend changes (UI components, page modifications)
3. Feature is immediately available upon deployment
4. No feature flag needed as it's additive functionality

**Rollback Plan**:
1. Remove `pdf-lib` from `package.json`
2. Delete new files: `label-print.ts`, `label-layout.ts`, `LabelSelector.tsx`, font file
3. Remove button/modal imports and usage from `productos/page.tsx` and `inventario/page.tsx`
4. No database changes to revert

## Open Questions

- [ ] Should we add a maximum quantity limit per product to prevent excessive memory usage? (Proposed: 500 labels max per product selection)
- [ ] Should the label generation include a small bleed area for printing accuracy, or rely on exact 22×28mm as specified?
- [ ] Should we add a preview modal showing the first page of labels before generating the full PDF?
- [ ] Should we implement keyboard shortcuts (e.g., Ctrl+P) for quicker access to the label printing feature?