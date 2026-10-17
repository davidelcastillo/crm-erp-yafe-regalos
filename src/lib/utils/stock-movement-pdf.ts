import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { StockMovementReceipt } from '@/lib/stock-movement-receipt';
import { LOGO_PNG_BASE64 } from './pdf-logo';
import { formatPrice } from './pdf';

/** Mismo estilo del inventario, con cantidades y saldos de la operación confirmada. */
export async function generateStockMovementPdf(receipt: StockMovementReceipt): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(LOGO_PNG_BASE64);
  const supported = new Set(font.getCharacterSet());
  // Helvetica no tiene emojis: reemplazarlos evita perder el comprobante por una nota.
  const safe = (value: string) => Array.from(value.normalize('NFC'))
    .map((char) => /\s/.test(char) ? ' ' : supported.has(char.codePointAt(0)!) ? char : '?').join('');
  const ink = rgb(34 / 255, 34 / 255, 34 / 255);
  const muted = rgb(107 / 255, 114 / 255, 128 / 255);
  const soft = rgb(247 / 255, 247 / 255, 247 / 255);
  const title = { ENTRY: 'Ingreso', EXIT: 'Egreso', TRANSFER: 'Movimiento de sucursal' }[receipt.movementType];
  const date = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(receipt.date));
  const branch = `${receipt.branchName} (${receipt.branchCode})`;
  const details = [
    `Fecha: ${date}`,
    ...(receipt.movementType === 'TRANSFER'
      ? [`Origen: ${receipt.sourceBranchName} (${receipt.sourceBranchCode})`, `Destino: ${branch}`]
      : [`Sucursal: ${branch}`]),
    `Motivo: ${receipt.reference}`,
  ];
  const lines: string[] = [];
  for (const detail of details) {
    let line = '';
    for (const char of safe(detail)) {
      if (font.widthOfTextAtSize(line + char, 9) > 499) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    lines.push(line);
  }
  const bandHeight = 60 + lines.length * 13;
  const tableTop = 841.89 - 36 - bandHeight - 14;
  const capacity = Math.max(1, Math.floor((tableTop - 20 - 80) / 20));
  const pages = Math.max(1, Math.ceil(receipt.rows.length / capacity));
  const units = receipt.rows.reduce((sum, row) => sum + row.quantity, 0);
  const x = [40, 114, 290, 354, 458];
  const right = [106, 282, 346, 450, 555];
  const widths = right.map((end, i) => end - x[i]);

  for (let number = 1; number <= pages; number++) {
    const page = pdf.addPage([595.28, 841.89]);
    const text = (value: string, left: number, y: number, size = 9, strong = false) => {
      page.drawText(safe(value), { x: left, y, size, font: strong ? bold : font, color: ink });
    };
    page.drawRectangle({ x: 36, y: 805.89 - bandHeight, width: 523.28, height: bandHeight, color: soft });
    page.drawRectangle({ x: 36, y: 801.89, width: 523.28, height: 4, color: rgb(244 / 255, 114 / 255, 182 / 255) });
    page.drawImage(logo, { x: 46, y: 754, width: 40, height: 40 });
    text(title, 98, 774, 14, true);
    lines.forEach((line, i) => text(line, 48, 742 - i * 13));
    page.drawRectangle({ x: 36, y: tableTop - 20, width: 523.28, height: 20, color: soft });
    ['Código', 'Nombre', 'Cantidad', 'Stock final', 'Precio unit.'].forEach((label, i) => {
      text(label, i < 2 ? x[i] : right[i] - bold.widthOfTextAtSize(label, 9), tableTop - 14, 9, true);
    });
    receipt.rows.slice((number - 1) * capacity, number * capacity).forEach((row, index) => {
      const y = tableTop - 20 - (index + 1) * 20;
      if (index % 2 === 1) page.drawRectangle({ x: 36, y, width: 523.28, height: 20, color: rgb(250 / 255, 250 / 255, 250 / 255) });
      [row.code, row.name, String(row.quantity), String(row.stock), formatPrice(row.price)].forEach((value, i) => {
        let display = safe(value);
        if (font.widthOfTextAtSize(display, 9) > widths[i]) {
          while (display.length && font.widthOfTextAtSize(display + '...', 9) > widths[i]) display = display.slice(0, -1);
          display += '...';
        }
        text(display, i < 2 ? x[i] : right[i] - font.widthOfTextAtSize(display, 9), y + 6);
      });
    });
    if (number === pages) {
      const total = `${receipt.rows.length} productos · ${units} unidades`;
      page.drawLine({ start: { x: 36, y: 60 }, end: { x: 559.28, y: 60 }, color: muted, thickness: 0.8 });
      page.drawText(total, { x: 559.28 - bold.widthOfTextAtSize(total, 10), y: 46, size: 10, font: bold, color: rgb(190 / 255, 24 / 255, 93 / 255) });
    }
    const footer = `Página ${number} de ${pages}`;
    page.drawText(footer, { x: (595.28 - font.widthOfTextAtSize(footer, 8)) / 2, y: 20, size: 8, font, color: muted });
  }
  return pdf.save();
}
