// src/actions/label-print.ts
'use server';
import { requireAdmin } from "@/lib/auth-guard";

// fontkit 2.0.4 no publica tipos y es ESM sin export default: se importa el
// espacio de nombres, que es lo que `registerFontkit` espera (`create`).
// @ts-expect-error -- módulo sin declaraciones de tipos
import * as fontkit from 'fontkit';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { SHRIKHAND_TTF_BASE64 } from '@/lib/fonts/shrikhand';
import { generateStockMovementPdf } from '@/lib/utils/stock-movement-pdf';
import {
  BOX_COLOR,
  BOX_LEFT_MM,
  BOX_WIDTH_MM,
  CODE_BOX_HEIGHT_MM,
  CODE_BOX_RADIUS_MM,
  CODE_BOX_TOP_MM,
  CODE_FONT_SIZE_PT,
  CODE_MAX_WIDTH_RATIO,
  CURRENCY_SYMBOL,
  CUT_MARK_COLOR,
  CUT_MARK_WIDTH_MM,
  cutMarksForSlot,
  DOLLAR_FONT_SIZE_PT,
  DOLLAR_INSET_MM,
  HANDLE_MAX_WIDTH_RATIO,
  HANDLE_TEXT,
  HANDLE_TOP_MM,
  LABELS_PER_SHEET,
  LABEL_BACKGROUND_COLOR,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  MM_TO_PT,
  PRICE_BOX_HEIGHT_MM,
  PRICE_BOX_RADIUS_MM,
  PRICE_BOX_TOP_MM,
  PRICE_FONT_SIZE_PT,
  PRICE_GAP_MM,
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
  CODE_TEXT_COLOR,
  TEXT_COLOR,
  PRICE_TEXT_COLOR,
  calculateLabelSlots,
  calculateSheetCount,
  formatPrice,
  type LabelSlot,
} from '@/lib/label-layout';

export type LabelSelection = {
  productId: number;
  quantity: number;
};

export type GenerateLabelsInput = {
  branchId: number;
  selections: LabelSelection[];
  /** Rellena la última hoja con etiquetas vacías para escribir a mano (S4). */
  fillLastSheet?: boolean;
};

export type GenerateLabelsResult =
  | { success: true; data: { pdfBase64: string; filename: string } }
  | { success: false; error: string };

const generateLabelsSchema = z.object({
  branchId: z.number().int().positive('Sucursal inválida'),
  selections: z
    .array(
      z.object({
        productId: z.number().int().positive('Producto inválido'),
        quantity: z
          .number()
          .int()
          .min(1, 'La cantidad mínima es 1')
          .max(999, 'La cantidad máxima es 999'),
      })
    )
    .min(1, 'Seleccioná al menos un producto'),
  fillLastSheet: z.boolean().optional(),
});

const mm = (value: number) => value * MM_TO_PT;

const color = (hex: string) =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255
  );

/**
 * Tamaño de fuente que entra en `maxWidthPt` sin pasar `maxSizePt`: el más chico
 * entre el tamaño base y el que ocupa exactamente el ancho disponible.
 */
const fitFontSize = (
  font: PDFFont,
  text: string,
  maxWidthPt: number,
  maxSizePt: number
) => Math.min(maxSizePt, maxWidthPt / Math.max(font.widthOfTextAtSize(text, 1), 1e-6));

/** mm desde el borde superior de la hoja al borde inferior de pdf-lib. */
const yFromTop = (topMm: number, heightMm: number) =>
  mm(SHEET_HEIGHT_MM - topMm - heightMm);

/**
 * Rectángulo de esquinas redondeadas: pdf-lib no lo trae, así que se compone con
 * dos rectángulos cruzados y un círculo en cada esquina (misma pintura, sin
 * costuras visibles).
 */
const drawRoundedRect = (
  page: PDFPage,
  {
    x,
    y,
    width,
    height,
    radius,
    fill,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fill: ReturnType<typeof rgb>;
  }
) => {
  const r = Math.min(radius, width / 2, height / 2);

  page.drawRectangle({ x, y: y + r, width, height: height - 2 * r, color: fill });
  page.drawRectangle({ x: x + r, y, width: width - 2 * r, height, color: fill });
  for (const [cx, cy] of [
    [x + r, y + r],
    [x + width - r, y + r],
    [x + r, y + height - r],
    [x + width - r, y + height - r],
  ]) {
    page.drawCircle({ x: cx, y: cy, size: r, color: fill });
  }
};

/**
 * Marcas de corte: dos ticks por esquina de cada etiqueta, dentro del canal.
 *
 * Antes esto era un rectángulo de borde por celda de 33 × 26,25 mm, o sea
 * etiquetas pegadas una al lado de la otra: sin canal, el corte a mano no tenía
 * por dónde entrar (S2). La geometría de los ticks vive en `label-layout`.
 */
const drawCutMarks = (page: PDFPage, slots: LabelSlot[]) => {
  const stroke = { color: color(CUT_MARK_COLOR), width: mm(CUT_MARK_WIDTH_MM) };

  for (const slot of slots) {
    for (const mark of cutMarksForSlot(slot)) {
      page.drawLine({
        start: { x: mm(mark.x1), y: yFromTop(mark.y1, 0) },
        end: { x: mm(mark.x2), y: yFromTop(mark.y2, 0) },
        color: stroke.color,
        thickness: stroke.width,
      });
    }
  }
};

type LabelContent = { code: string; price: number };

/**
 * Una etiqueta: fondo, cajas redondeadas y sus cuatro textos. Sin contenido se
 * dibuja solo el fondo rosa, que es el relleno para escribir a mano (S4).
 */
const drawLabel = (
  page: PDFPage,
  slot: LabelSlot,
  content: LabelContent | null,
  fonts: { display: PDFFont; bold: PDFFont }
) => {
  const { display, bold } = fonts;
  const inkColor = color(TEXT_COLOR);

  page.drawRectangle({
    x: mm(slot.x),
    y: yFromTop(slot.y, LABEL_HEIGHT_MM),
    width: mm(LABEL_WIDTH_MM),
    height: mm(LABEL_HEIGHT_MM),
    color: color(LABEL_BACKGROUND_COLOR),
  });

  if (!content) return;
  const { code, price } = content;

  const boxX = slot.x + BOX_LEFT_MM;
  const boxWidthPt = mm(BOX_WIDTH_MM);

  // Caja del código.
  const codeBoxTop = slot.y + CODE_BOX_TOP_MM;
  drawRoundedRect(page, {
    x: mm(boxX),
    y: yFromTop(codeBoxTop, CODE_BOX_HEIGHT_MM),
    width: boxWidthPt,
    height: mm(CODE_BOX_HEIGHT_MM),
    radius: mm(CODE_BOX_RADIUS_MM),
    fill: color(BOX_COLOR),
  });

  const codeSize = fitFontSize(
    bold,
    code,
    boxWidthPt * CODE_MAX_WIDTH_RATIO,
    CODE_FONT_SIZE_PT
  );
  const codeWidth = bold.widthOfTextAtSize(code, codeSize);
  const codeAscent = bold.heightAtSize(codeSize, { descender: false });
  page.drawText(code, {
    x: mm(boxX) + (boxWidthPt - codeWidth) / 2,
    y: mm(SHEET_HEIGHT_MM - codeBoxTop) - (mm(CODE_BOX_HEIGHT_MM) + codeAscent) / 2,
    size: codeSize,
    font: bold,
    color: color(CODE_TEXT_COLOR),
  });

  // Caja del precio.
  const priceBoxTop = slot.y + PRICE_BOX_TOP_MM;
  drawRoundedRect(page, {
    x: mm(boxX),
    y: yFromTop(priceBoxTop, PRICE_BOX_HEIGHT_MM),
    width: boxWidthPt,
    height: mm(PRICE_BOX_HEIGHT_MM),
    radius: mm(PRICE_BOX_RADIUS_MM),
    fill: color(BOX_COLOR),
  });

  // `$` e importe comparten la línea de base, centrada en la caja.
  const amount = formatPrice(price);
  const dollarSize = DOLLAR_FONT_SIZE_PT;
  const dollarWidth = display.widthOfTextAtSize(CURRENCY_SYMBOL, dollarSize);
  const dollarX = mm(boxX) + mm(DOLLAR_INSET_MM);
  const amountMaxWidth =
    boxWidthPt - mm(DOLLAR_INSET_MM) - dollarWidth - mm(PRICE_GAP_MM) - mm(DOLLAR_INSET_MM);
  const amountSize = fitFontSize(bold, amount, amountMaxWidth, PRICE_FONT_SIZE_PT);
  const amountAscent = bold.heightAtSize(amountSize, { descender: false });
  const priceBaseline =
    mm(SHEET_HEIGHT_MM - priceBoxTop) - (mm(PRICE_BOX_HEIGHT_MM) + amountAscent) / 2;

  page.drawText(CURRENCY_SYMBOL, {
    x: dollarX,
    y: priceBaseline,
    size: dollarSize,
    font: display,
    color: inkColor,
  });

  page.drawText(amount, {
    x: dollarX + dollarWidth + mm(PRICE_GAP_MM),
    y: priceBaseline,
    size: amountSize,
    font: bold,
    color: color(PRICE_TEXT_COLOR),
  });

  // Handle debajo de la caja del precio, centrado y ajustado al 88 % del ancho.
  const handleSize = fitFontSize(display, HANDLE_TEXT, boxWidthPt * HANDLE_MAX_WIDTH_RATIO, Infinity);
  const handleWidth = display.widthOfTextAtSize(HANDLE_TEXT, handleSize);
  const handleAscent = display.heightAtSize(handleSize, { descender: false }) / MM_TO_PT;
  const handleHeight = display.heightAtSize(handleSize) / MM_TO_PT;
  // La banda libre va desde el pie de la caja del precio hasta el borde de la celda.
  const bandTop = slot.y + HANDLE_TOP_MM;
  const bandHeight = LABEL_HEIGHT_MM - HANDLE_TOP_MM;
  const handleBaseline = bandTop + (bandHeight - handleHeight) / 2 + handleAscent;
  page.drawText(HANDLE_TEXT, {
    x: mm(boxX) + (boxWidthPt - handleWidth) / 2,
    y: mm(SHEET_HEIGHT_MM - handleBaseline),
    size: handleSize,
    font: display,
    color: inkColor,
  });
};

/** `etiquetas-<código de sucursal>-<AAAAMMDD>.pdf` */
const buildLabelsFileName = (branchCode: string, date: Date) => {
  const yyyy = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `etiquetas-${branchCode}-${yyyy}${month}${day}.pdf`;
};

/** `comprobante-ingreso-<código de sucursal>-<AAAAMMDD>-etiquetas.pdf` */
const buildEntryReceiptFileName = (branchCode: string, date: string) =>
  `comprobante-ingreso-${branchCode}-${date.replace(/[^0-9]/g, '').slice(0, 8)}-etiquetas.pdf`;

/** Hojas de etiquetas como bytes: el comprobante de ingreso necesita las mismas. */
const renderLabelsPdf = async (
  labels: LabelContent[],
  fillLastSheet = false
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fonts = {
    display: await pdfDoc.embedFont(Buffer.from(SHRIKHAND_TTF_BASE64, 'base64')),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  // Con relleno la hoja va completa: las sobrantes salen vacías para escribir a mano (S4).
  const total = fillLastSheet
    ? calculateSheetCount(labels.length) * LABELS_PER_SHEET
    : labels.length;

  // Una página por hoja: las etiquetas de la última hoja quedan al principio.
  const pages = Array.from({ length: calculateSheetCount(total) }, () =>
    pdfDoc.addPage([mm(SHEET_WIDTH_MM), mm(SHEET_HEIGHT_MM)])
  );
  for (const slot of calculateLabelSlots(total)) {
    drawCutMarks(pages[slot.page], [slot]);
    drawLabel(pages[slot.page], slot, labels[slot.index] ?? null, fonts);
  }

  return pdfDoc.save();
};

type LabelSheetData = { branchCode: string; labels: LabelContent[] };

type Resolved<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Re-valida en el servidor lo que el wizard ya filtró: sucursal existente y que
 * cada producto esté **activo con stock > 0 en esa sucursal** (S6). Devuelve una
 * etiqueta por unidad pedida, en el orden de la selección.
 */
const resolveLabelSheets = async (
  branchId: number,
  selections: LabelSelection[]
): Promise<Resolved<LabelSheetData>> => {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { code: true },
  });
  if (!branch) {
    return { ok: false, error: 'Sucursal no encontrada' };
  }

  const productIds = [...new Set(selections.map((s) => s.productId))];
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      active: true,
      inventory: { some: { branchId, stock: { gt: 0 } } },
    },
    select: { id: true, code: true, price: true },
  });

  const byId = new Map(
    products.map((product) => [
      product.id,
      { code: product.code, price: Number(product.price) },
    ])
  );
  if (productIds.some((id) => !byId.has(id))) {
    return {
      ok: false,
      error: 'Hay productos inactivos o sin stock en la sucursal seleccionada',
    };
  }

  // Una etiqueta por unidad pedida, en el orden de la selección.
  const labels: LabelContent[] = [];
  for (const selection of selections) {
    const product = byId.get(selection.productId)!;
    for (let unit = 0; unit < selection.quantity; unit++) {
      labels.push(product);
    }
  }

  return { ok: true, data: { branchCode: branch.code, labels } };
};

/**
 * Genera el PDF de etiquetas de precio de una sucursal según la plantilla del
 * usuario (§S3): una página por hoja A4 horizontal con 72 etiquetas.
 *
 * Re-valida en el servidor lo que el wizard ya filtró: sucursal existente,
 * cantidad entre 1 y 999, al menos una selección y que cada producto esté
 * **activo con stock > 0 en esa sucursal** (S6).
 */
export async function generateProductLabels(data: unknown): Promise<GenerateLabelsResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { branchId, selections, fillLastSheet } = generateLabelsSchema.parse(data);

    const sheets = await resolveLabelSheets(branchId, selections);
    if (!sheets.ok) return { success: false, error: sheets.error };

    const pdfBytes = await renderLabelsPdf(sheets.data.labels, fillLastSheet);

    return {
      success: true,
      data: {
        pdfBase64: Buffer.from(pdfBytes).toString('base64'),
        filename: buildLabelsFileName(sheets.data.branchCode, new Date()),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((issue) => issue.message).join(', '),
      };
    }
    console.error('Error generating product labels:', error);
    return { success: false, error: 'Error al generar las etiquetas' };
  }
}

// --- Comprobante de un ingreso con sus etiquetas (S1, S2, S4, S5) -----------

export type GenerateEntryReceiptWithLabelsResult =
  | { success: true; data: { pdfBase64: string; filename: string } }
  | { success: false; error: string };

/** Snapshot del comprobante de un ingreso: lo único que se dibuja y etiqueta. */
const entryReceiptSchema = z.object({
  movementType: z.enum(['ENTRY', 'EXIT', 'TRANSFER']),
  branchId: z.number().int().positive('Sucursal inválida'),
  date: z.string().min(1, 'La fecha del comprobante es requerida'),
  branchName: z.string().min(1),
  branchCode: z.string().min(1),
  sourceBranchName: z.string().optional(),
  sourceBranchCode: z.string().optional(),
  reference: z.string(),
  rows: z
    .array(
      z.object({
        productId: z.number().int().positive('Producto inválido'),
        code: z.string(),
        name: z.string(),
        quantity: z.number().int().min(1, 'La cantidad mínima es 1'),
        stock: z.number(),
        price: z.number(),
        sourceStock: z.number().optional(),
      })
    )
    .min(1, 'El comprobante no tiene productos'),
});

/**
 * Un único PDF con el comprobante de un ingreso **y** las etiquetas de lo
 * ingresado (S2): primero las páginas del comprobante, después una hoja con una
 * etiqueta por unidad y la última rellena para escribir a mano (S4, S5).
 *
 * No vuelve a registrar nada (S6): re-lee lo confirmado y sólo dibuja.
 */
export async function generateEntryReceiptWithLabels(
  data: unknown
): Promise<GenerateEntryReceiptWithLabelsResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const receipt = entryReceiptSchema.parse(data);
    if (receipt.movementType !== 'ENTRY') {
      return { success: false, error: 'Solo el comprobante de un ingreso lleva etiquetas' };
    }

    const sheets = await resolveLabelSheets(
      receipt.branchId,
      receipt.rows.map((row) => ({ productId: row.productId, quantity: row.quantity }))
    );
    if (!sheets.ok) return { success: false, error: sheets.error };

    // Cada PDF embebe sus propias fuentes (Poppins en el comprobante, Shrikhand en
    // las etiquetas), así que el comprobante se dibuja primero y las hojas de
    // etiquetas se le copian como páginas: `copyPages` se lleva el recurso entero
    // y el texto de ambas partes sigue leyéndose (lo fija
    // `label-print.combined.test.ts` con el lector de PDFs).
    const pdf = await PDFDocument.load(await generateStockMovementPdf(receipt));
    const labelsPdf = await PDFDocument.load(await renderLabelsPdf(sheets.data.labels, true));
    for (const page of await pdf.copyPages(labelsPdf, labelsPdf.getPageIndices())) {
      pdf.addPage(page);
    }

    return {
      success: true,
      data: {
        pdfBase64: Buffer.from(await pdf.save()).toString('base64'),
        filename: buildEntryReceiptFileName(receipt.branchCode, receipt.date),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((issue) => issue.message).join(', '),
      };
    }
    console.error('Error generating entry receipt with labels:', error);
    return { success: false, error: 'Error al generar el comprobante con etiquetas' };
  }
}
