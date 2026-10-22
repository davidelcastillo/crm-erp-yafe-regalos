import { PDFDocument, rgb } from 'pdf-lib';
import type { StockControlReceipt } from '@/lib/stock-control-receipt';
import { DOCUMENT_FONT_SIZE, embedDocumentFonts } from '@/lib/fonts/document-fonts';
import { LOGO_PNG_BASE64 } from './pdf-logo';

/** Interlineado de las líneas de detalle, en puntos. */
const DETAIL_LINE_HEIGHT = 15;

/**
 * PDF del ajuste de un control de stock (S10): motivo, sucursal, fecha y el
 * detalle de cada diferencia con su salida (ajustado o pendiente).
 *
 * Mismo estilo que el comprobante de movimientos (`stock-movement-pdf.ts`), en
 * A4 vertical, con el logo y el pie «Página X de Y».
 */
export async function generateStockControlPdf(receipt: StockControlReceipt): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { font, bold } = await embedDocumentFonts(pdf);
  const { title: titleSize, body, label: labelSize, footer: footerSize } = DOCUMENT_FONT_SIZE;
  const logo = await pdf.embedPng(LOGO_PNG_BASE64);
  const supported = new Set(font.getCharacterSet());
  // Poppins tampoco trae emojis: reemplazarlos evita perder el documento por una nota.
  const safe = (value: string) => Array.from(value.normalize('NFC'))
    .map((char) => /\s/.test(char) ? ' ' : supported.has(char.codePointAt(0)!) ? char : '?').join('');
  const ink = rgb(34 / 255, 34 / 255, 34 / 255);
  const muted = rgb(107 / 255, 114 / 255, 128 / 255);
  const soft = rgb(247 / 255, 247 / 255, 247 / 255);
  // Mismos tonos semánticos que las tarjetas de la app.
  const gain = rgb(21 / 255, 128 / 255, 61 / 255);
  const loss = rgb(220 / 255, 38 / 255, 38 / 255);

  const title = receipt.adjustedCount > 0 ? 'Ajuste de stock' : 'Control de stock (sin ajustes)';
  const date = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(receipt.closedAt));

  const details = [
    `Fecha: ${date}`,
    `Sucursal: ${receipt.branchName} (${receipt.branchCode})`,
    `Control: #${receipt.controlId}`,
    `Motivo: ${receipt.reason?.trim() ? receipt.reason : 'sin motivo declarado'}`,
  ];

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

  const rows = receipt.items;
  const bandHeight = 60 + lines.length * DETAIL_LINE_HEIGHT;
  const tableTop = 841.89 - 36 - bandHeight - 14;
  const capacity = Math.max(1, Math.floor((tableTop - 20 - 80) / 20));
  const pages = Math.max(1, Math.ceil(rows.length / capacity));

  const labels = ['Código', 'Nombre', 'Sistema', 'Contado', 'Diferencia', 'Salida'];
  const x = [40, 110, 258, 318, 378, 440];
  const right = [106, 254, 314, 374, 434, 555];
  const widths = right.map((end, i) => end - x[i]);

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
    labels.forEach((label, i) => {
      text(label, i < 2 ? x[i] : right[i] - bold.widthOfTextAtSize(label, labelSize), tableTop - 14, labelSize, true);
    });

    rows.slice((number - 1) * capacity, number * capacity).forEach((row, index) => {
      const y = tableTop - 20 - (index + 1) * 20;
      if (index % 2 === 1) page.drawRectangle({ x: 36, y, width: 523.28, height: 20, color: rgb(250 / 255, 250 / 255, 250 / 255) });

      const adjusted = row.decision === 'ACCEPTED';
      const values = [
        row.code,
        row.name,
        String(row.systemStock),
        String(row.countedStock),
        `${row.difference > 0 ? '+' : ''}${row.difference}`,
        adjusted ? 'Ajustado' : 'Pendiente',
      ];
      const colors = [ink, ink, ink, ink, row.difference < 0 ? loss : gain, adjusted ? ink : muted];

      values.forEach((value, i) => {
        let display = safe(value);
        if (font.widthOfTextAtSize(display, body) > widths[i]) {
          while (display.length && font.widthOfTextAtSize(display + '...', body) > widths[i]) display = display.slice(0, -1);
          display += '...';
        }
        text(display, i < 2 ? x[i] : right[i] - font.widthOfTextAtSize(display, body), y + 6, body, false, colors[i]);
      });
    });

    if (number === pages) {
      const total = `${receipt.adjustedCount} ajustados · ${receipt.pendingCount} pendientes`;
      page.drawLine({ start: { x: 36, y: 60 }, end: { x: 559.28, y: 60 }, color: muted, thickness: 0.8 });
      page.drawText(total, {
        x: 559.28 - bold.widthOfTextAtSize(total, body), y: 46, size: body, font: bold,
        color: rgb(190 / 255, 24 / 255, 93 / 255),
      });
    }

    const footer = `Página ${number} de ${pages}`;
    page.drawText(footer, { x: (595.28 - font.widthOfTextAtSize(footer, footerSize)) / 2, y: 20, size: footerSize, font, color: muted });
  }

  return pdf.save();
}
