import { PDFDocument, rgb } from 'pdf-lib';
import type { StockMovementReceipt, StockMovementSide } from '@/lib/stock-movement-receipt';
import {
  DOCUMENT_COLOR,
  DOCUMENT_FONT_SIZE,
  documentColor,
  embedDocumentFonts,
} from '@/lib/fonts/document-fonts';
import { LOGO_PNG_BASE64 } from './pdf-logo';
import { formatPrice } from './pdf';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const TABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const LOGO_SIZE = 40;
/** Del borde inferior del logo a la línea base del título, y de ahí al primer detalle. */
const TITLE_DROP = 26;
const DETAIL_DROP = 18;
/** Interlineado de las líneas de detalle, en puntos. */
const DETAIL_LINE_HEIGHT = 15;
const TABLE_GAP = 16;
const TABLE_HEAD_HEIGHT = 22;
const ROW_HEIGHT = 20;
/** Reservado al pie para la línea de resumen, encima del pie «Página X de Y». */
const SUMMARY_RESERVE = 70;

const HEADER_TOP = PAGE_HEIGHT - MARGIN;
const TITLE_BASELINE = HEADER_TOP - LOGO_SIZE - TITLE_DROP;
const DETAIL_BASELINE = TITLE_BASELINE - DETAIL_DROP;

/** Mismo estilo del inventario, con cantidades y saldos de la operación confirmada. */
export async function generateStockMovementPdf(
  receipt: StockMovementReceipt,
  side: StockMovementSide = 'DESTINATION',
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { font, bold } = await embedDocumentFonts(pdf);
  const { title: titleSize, body, label: labelSize, footer: footerSize } = DOCUMENT_FONT_SIZE;
  const logo = await pdf.embedPng(LOGO_PNG_BASE64);
  const supported = new Set(font.getCharacterSet());
  // Poppins tampoco trae emojis: reemplazarlos evita perder el comprobante por una nota.
  const safe = (value: string) => Array.from(value.normalize('NFC'))
    .map((char) => /\s/.test(char) ? ' ' : supported.has(char.codePointAt(0)!) ? char : '?').join('');
  const ink = documentColor(DOCUMENT_COLOR.ink);
  const muted = documentColor(DOCUMENT_COLOR.muted);
  const brand = documentColor(DOCUMENT_COLOR.brand);
  const hairline = documentColor(DOCUMENT_COLOR.hairline);
  const zebra = documentColor(DOCUMENT_COLOR.zebra);
  const white = rgb(1, 1, 1);
  // S6: mismos tonos semánticos que las tarjetas de la app.
  const gain = rgb(21 / 255, 128 / 255, 61 / 255);
  const loss = rgb(220 / 255, 38 / 255, 38 / 255);
  const title = { ENTRY: 'Ingreso', EXIT: 'Egreso', TRANSFER: 'Movimiento de sucursal' }[receipt.movementType];
  const date = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(receipt.date));
  const sourceBranch = `${receipt.sourceBranchName} (${receipt.sourceBranchCode})`;
  const destinationBranch = `${receipt.branchName} (${receipt.branchCode})`;
  const branch = side === 'SOURCE' && receipt.movementType === 'TRANSFER' ? sourceBranch : destinationBranch;
  const details = [
    `Fecha: ${date}`,
    ...(receipt.movementType === 'TRANSFER'
      ? [
        `Origen: ${sourceBranch}`,
        `Destino: ${destinationBranch}`,
        side === 'SOURCE'
          ? `Comprobante de la sucursal que envía: ${sourceBranch}`
          : `Comprobante de la sucursal que recibe: ${destinationBranch}`,
      ]
      : [`Sucursal: ${branch}`]),
    `Motivo: ${receipt.reference}`,
  ];
  // S7: el comprobante de la sucursal que envía muestra el saldo que le queda al origen, nunca el del destino.
  const rows = side === 'SOURCE'
    ? receipt.rows.map((row) => {
      if (row.sourceStock === undefined) throw new Error('El comprobante de la sucursal que envía requiere el saldo de origen');
      return { ...row, stock: row.sourceStock };
    })
    : receipt.rows;
  const lines: string[] = [];
  for (const detail of details) {
    let line = '';
    for (const char of safe(detail)) {
      if (font.widthOfTextAtSize(line + char, labelSize) > TABLE_WIDTH) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    lines.push(line);
  }
  const tableTop = DETAIL_BASELINE - (lines.length - 1) * DETAIL_LINE_HEIGHT - TABLE_GAP;
  const capacity = Math.max(
    1,
    Math.floor((tableTop - TABLE_HEAD_HEIGHT - SUMMARY_RESERVE) / ROW_HEIGHT),
  );
  const pages = Math.max(1, Math.ceil(rows.length / capacity));
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);
  const x = [40, 114, 290, 354, 458];
  const right = [106, 282, 346, 450, 555];
  const widths = right.map((end, i) => end - x[i]);
  // S7: el signo y el color dependen del lado; la sucursal que recibe suma en verde y la que envía resta en rojo.
  const gainSide = receipt.movementType === 'ENTRY' || (receipt.movementType === 'TRANSFER' && side === 'DESTINATION');
  const quantitySign = gainSide ? '+' : '-';
  const quantityColor = gainSide ? gain : loss;

  for (let number = 1; number <= pages; number++) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const text = (value: string, left: number, y: number, size: number = body, strong = false, color = ink) => {
      page.drawText(safe(value), { x: left, y, size, font: strong ? bold : font, color });
    };
    page.drawImage(logo, { x: MARGIN, y: HEADER_TOP - LOGO_SIZE, width: LOGO_SIZE, height: LOGO_SIZE });
    text(title, MARGIN, TITLE_BASELINE, titleSize, true, brand);
    lines.forEach((line, i) => text(line, MARGIN, DETAIL_BASELINE - i * DETAIL_LINE_HEIGHT, labelSize, false, muted));
    // Encabezado de tabla: banda violeta con el texto en blanco en negrita.
    page.drawRectangle({
      x: MARGIN, y: tableTop - TABLE_HEAD_HEIGHT, width: TABLE_WIDTH, height: TABLE_HEAD_HEIGHT, color: brand,
    });
    ['Código', 'Nombre', 'Cantidad', 'Stock final', 'Precio unit.'].forEach((label, i) => {
      text(label, i < 2 ? x[i] : right[i] - bold.widthOfTextAtSize(label, labelSize), tableTop - TABLE_HEAD_HEIGHT + 7, labelSize, true, white);
    });
    rows.slice((number - 1) * capacity, number * capacity).forEach((row, index) => {
      const y = tableTop - TABLE_HEAD_HEIGHT - (index + 1) * ROW_HEIGHT;
      if (index % 2 === 1) page.drawRectangle({ x: MARGIN, y, width: TABLE_WIDTH, height: ROW_HEIGHT, color: zebra });
      // Sin caja: sólo la línea fina que separa una fila de la siguiente.
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + TABLE_WIDTH, y }, thickness: 0.5, color: hairline });
      [row.code, row.name, `${quantitySign}${row.quantity}`, String(row.stock), formatPrice(row.price)].forEach((value, i) => {
        let display = safe(value);
        if (font.widthOfTextAtSize(display, body) > widths[i]) {
          while (display.length && font.widthOfTextAtSize(display + '...', body) > widths[i]) display = display.slice(0, -1);
          display += '...';
        }
        text(display, i < 2 ? x[i] : right[i] - font.widthOfTextAtSize(display, body), y + 6, body, false, i === 2 ? quantityColor : ink);
      });
    });
    if (number === pages) {
      const total = `${rows.length} productos · ${units} unidades`;
      page.drawLine({ start: { x: MARGIN, y: 62 }, end: { x: MARGIN + TABLE_WIDTH, y: 62 }, color: hairline, thickness: 0.5 });
      page.drawText(total, { x: MARGIN + TABLE_WIDTH - bold.widthOfTextAtSize(total, body), y: 46, size: body, font: bold, color: brand });
    }
    const footer = `Página ${number} de ${pages}`;
    page.drawText(footer, { x: (PAGE_WIDTH - font.widthOfTextAtSize(footer, footerSize)) / 2, y: 20, size: footerSize, font, color: muted });
  }
  return pdf.save();
}
