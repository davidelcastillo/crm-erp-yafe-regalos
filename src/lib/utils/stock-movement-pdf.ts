import { PDFDocument, rgb } from 'pdf-lib';
import type { StockMovementReceipt, StockMovementSide } from '@/lib/stock-movement-receipt';
import { DOCUMENT_FONT_SIZE, embedDocumentFonts } from '@/lib/fonts/document-fonts';
import { LOGO_PNG_BASE64 } from './pdf-logo';
import { formatPrice } from './pdf';

/** Interlineado de las líneas de detalle, en puntos. */
const DETAIL_LINE_HEIGHT = 15;

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
  const ink = rgb(34 / 255, 34 / 255, 34 / 255);
  const muted = rgb(107 / 255, 114 / 255, 128 / 255);
  const soft = rgb(247 / 255, 247 / 255, 247 / 255);
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
      if (font.widthOfTextAtSize(line + char, body) > 499) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    lines.push(line);
  }
  const bandHeight = 60 + lines.length * DETAIL_LINE_HEIGHT;
  const tableTop = 841.89 - 36 - bandHeight - 14;
  const capacity = Math.max(1, Math.floor((tableTop - 20 - 80) / 20));
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
    const page = pdf.addPage([595.28, 841.89]);
    const text = (value: string, left: number, y: number, size: number = body, strong = false, color = ink) => {
      page.drawText(safe(value), { x: left, y, size, font: strong ? bold : font, color });
    };
    page.drawRectangle({ x: 36, y: 805.89 - bandHeight, width: 523.28, height: bandHeight, color: soft });
    page.drawRectangle({ x: 36, y: 801.89, width: 523.28, height: 4, color: rgb(244 / 255, 114 / 255, 182 / 255) });
    page.drawImage(logo, { x: 46, y: 754, width: 40, height: 40 });
    text(title, 98, 774, titleSize, true);
    lines.forEach((line, i) => text(line, 48, 740 - i * DETAIL_LINE_HEIGHT));
    page.drawRectangle({ x: 36, y: tableTop - 20, width: 523.28, height: 20, color: soft });
    ['Código', 'Nombre', 'Cantidad', 'Stock final', 'Precio unit.'].forEach((label, i) => {
      text(label, i < 2 ? x[i] : right[i] - bold.widthOfTextAtSize(label, labelSize), tableTop - 14, labelSize, true);
    });
    rows.slice((number - 1) * capacity, number * capacity).forEach((row, index) => {
      const y = tableTop - 20 - (index + 1) * 20;
      if (index % 2 === 1) page.drawRectangle({ x: 36, y, width: 523.28, height: 20, color: rgb(250 / 255, 250 / 255, 250 / 255) });
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
      page.drawLine({ start: { x: 36, y: 60 }, end: { x: 559.28, y: 60 }, color: muted, thickness: 0.8 });
      page.drawText(total, { x: 559.28 - bold.widthOfTextAtSize(total, body), y: 46, size: body, font: bold, color: rgb(190 / 255, 24 / 255, 93 / 255) });
    }
    const footer = `Página ${number} de ${pages}`;
    page.drawText(footer, { x: (595.28 - font.widthOfTextAtSize(footer, footerSize)) / 2, y: 20, size: footerSize, font, color: muted });
  }
  return pdf.save();
}
