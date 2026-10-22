// src/lib/utils/pdf.ts
import { PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  DOCUMENT_COLOR,
  DOCUMENT_FONT_SIZE,
  documentColor,
  embedDocumentFonts,
} from '@/lib/fonts/document-fonts';
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
/** del borde inferior del logo a la línea base del título, y de ahí a los metadatos */
const TITLE_DROP = 26;
const META_DROP = 16;
const HEADER_GAP = 16;
const TABLE_HEAD_HEIGHT = 22;
const ROW_HEIGHT = 20;
/** Reservado al pie para la línea de resumen, encima del pie «Página X de Y». */
const SUMMARY_HEIGHT = 34;
const LOGO_SIZE = 40;
const COL_CODE = 84;
const COL_STOCK = 56;
const COL_PRICE = 84;
const COL_NAME = PAGE_WIDTH - 2 * MARGIN - COL_CODE - COL_STOCK - COL_PRICE;

const HEADER_TOP = PAGE_HEIGHT - MARGIN;
const TITLE_BASELINE = HEADER_TOP - LOGO_SIZE - TITLE_DROP;
const META_BASELINE = TITLE_BASELINE - META_DROP;
/** Borde superior de la banda del encabezado de tabla. */
const TABLE_TOP = META_BASELINE - HEADER_GAP;

// Rows below the title block and the table header, above the reserved summary line.
export const ROWS_PER_PAGE = Math.floor(
  (TABLE_TOP - TABLE_HEAD_HEIGHT - (MARGIN + SUMMARY_HEIGHT)) / ROW_HEIGHT
);

const INK = DOCUMENT_COLOR.ink;
const MUTED = DOCUMENT_COLOR.muted;
const BRAND = DOCUMENT_COLOR.brand;
const HAIRLINE = DOCUMENT_COLOR.hairline;
const ZEBRA = DOCUMENT_COLOR.zebra;
const WHITE = '#ffffff';

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
 * Generates the branch inventory PDF (brand title, table with a brand header,
 * hairline row separators and a summary line) and returns it base64-encoded,
 * following the label-print convention.
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
      color: documentColor(fill),
    });
  };

  // Sin banda ni acento: el título grande y el violeta de marca son la jerarquía.
  const drawHeader = (page: PDFPage) => {
    page.drawImage(logo, {
      x: MARGIN,
      y: HEADER_TOP - LOGO_SIZE,
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    });
    page.drawText(clip(`${meta.branchName} (${meta.branchCode})`, bold, title, tableWidth), {
      x: MARGIN,
      y: TITLE_BASELINE,
      size: title,
      font: bold,
      color: documentColor(BRAND),
    });
    page.drawText(`Inventario al ${formatDate(meta.date)}`, {
      x: MARGIN,
      y: META_BASELINE,
      size: labelSize,
      font,
      color: documentColor(MUTED),
    });
  };

  // Encabezado de tabla: banda violeta con el texto en blanco en negrita.
  const drawTitles = (page: PDFPage) => {
    page.drawRectangle({
      x: MARGIN,
      y: TABLE_TOP - TABLE_HEAD_HEIGHT,
      width: tableWidth,
      height: TABLE_HEAD_HEIGHT,
      color: documentColor(BRAND),
    });
    const y = TABLE_TOP - TABLE_HEAD_HEIGHT + 7;
    page.drawText('Código', { x: MARGIN + 4, y, size: labelSize, font: bold, color: documentColor(WHITE) });
    page.drawText('Nombre', {
      x: MARGIN + COL_CODE + 4,
      y,
      size: labelSize,
      font: bold,
      color: documentColor(WHITE),
    });
    drawRight(page, 'Stock', MARGIN + COL_CODE + COL_NAME + COL_STOCK - 4, y, labelSize, bold, WHITE);
    drawRight(page, 'Precio', PAGE_WIDTH - MARGIN - 4, y, labelSize, bold, WHITE);
  };

  const drawRow = (page: PDFPage, row: ProductRow, indexOnPage: number) => {
    const top = TABLE_TOP - TABLE_HEAD_HEIGHT - (indexOnPage + 1) * ROW_HEIGHT;
    if (indexOnPage % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: top,
        width: tableWidth,
        height: ROW_HEIGHT,
        color: documentColor(ZEBRA),
      });
    }
    // Sin caja: sólo la línea fina que separa una fila de la siguiente.
    page.drawLine({
      start: { x: MARGIN, y: top },
      end: { x: MARGIN + tableWidth, y: top },
      thickness: 0.5,
      color: documentColor(HAIRLINE),
    });
    const y = top + 6;
    page.drawText(row.code, { x: MARGIN + 4, y, size: body, font, color: documentColor(INK) });
    page.drawText(clip(row.name, font, body, COL_NAME - 8), {
      x: MARGIN + COL_CODE + 4,
      y,
      size: body,
      font,
      color: documentColor(INK),
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
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + 26 },
      end: { x: MARGIN + tableWidth, y: MARGIN + 26 },
      thickness: 0.5,
      color: documentColor(HAIRLINE),
    });
    drawRight(
      page,
      `${rows.length} productos · ${units} unidades`,
      PAGE_WIDTH - MARGIN,
      MARGIN + 8,
      body,
      bold,
      BRAND
    );
  };

  const drawFooter = (page: PDFPage, pageNumber: number) => {
    const label = `Página ${pageNumber} de ${totalPages}`;
    page.drawText(label, {
      x: (PAGE_WIDTH - font.widthOfTextAtSize(label, footerSize)) / 2,
      y: 20,
      size: footerSize,
      font,
      color: documentColor(MUTED),
    });
  };

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page);
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
