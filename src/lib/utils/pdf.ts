// src/lib/utils/pdf.ts
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { DOCUMENT_FONT_SIZE, embedDocumentFonts } from '@/lib/fonts/document-fonts';
import { LOGO_PNG_BASE64 } from './pdf-logo';

export interface ProductRow {
  code: string;
  name: string;
  stock: number;
  price: number;
}

/** Presentation data the exported table does not carry. */
export interface PdfMeta {
  branchName: string;
  branchCode: string;
  date: Date;
}

// A4 page in points (210mm x 297mm)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const HEADER_BAND_HEIGHT = 56;
const HEADER_GAP = 14;
const TITLES_HEIGHT = 20;
const TOTALS_HEIGHT = 22;
const ROW_HEIGHT = 20;
const LOGO_SIZE = 40;
const COL_CODE = 84;
const COL_STOCK = 56;
const COL_PRICE = 84;
const COL_NAME = PAGE_WIDTH - 2 * MARGIN - COL_CODE - COL_STOCK - COL_PRICE;

// Rows that fit under the header band, the titles row and the reserved totals line.
export const ROWS_PER_PAGE = Math.floor(
  (PAGE_HEIGHT -
    2 * MARGIN -
    HEADER_BAND_HEIGHT -
    HEADER_GAP -
    TITLES_HEIGHT -
    TOTALS_HEIGHT) /
    ROW_HEIGHT
);

// STYLE.md palette: ink on white, brand pink for the header accent and the totals.
const INK = '#222222';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const HAIRLINE = '#d1d5db';
const SURFACE_SOFT = '#f7f7f7';
const ROW_ALTERNATE = '#fafafa';
const BRAND = '#f472b6';
const BRAND_TEXT = '#be185d';

const color = (hex: string) =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255
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
 * Formats the export date as DD/MM/YYYY.
 */
export function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Cuts a text with a trailing ellipsis so it never overflows its column. */
const clip = (text: string, font: PDFFont, size: number, maxWidth: number): string => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let visible = text;
  while (visible.length > 0 && font.widthOfTextAtSize(`${visible}...`, size) > maxWidth) {
    visible = visible.slice(0, -1);
  }
  return `${visible}...`;
};

/**
 * Generates the branch inventory PDF (branded header with the store logo and the
 * branch name, table with alternating rows and a totals line) and returns it
 * base64-encoded, following the label-print convention.
 */
export async function generateProductsPdf(
  rows: ProductRow[],
  meta: PdfMeta
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const { font, bold } = await embedDocumentFonts(pdfDoc);
  const { title, body, label: labelSize, footer: footerSize } = DOCUMENT_FONT_SIZE;
  const logo = await pdfDoc.embedPng(LOGO_PNG_BASE64);

  const tableWidth = PAGE_WIDTH - 2 * MARGIN;
  const bandTop = PAGE_HEIGHT - MARGIN;
  const rowsTop = bandTop - HEADER_BAND_HEIGHT - HEADER_GAP;
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const units = rows.reduce((sum, row) => sum + row.stock, 0);

  const drawRight = (
    page: PDFPage,
    text: string,
    xRight: number,
    y: number,
    size: number,
    face: PDFFont,
    fill: string
  ) => {
    page.drawText(text, {
      x: xRight - face.widthOfTextAtSize(text, size),
      y,
      size,
      font: face,
      color: color(fill),
    });
  };

  const drawHeaderBand = (page: PDFPage) => {
    page.drawRectangle({
      x: MARGIN,
      y: bandTop - HEADER_BAND_HEIGHT,
      width: tableWidth,
      height: HEADER_BAND_HEIGHT,
      color: color(SURFACE_SOFT),
    });
    page.drawRectangle({
      x: MARGIN,
      y: bandTop - 4,
      width: tableWidth,
      height: 4,
      color: color(BRAND),
    });
    page.drawImage(logo, {
      x: MARGIN + 10,
      y: bandTop - HEADER_BAND_HEIGHT + 8,
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    });
    const textX = MARGIN + 10 + LOGO_SIZE + 12;
    page.drawText(
      clip(`${meta.branchName} (${meta.branchCode})`, bold, title, PAGE_WIDTH - MARGIN - textX),
      { x: textX, y: bandTop - 28, size: title, font: bold, color: color(INK) }
    );
    page.drawText(`Inventario al ${formatDate(meta.date)}`, {
      x: textX,
      y: bandTop - 44,
      size: labelSize,
      font,
      color: color(MUTED),
    });
  };

  const drawTitles = (page: PDFPage) => {
    page.drawRectangle({
      x: MARGIN,
      y: rowsTop - TITLES_HEIGHT,
      width: tableWidth,
      height: TITLES_HEIGHT,
      color: color(SURFACE_SOFT),
    });
    page.drawRectangle({
      x: MARGIN,
      y: rowsTop - TITLES_HEIGHT,
      width: tableWidth,
      height: 0.8,
      color: color(HAIRLINE),
    });
    const y = rowsTop - 14;
    page.drawText('Código', { x: MARGIN + 4, y, size: labelSize, font: bold, color: color(INK) });
    page.drawText('Nombre', {
      x: MARGIN + COL_CODE + 4,
      y,
      size: labelSize,
      font: bold,
      color: color(INK),
    });
    drawRight(page, 'Stock', MARGIN + COL_CODE + COL_NAME + COL_STOCK - 4, y, labelSize, bold, INK);
    drawRight(page, 'Precio', PAGE_WIDTH - MARGIN - 4, y, labelSize, bold, INK);
  };

  const drawRow = (page: PDFPage, row: ProductRow, indexOnPage: number) => {
    const top = rowsTop - TITLES_HEIGHT - (indexOnPage + 1) * ROW_HEIGHT;
    if (indexOnPage % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: top,
        width: tableWidth,
        height: ROW_HEIGHT,
        color: color(ROW_ALTERNATE),
      });
    }
    const y = top + 6;
    page.drawText(row.code, { x: MARGIN + 4, y, size: body, font, color: color(INK) });
    page.drawText(clip(row.name, font, body, COL_NAME - 8), {
      x: MARGIN + COL_CODE + 4,
      y,
      size: body,
      font,
      color: color(INK),
    });
    drawRight(
      page,
      String(row.stock),
      MARGIN + COL_CODE + COL_NAME + COL_STOCK - 4,
      y,
      body,
      font,
      INK
    );
    drawRight(page, formatPrice(row.price), PAGE_WIDTH - MARGIN - 4, y, body, font, INK);
  };

  const drawTotals = (page: PDFPage) => {
    page.drawRectangle({
      x: MARGIN,
      y: MARGIN + 24,
      width: tableWidth,
      height: 0.8,
      color: color(HAIRLINE),
    });
    drawRight(
      page,
      `${rows.length} productos · ${units} unidades`,
      PAGE_WIDTH - MARGIN,
      MARGIN + 8,
      body,
      bold,
      BRAND_TEXT
    );
  };

  const drawFooter = (page: PDFPage, pageNumber: number) => {
    const label = `Página ${pageNumber} de ${totalPages}`;
    page.drawText(label, {
      x: (PAGE_WIDTH - font.widthOfTextAtSize(label, footerSize)) / 2,
      y: 20,
      size: footerSize,
      font,
      color: color(FAINT),
    });
  };

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeaderBand(page);
    drawTitles(page);
    rows
      .slice((pageNumber - 1) * ROWS_PER_PAGE, pageNumber * ROWS_PER_PAGE)
      .forEach((row, index) => drawRow(page, row, index));
    if (pageNumber === totalPages) drawTotals(page);
    drawFooter(page, pageNumber);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}
