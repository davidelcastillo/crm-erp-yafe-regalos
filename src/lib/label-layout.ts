// src/lib/label-layout.ts
/**
 * Label Layout Library - Calculates positions for product label printing
 * 
 * Layout specifications:
 * - Sheet: A4 (210mm �- 297mm)
 * - Label: 22mm �- 28mm
 * - Margins: 5mm horizontal and vertical
 * - Grid: 7 columns �- 13 rows = 91 labels per sheet
 * - Order: Column-major (fill columns left-to-right, top-to-bottom within each column)
 */

/**
 * Shape of a product selection for label printing.
 */
interface LabelProductSelection {
  productId: number;
  quantity: number;
}

// Sheet dimensions (A4)
export const SHEET_WIDTH_MM = 210;
export const SHEET_HEIGHT_MM = 297;

// Label dimensions
export const LABEL_WIDTH_MM = 22;
export const LABEL_HEIGHT_MM = 28;

// Margins
export const MARGIN_H_MM = 5;
export const MARGIN_V_MM = 5;

// Grid configuration
export const COLS_PER_SHEET = 7;
export const ROWS_PER_SHEET = 13;
export const LABELS_PER_SHEET = COLS_PER_SHEET * ROWS_PER_SHEET; // 91

// Calculated spacing
export const COL_SPACING_MM = (SHEET_WIDTH_MM - (2 * MARGIN_H_MM) - (COLS_PER_SHEET * LABEL_WIDTH_MM)) / (COLS_PER_SHEET - 1);
export const ROW_SPACING_MM = (SHEET_HEIGHT_MM - (2 * MARGIN_V_MM) - (ROWS_PER_SHEET * LABEL_HEIGHT_MM)) / (ROWS_PER_SHEET - 1);

// Rendering colors
export const LABEL_BACKGROUND_COLOR = "#fcd2d3";  // Pink background
export const LABEL_RECT_COLOR = "#ffeff3";        // Light pink rounded rect
export const LABEL_RECT_RADIUS_MM = 5;            // 5mm corner radius
export const TEXT_COLOR = "#000000";              // Black text

// Font sizes (in points)
export const CODE_FONT_SIZE = 10;     // Sans-serif for product code
export const PRICE_AMOUNT_FONT_SIZE = 24;  // Sans-serif for price amount
export const PRICE_SYMBOL_FONT_SIZE = 32;  // Shrikhand for $ symbol
export const BUSINESS_ID_FONT_SIZE = 8;    // Shrikhand for @business

export interface LabelPosition {
  index: number;           // Zero-based label index across all pages
  page: number;            // Zero-based page number
  x: number;               // X position in mm from left edge
  y: number;               // Y position in mm from top edge
  column: number;          // Column index (0-6)
  row: number;             // Row index (0-12)
}

export interface LabelRenderingInstructions {
  position: LabelPosition;
  product: {
    id: number;
    code: string;
    price: number;
  };
  colors: {
    background: string;
    rect: string;
    radius: number;
    text: string;
  };
  typography: {
    code: {
      text: string;
      font: "sans-serif";
      size: number;
      color: string;
    };
    price: {
      currencySymbol: string;
      symbolFont: "Shrikhand";
      symbolSize: number;
      amount: string;
      amountFont: "sans-serif";
      amountSize: number;
      color: string;
    };
    businessId: {
      text: string;
      font: "Shrikhand";
      size: number;
      color: string;
    };
  };
}

export interface LayoutResult {
  labels: LabelRenderingInstructions[];
  totalPages: number;
  labelsPerPage: number;
  totalLabels: number;
}

/**
 * Calculate layout positions for label printing in column-major order
 * 
 * Column-major order: Fill column 0 (rows 0-12), then column 1 (rows 0-12), etc.
 * This matches typical label sheet cutting patterns.
 * 
 * @param selections - Array of product selections with IDs and quantities
 * @returns Layout result with positions and rendering instructions
 */
export function calculateLabelLayout(
  selections: LabelProductSelection[]
): LayoutResult {
  // Validate selections
  const validSelections = selections.filter((s) => s.productId && s.quantity >= 1);
  
  if (validSelections.length === 0) {
    return {
      labels: [],
      totalPages: 0,
      labelsPerPage: LABELS_PER_SHEET,
      totalLabels: 0,
    };
  }

  // Expand selections into individual label entries
  const labelEntries: { productId: number; code: string; price: number }[] = [];
  
  for (const selection of validSelections) {
    // We'll resolve product details later - for now store placeholder
    // The actual product data will be passed from the Server Action
    for (let i = 0; i < selection.quantity; i++) {
      labelEntries.push({
        productId: selection.productId,
        code: "",  // Will be filled in by Server Action
        price: 0,  // Will be filled in by Server Action
      });
    }
  }

  const totalLabels = labelEntries.length;
  const totalPages = Math.ceil(totalLabels / LABELS_PER_SHEET);

  const labels: LabelRenderingInstructions[] = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    for (let labelIndexOnPage = 0; labelIndexOnPage < LABELS_PER_SHEET; labelIndexOnPage++) {
      const globalIndex = pageIndex * LABELS_PER_SHEET + labelIndexOnPage;
      
      if (globalIndex >= totalLabels) {
        break;  // No more labels to place
      }

      // Calculate column-major position
      const column = Math.floor(labelIndexOnPage / ROWS_PER_SHEET);
      const row = labelIndexOnPage % ROWS_PER_SHEET;

      // Calculate X/Y positions in mm
      const x = MARGIN_H_MM + column * (LABEL_WIDTH_MM + COL_SPACING_MM);
      const y = MARGIN_V_MM + row * (LABEL_HEIGHT_MM + ROW_SPACING_MM);

      // Get product data (placeholder - will be filled by Server Action)
      const entry = labelEntries[globalIndex];

      labels.push({
        position: {
          index: globalIndex,
          page: pageIndex,
          x,
          y,
          column,
          row,
        },
        product: {
          id: entry.productId,
          code: entry.code,
          price: entry.price,
        },
        colors: {
          background: LABEL_BACKGROUND_COLOR,
          rect: LABEL_RECT_COLOR,
          radius: LABEL_RECT_RADIUS_MM,
          text: TEXT_COLOR,
        },
        typography: {
          code: {
            text: entry.code || "CODE",
            font: "sans-serif",
            size: CODE_FONT_SIZE,
            color: TEXT_COLOR,
          },
          price: {
            currencySymbol: "$",
            symbolFont: "Shrikhand",
            symbolSize: PRICE_SYMBOL_FONT_SIZE,
            amount: entry.price > 0 ? entry.price.toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "0,00",
            amountFont: "sans-serif",
            amountSize: PRICE_AMOUNT_FONT_SIZE,
            color: TEXT_COLOR,
          },
          businessId: {
            text: "@feria_conexx",
            font: "Shrikhand",
            size: BUSINESS_ID_FONT_SIZE,
            color: TEXT_COLOR,
          },
        },
      });
    }
  }

  return {
    labels,
    totalPages,
    labelsPerPage: LABELS_PER_SHEET,
    totalLabels,
  };
}

/**
 * Calculate positions for a single page only
 * Useful for preview or partial rendering
 */
export function calculatePagePositions(pageIndex: number): LabelPosition[] {
  const positions: LabelPosition[] = [];
  const startLabel = pageIndex * LABELS_PER_SHEET;
  const endLabel = startLabel + LABELS_PER_SHEET;

  for (let labelIndex = 0; labelIndex < LABELS_PER_SHEET; labelIndex++) {
    const column = Math.floor(labelIndex / ROWS_PER_SHEET);
    const row = labelIndex % ROWS_PER_SHEET;

    const x = MARGIN_H_MM + column * (LABEL_WIDTH_MM + COL_SPACING_MM);
    const y = MARGIN_V_MM + row * (LABEL_HEIGHT_MM + ROW_SPACING_MM);

    positions.push({
      index: startLabel + labelIndex,
      page: pageIndex,
      x,
      y,
      column,
      row,
    });
  }

  return positions;
}

/**
 * Get sheet count for a given number of labels
 */
export function calculateSheetCount(totalLabels: number): number {
  if (totalLabels <= 0) return 0;
  return Math.ceil(totalLabels / LABELS_PER_SHEET);
}

/**
 * Format price for display (Argentine locale)
 */
export function formatPrice(price: number): string {
  return price.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}