// src/lib/utils/pdf.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ProductRow {
  code: string;
  name: string;
  stock: number;
  price: number;
}

// A4 page in points (210mm x 297mm)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const HEADER_ROW_HEIGHT = 24;
const ROW_HEIGHT = 20;
const COL_CODE = 84;
const COL_STOCK = 56;
const COL_PRICE = 84;
const COL_NAME = PAGE_WIDTH - 2 * MARGIN - COL_CODE - COL_STOCK - COL_PRICE;

export const ROWS_PER_PAGE = Math.floor(
  (PAGE_HEIGHT - 2 * MARGIN - HEADER_ROW_HEIGHT) / ROW_HEIGHT
);

/**
 * Builds the export file name following `inventario-<branchCode>-<YYYYMMDD>.pdf`.
 */
export function buildExportFileName(branchCode: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `inventario-${branchCode}-${yyyy}${mm}${dd}.pdf`;
}

/**
 * Formats a price in the house style: es-AR ARS currency, e.g. $1.250,00.
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
    .format(price)
    .replace(/\s/g, '');
}

/**
 * Generates a multi-page PDF table (Código | Nombre | Stock | Precio) and
 * returns it base64-encoded, following the label-print convention.
 */
export async function generateProductsPdf(rows: ProductRow[]): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  const headerBackground = rgb(0.9, 0.9, 0.9);

  const drawHeaderRow = (page: {
    drawRectangle: (opts: Record<string, unknown>) => void;
    drawText: (text: string, opts: Record<string, unknown>) => void;
  }) => {
    const yTop = PAGE_HEIGHT - MARGIN;
    const tableWidth = PAGE_WIDTH - 2 * MARGIN;
    page.drawRectangle({
      x: MARGIN,
      y: yTop - HEADER_ROW_HEIGHT,
      width: tableWidth,
      height: HEADER_ROW_HEIGHT,
      color: headerBackground,
    });
    const headerY = yTop - HEADER_ROW_HEIGHT + 7;
    const headerSize = 10;
    page.drawText('Código', { x: MARGIN, y: headerY, size: headerSize, font, color: black });
    page.drawText('Nombre', { x: MARGIN + COL_CODE, y: headerY, size: headerSize, font, color: black });
    page.drawText('Stock', { x: MARGIN + COL_CODE + COL_NAME, y: headerY, size: headerSize, font, color: black });
    page.drawText('Precio', { x: MARGIN + COL_CODE + COL_NAME + COL_STOCK, y: headerY, size: headerSize, font, color: black });
  };

  const drawRow = (
    page: { drawText: (text: string, opts: Record<string, unknown>) => void },
    row: ProductRow,
    rowIndexOnPage: number
  ) => {
    const y = PAGE_HEIGHT - MARGIN - HEADER_ROW_HEIGHT - (rowIndexOnPage + 1) * ROW_HEIGHT;
    const cellSize = 9;
    page.drawText(row.code, { x: MARGIN, y, size: cellSize, font, color: black });
    page.drawText(row.name, { x: MARGIN + COL_CODE, y, size: cellSize, font, color: black });
    page.drawText(String(row.stock), { x: MARGIN + COL_CODE + COL_NAME, y, size: cellSize, font, color: black });
    page.drawText(formatPrice(row.price), { x: MARGIN + COL_CODE + COL_NAME + COL_STOCK, y, size: cellSize, font, color: black });
  };

  let index = 0;
  while (index < rows.length) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderRow(page);
    let rowIndexOnPage = 0;
    while (index < rows.length && rowIndexOnPage < ROWS_PER_PAGE) {
      drawRow(page, rows[index], rowIndexOnPage);
      index += 1;
      rowIndexOnPage += 1;
    }
  }

  if (rows.length === 0) {
    drawHeaderRow(pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}
