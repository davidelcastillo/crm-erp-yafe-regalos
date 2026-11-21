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
import { drawBrandLogo } from '@/lib/utils/pdf-logo';
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
import {
  PRENDA_BRAND_TEXT,
  PRENDA_CODE_PREFIX,
  PRENDA_HOLE_FILL_COLOR,
  PRENDA_LABEL_BACKGROUND_COLOR,
  PRENDA_LABEL_BORDER_COLOR,
  PRENDA_LABEL_LAYOUTS,
  PRENDA_SHEET_HEIGHT_MM,
  PRENDA_SHEET_WIDTH_MM,
  PRENDA_TALLE_PREFIX,
  PRENDA_TEXT_COLOR,
  PRENDA_UNICA_COLOR,
  PRENDA_UNICA_TEXT,
  calculatePrendaLabelSlots,
  calculatePrendaSheetCount,
  type PrendaLabelLayout,
  type PrendaLabelSize,
  type PrendaLabelSlot,
} from '@/lib/label-prenda-layout';

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

// --- Etiquetas de prenda: dos tamaños, una etiqueta por talle (modelo del dueño) ---

export type PrendaLabelSelection = {
  productId: number;
  talle: string;
  quantity: number;
};

export type GeneratePrendaLabelsResult =
  | { success: true; data: { pdfBase64: string; filename: string } }
  | { success: false; error: string };

const generatePrendaLabelsSchema = z.object({
  selections: z
    .array(
      z.object({
        productId: z.number().int().positive('Prenda inválida'),
        talle: z.string().trim().min(1, 'Falta el talle'),
        quantity: z
          .number()
          .int()
          .min(1, 'La cantidad mínima es 1')
          .max(999, 'La cantidad máxima es 999'),
      })
    )
    .min(1, 'Seleccioná al menos un talle'),
  tamano: z.enum(['grande', 'mediana']),
});

/** Lo único que dibuja una etiqueta de prenda. */
type PrendaLabelContent = {
  code: string;
  talle: string;
  price: number;
  esUnica: boolean;
};

/** mm desde el borde superior de la hoja A4 vertical al borde inferior de pdf-lib. */
const prendaYFromTop = (topMm: number) => mm(PRENDA_SHEET_HEIGHT_MM - topMm);

/**
 * Texto centrado en la etiqueta, con su **borde superior** en `topMm`: así la
 * geometría del layout se lee de arriba abajo, igual que el modelo.
 */
const drawPrendaCenteredText = (
  page: PDFPage,
  {
    centerXMm,
    topMm,
    text,
    font,
    sizePt,
    maxWidthPt,
    fill,
  }: {
    centerXMm: number;
    topMm: number;
    text: string;
    font: PDFFont;
    sizePt: number;
    maxWidthPt: number;
    fill: ReturnType<typeof rgb>;
  }
) => {
  const size = fitFontSize(font, text, maxWidthPt, sizePt);
  const width = font.widthOfTextAtSize(text, size);
  const ascent = font.heightAtSize(size, { descender: false });
  page.drawText(text, {
    x: mm(centerXMm) - width / 2,
    y: prendaYFromTop(topMm) - ascent,
    size,
    font,
    color: fill,
  });
};

/**
 * Una etiqueta de prenda: borde cacao redondeado sobre fondo crema, agujero,
 * frutilla, «Polkalina's», Código / Talle / $ y «ÚNICA» al pie si la prenda es
 * única.
 */
const drawPrendaLabel = (
  page: PDFPage,
  layout: PrendaLabelLayout,
  slot: PrendaLabelSlot,
  content: PrendaLabelContent,
  fonts: { display: PDFFont; regular: PDFFont; bold: PDFFont }
) => {
  const x = mm(slot.x);
  const bottom = prendaYFromTop(slot.y + layout.heightMm);
  const widthPt = mm(layout.widthMm);
  const heightPt = mm(layout.heightMm);

  // Borde cacao: un rectángulo redondeado cacao y el fondo crema encima.
  drawRoundedRect(page, {
    x,
    y: bottom,
    width: widthPt,
    height: heightPt,
    radius: mm(layout.cornerRadiusMm),
    fill: color(PRENDA_LABEL_BORDER_COLOR),
  });
  const border = mm(layout.borderWidthMm);
  drawRoundedRect(page, {
    x: x + border,
    y: bottom + border,
    width: widthPt - 2 * border,
    height: heightPt - 2 * border,
    radius: mm(layout.cornerRadiusMm) - border,
    fill: color(PRENDA_LABEL_BACKGROUND_COLOR),
  });

  const centerXMm = slot.x + layout.widthMm / 2;
  const ink = color(PRENDA_TEXT_COLOR);
  const maxWidthPt = mm(layout.widthMm - 2 * layout.contentPaddingMm);

  const text = (topMm: number, value: string, font: PDFFont, sizePt: number) =>
    drawPrendaCenteredText(page, {
      centerXMm,
      topMm,
      text: value,
      font,
      sizePt,
      maxWidthPt,
      fill: ink,
    });

  // Agujero troquelado, arriba y centrado.
  page.drawCircle({
    x: mm(centerXMm),
    y: prendaYFromTop(slot.y + layout.holeCenterTopMm),
    size: mm(layout.holeRadiusMm),
    color: color(PRENDA_HOLE_FILL_COLOR),
    borderColor: color(PRENDA_LABEL_BORDER_COLOR),
    borderWidth: mm(0.3),
  });

  drawBrandLogo(page, {
    x: mm(centerXMm - layout.logoSizeMm / 2),
    y: prendaYFromTop(slot.y + layout.logoTopMm),
    size: mm(layout.logoSizeMm),
  });

  drawPrendaCenteredText(page, {
    centerXMm,
    topMm: slot.y + layout.brandTopMm,
    text: PRENDA_BRAND_TEXT,
    font: fonts.display,
    sizePt: layout.brandFontSizePt,
    maxWidthPt: mm(layout.brandMaxWidthMm),
    fill: ink,
  });

  text(slot.y + layout.codeTopMm, PRENDA_CODE_PREFIX + content.code, fonts.regular, layout.lineFontSizePt);
  text(slot.y + layout.talleTopMm, PRENDA_TALLE_PREFIX + content.talle, fonts.regular, layout.lineFontSizePt);
  text(
    slot.y + layout.priceTopMm,
    `${CURRENCY_SYMBOL} ${formatPrice(content.price)}`,
    fonts.bold,
    layout.priceFontSizePt
  );

  if (content.esUnica) {
    drawPrendaCenteredText(page, {
      centerXMm,
      topMm: slot.y + layout.unicaTopMm,
      text: PRENDA_UNICA_TEXT,
      font: fonts.bold,
      sizePt: layout.unicaFontSizePt,
      maxWidthPt,
      fill: color(PRENDA_UNICA_COLOR),
    });
  }
};

/** Hojas A4 verticales con una etiqueta de prenda por unidad pedida. */
const renderPrendaLabelsPdf = async (
  labels: PrendaLabelContent[],
  tamano: PrendaLabelSize
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fonts = {
    display: await pdfDoc.embedFont(Buffer.from(SHRIKHAND_TTF_BASE64, 'base64')),
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const layout = PRENDA_LABEL_LAYOUTS[tamano];
  const pages = Array.from(
    { length: calculatePrendaSheetCount(tamano, labels.length) },
    () => pdfDoc.addPage([mm(PRENDA_SHEET_WIDTH_MM), mm(PRENDA_SHEET_HEIGHT_MM)])
  );

  for (const slot of calculatePrendaLabelSlots(tamano, labels.length)) {
    drawPrendaLabel(pages[slot.page], layout, slot, labels[slot.index], fonts);
  }

  return pdfDoc.save();
};

/** `etiquetas-prenda-<código o «varias»>-<tamaño>-<AAAAMMDD>.pdf` */
const buildPrendaLabelsFileName = (code: string, tamano: PrendaLabelSize, date: Date) => {
  const yyyy = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `etiquetas-prenda-${code}-${tamano}-${yyyy}${month}${day}.pdf`;
};

/**
 * Re-lee las prendas del servidor y arma una etiqueta por unidad pedida. Un
 * talle que no pertenece a la prenda se rechaza: la selección viene del cliente.
 */
const resolvePrendaLabels = async (
  selections: PrendaLabelSelection[]
): Promise<Resolved<{ code: string; labels: PrendaLabelContent[] }>> => {
  const productIds = [...new Set(selections.map((selection) => selection.productId))];
  const prendas = await prisma.product.findMany({
    where: { id: { in: productIds }, kind: 'PRENDA' },
    select: {
      id: true,
      code: true,
      price: true,
      prenda: { select: { esUnica: true, talles: { select: { talle: true } } } },
    },
  });

  const byId = new Map(prendas.map((prenda) => [prenda.id, prenda]));
  const labels: PrendaLabelContent[] = [];

  for (const selection of selections) {
    const prenda = byId.get(selection.productId);
    if (!prenda?.prenda) {
      return { ok: false, error: 'Prenda no encontrada' };
    }
    if (!prenda.prenda.talles.some((fila) => fila.talle === selection.talle)) {
      return {
        ok: false,
        error: `El talle «${selection.talle}» no pertenece a la prenda ${prenda.code}`,
      };
    }

    const content = {
      code: prenda.code,
      talle: selection.talle,
      price: Number(prenda.price),
      esUnica: prenda.prenda.esUnica,
    };
    for (let unit = 0; unit < selection.quantity; unit++) {
      labels.push(content);
    }
  }

  return {
    ok: true,
    data: {
      code: productIds.length === 1 ? byId.get(productIds[0])!.code : 'varias',
      labels,
    },
  };
};

/**
 * Etiquetas de prenda para imprimir: hoja A4 vertical con la misma etiqueta
 * repetida, en el tamaño elegido (grande 50 × 80 mm o mediana 35 × 58 mm).
 *
 * Una etiqueta por unidad de cada talle, con los datos re-leídos de la base; un
 * talle que no es de la prenda se rechaza.
 */
export async function generatePrendaLabels(
  data: unknown
): Promise<GeneratePrendaLabelsResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { selections, tamano } = generatePrendaLabelsSchema.parse(data);

    const resolved = await resolvePrendaLabels(selections);
    if (!resolved.ok) return { success: false, error: resolved.error };

    const pdfBytes = await renderPrendaLabelsPdf(resolved.data.labels, tamano);

    return {
      success: true,
      data: {
        pdfBase64: Buffer.from(pdfBytes).toString('base64'),
        filename: buildPrendaLabelsFileName(resolved.data.code, tamano, new Date()),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((issue) => issue.message).join(', '),
      };
    }
    console.error('Error generating prenda labels:', error);
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
