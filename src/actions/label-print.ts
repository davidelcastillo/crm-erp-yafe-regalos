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
import {
  BOX_COLOR,
  BOX_LEFT_MM,
  BOX_WIDTH_MM,
  CODE_BOX_HEIGHT_MM,
  CODE_BOX_RADIUS_MM,
  CODE_BOX_TOP_MM,
  CODE_FONT_SIZE_PT,
  CODE_MAX_WIDTH_RATIO,
  COLS_PER_SHEET,
  CURRENCY_SYMBOL,
  CUT_LINE_COLOR,
  CUT_LINE_WIDTH_MM,
  DOLLAR_FONT_SIZE_PT,
  DOLLAR_INSET_MM,
  HANDLE_MAX_WIDTH_RATIO,
  HANDLE_TEXT,
  HANDLE_TOP_MM,
  LABEL_BACKGROUND_COLOR,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  MM_TO_PT,
  PRICE_BOX_HEIGHT_MM,
  PRICE_BOX_RADIUS_MM,
  PRICE_BOX_TOP_MM,
  PRICE_FONT_SIZE_PT,
  PRICE_GAP_MM,
  ROWS_PER_SHEET,
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

/** Grilla de corte de la hoja: 9 × 8 celdas de 33 × 26,25 mm. */
const drawCutGrid = (page: PDFPage) => {
  const stroke = { color: color(CUT_LINE_COLOR), width: mm(CUT_LINE_WIDTH_MM) };

  for (let row = 0; row < ROWS_PER_SHEET; row++) {
    for (let col = 0; col < COLS_PER_SHEET; col++) {
      page.drawRectangle({
        x: mm(col * LABEL_WIDTH_MM),
        y: yFromTop(row * LABEL_HEIGHT_MM, LABEL_HEIGHT_MM),
        width: mm(LABEL_WIDTH_MM),
        height: mm(LABEL_HEIGHT_MM),
        borderColor: stroke.color,
        borderWidth: stroke.width,
      });
    }
  }
};

type LabelContent = { code: string; price: number };

/** Una etiqueta: fondo, cajas redondeadas y sus cuatro textos. */
const drawLabel = (
  page: PDFPage,
  slot: LabelSlot,
  { code, price }: LabelContent,
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

    const { branchId, selections } = generateLabelsSchema.parse(data);

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { code: true },
    });
    if (!branch) {
      return { success: false, error: 'Sucursal no encontrada' };
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
        success: false,
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

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fonts = {
      display: await pdfDoc.embedFont(Buffer.from(SHRIKHAND_TTF_BASE64, 'base64')),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    };

    // Una página por hoja: las etiquetas de la última hoja quedan al principio.
    const pages = Array.from({ length: calculateSheetCount(labels.length) }, () =>
      pdfDoc.addPage([mm(SHEET_WIDTH_MM), mm(SHEET_HEIGHT_MM)])
    );
    for (const page of pages) drawCutGrid(page);
    for (const slot of calculateLabelSlots(labels.length)) {
      drawLabel(pages[slot.page], slot, labels[slot.index], fonts);
    }

    const pdfBytes = await pdfDoc.save();

    return {
      success: true,
      data: {
        pdfBase64: Buffer.from(pdfBytes).toString('base64'),
        filename: buildLabelsFileName(branch.code, new Date()),
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
