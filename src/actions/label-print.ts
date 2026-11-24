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
  AMOUNT_MIN_FONT_SIZE_PT,
  BOX_BORDER_COLOR,
  BOX_BORDER_WIDTH_MM,
  BOX_COLOR,
  BOX_LEFT_MM,
  BOX_WIDTH_MM,
  CODE_BOX_HEIGHT_MM,
  CODE_BOX_RADIUS_MM,
  CODE_BOX_TOP_MM,
  CODE_FONT_SIZE_PT,
  CODE_MAX_WIDTH_RATIO,
  CODE_MIN_FONT_SIZE_PT,
  CURRENCY_SYMBOL,
  CUT_MARK_COLOR,
  CUT_MARK_WIDTH_MM,
  cutMarksForSlot,
  DOLLAR_FONT_SIZE_PT,
  DOLLAR_INSET_MM,
  HANDLE_INK_ASCENT_EM,
  HANDLE_MAX_HEIGHT_RATIO,
  HANDLE_MAX_WIDTH_RATIO,
  HANDLE_MIN_FONT_SIZE_PT,
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
  formatPriceLines,
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
  PRENDA_VARIANTE_PREFIX,
  calculatePrendaLabelSlots,
  calculatePrendaSheetCount,
  prendaTextTops,
  type PrendaLabelLayout,
  type PrendaLabelSize,
  type PrendaLabelSlot,
} from '@/lib/label-prenda-layout';
import {
  CHICA_BORDER_WIDTH_MM,
  CHICA_BRAND_FONT_SIZE_PT,
  CHICA_BRAND_MAX_WIDTH_MM,
  CHICA_BRAND_TOP_MM,
  CHICA_CODE_FONT_SIZE_PT,
  CHICA_CODE_PREFIX,
  CHICA_CODE_TOP_MM,
  CHICA_CORNER_RADIUS_MM,
  CHICA_HOLE_BORDER_WIDTH_MM,
  CHICA_HOLE_CENTER_TOP_MM,
  CHICA_HOLE_COLOR,
  CHICA_HOLE_RADIUS_MM,
  CHICA_LABEL_BACKGROUND_COLOR,
  CHICA_LABEL_BORDER_COLOR,
  CHICA_LABEL_HEIGHT_MM,
  CHICA_LABEL_WIDTH_MM,
  CHICA_LOGO_SIZE_MM,
  CHICA_LOGO_TOP_MM,
  CHICA_PRICE_FONT_SIZE_PT,
  CHICA_PRICE_MAX_WIDTH_MM,
  CHICA_PRICE_TEXT_COLOR,
  CHICA_PRICE_TOP_MM,
  CHICA_SHEET_HEIGHT_MM,
  CHICA_SHEET_WIDTH_MM,
  CHICA_TEXT_COLOR,
  calculateChicaLabelSlots,
  calculateChicaSheetCount,
  type ChicaLabelSlot,
} from '@/lib/label-chica-layout';

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

/**
 * Lo que el wizard pregunta cuando detecta prendas: el tamaño de la etiqueta de
 * prenda y cuáles de los productos elegidos son peluches.
 */
export type LabelPrintOptions = {
  /** Tamaño de la etiqueta de prenda; obligatorio si la selección trae prendas. */
  prendaTamano?: PrendaLabelSize;
  /** Productos de la selección marcados como peluche: salen con la etiqueta chica. */
  pelucheIds?: number[];
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
  prendaTamano: z.enum(['grande', 'mediana']).optional(),
  pelucheIds: z.array(z.number().int().positive()).optional(),
});

const mm = (value: number) => value * MM_TO_PT;

const color = (hex: string) =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255
  );

/**
 * Tamaño de fuente que entra en `maxWidthPt` sin pasar `maxSizePt` ni bajar de
 * `minSizePt`: el más chico entre el tamaño base y el que ocupa exactamente el
 * ancho disponible.
 */
const fitFontSize = (
  font: PDFFont,
  text: string,
  maxWidthPt: number,
  maxSizePt: number,
  minSizePt = 0
) =>
  Math.max(
    Math.min(minSizePt, maxSizePt),
    Math.min(maxSizePt, maxWidthPt / Math.max(font.widthOfTextAtSize(text, 1), 1e-6))
  );

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
 * por dónde entrar (S2). La geometría de los ticks vive en `label-layout`; el
 * alto de hoja se pasa porque la etiqueta del peluche va en A4 vertical.
 */
const drawCutMarks = (
  page: PDFPage,
  slots: LabelSlot[],
  size?: { widthMm: number; heightMm: number },
  sheetHeightMm: number = SHEET_HEIGHT_MM
) => {
  const stroke = { color: color(CUT_MARK_COLOR), width: mm(CUT_MARK_WIDTH_MM) };

  for (const slot of slots) {
    for (const mark of cutMarksForSlot(slot, size)) {
      page.drawLine({
        start: { x: mm(mark.x1), y: mm(sheetHeightMm - mark.y1) },
        end: { x: mm(mark.x2), y: mm(sheetHeightMm - mark.y2) },
        color: stroke.color,
        thickness: stroke.width,
      });
    }
  }
};

type LabelContent = { code: string; price: number };

/**
 * Caja redondeada de la etiqueta: el rosa de la marca con un borde cacao fino
 * (el relleno rosa solo desentonaba al imprimir).
 */
const drawLabelBox = (
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number; radius: number }
) => {
  drawRoundedRect(page, { ...box, fill: color(BOX_BORDER_COLOR) });

  const border = mm(BOX_BORDER_WIDTH_MM);
  drawRoundedRect(page, {
    x: box.x + border,
    y: box.y + border,
    width: box.width - 2 * border,
    height: box.height - 2 * border,
    radius: box.radius - border,
    fill: color(BOX_COLOR),
  });
};

/**
 * Una etiqueta: fondo, cajas redondeadas y sus textos (código, `$`, importe y
 * handle; el importe se parte en dos líneas si no entra en una). Sin contenido
 * se dibuja solo el fondo crema, que es el relleno para escribir a mano (S4).
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
  drawLabelBox(page, {
    x: mm(boxX),
    y: yFromTop(codeBoxTop, CODE_BOX_HEIGHT_MM),
    width: boxWidthPt,
    height: mm(CODE_BOX_HEIGHT_MM),
    radius: mm(CODE_BOX_RADIUS_MM),
  });

  const codeSize = fitFontSize(
    bold,
    code,
    boxWidthPt * CODE_MAX_WIDTH_RATIO,
    CODE_FONT_SIZE_PT,
    CODE_MIN_FONT_SIZE_PT
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

  // Caja del precio: el mismo rosa de la marca, con su borde cacao.
  const priceBoxTop = slot.y + PRICE_BOX_TOP_MM;
  drawLabelBox(page, {
    x: mm(boxX),
    y: yFromTop(priceBoxTop, PRICE_BOX_HEIGHT_MM),
    width: boxWidthPt,
    height: mm(PRICE_BOX_HEIGHT_MM),
    radius: mm(PRICE_BOX_RADIUS_MM),
  });

  // `$` e importe comparten la línea de base, centrada en la caja.
  const amount = formatPrice(price);
  const dollarSize = DOLLAR_FONT_SIZE_PT;
  const dollarWidth = display.widthOfTextAtSize(CURRENCY_SYMBOL, dollarSize);
  const dollarX = mm(boxX) + mm(DOLLAR_INSET_MM);
  const amountMaxWidth =
    boxWidthPt - mm(DOLLAR_INSET_MM) - dollarWidth - mm(PRICE_GAP_MM) - mm(DOLLAR_INSET_MM);
  const priceCenterY = yFromTop(priceBoxTop, PRICE_BOX_HEIGHT_MM) + mm(PRICE_BOX_HEIGHT_MM) / 2;

  // Al mínimo legible el importe todavía tiene que entrar: si no, se parte en
  // dos líneas (entero y centavos) antes que achicarlo más o recortarlo.
  const oneLineSize = fitFontSize(bold, amount, amountMaxWidth, PRICE_FONT_SIZE_PT);
  let amountLines = [amount];
  let amountSize = Math.max(AMOUNT_MIN_FONT_SIZE_PT, oneLineSize);
  if (oneLineSize < AMOUNT_MIN_FONT_SIZE_PT) {
    amountLines = formatPriceLines(price);
    amountSize = Math.min(
      ...amountLines.map((line) =>
        fitFontSize(bold, line, amountMaxWidth, PRICE_FONT_SIZE_PT, AMOUNT_MIN_FONT_SIZE_PT)
      )
    );
    // shortcut: el entero partido entra hasta diez cifras; de ahí para arriba
    // no habría más salida que recortar, fuera del rango de la tienda.
  }

  const amountAscent = bold.heightAtSize(amountSize, { descender: false });
  const amountBaselines =
    amountLines.length === 1
      ? [priceCenterY - amountAscent / 2]
      : [priceCenterY + amountSize * 0.55, priceCenterY - amountSize * 0.55];

  page.drawText(CURRENCY_SYMBOL, {
    x: dollarX,
    y: amountBaselines[0],
    size: dollarSize,
    font: display,
    color: inkColor,
  });

  amountLines.forEach((line, lineIndex) => {
    page.drawText(line, {
      x: dollarX + dollarWidth + mm(PRICE_GAP_MM),
      y: amountBaselines[lineIndex],
      size: amountSize,
      font: bold,
      color: color(PRICE_TEXT_COLOR),
    });
  });

  // Handle debajo de la caja del precio, centrado en el ancho útil. Shrikhand
  // declara 1,458 em de alto de línea contra 0,75 em de tinta: se centra la
  // tinta dentro de la banda, o el handle se come la caja del precio y el pie
  // de la etiqueta.
  const handleBandPt = mm(LABEL_HEIGHT_MM - HANDLE_TOP_MM);
  const handleSize = fitFontSize(
    display,
    HANDLE_TEXT,
    boxWidthPt * HANDLE_MAX_WIDTH_RATIO,
    (handleBandPt * HANDLE_MAX_HEIGHT_RATIO) / HANDLE_INK_ASCENT_EM,
    HANDLE_MIN_FONT_SIZE_PT
  );
  const handleWidth = display.widthOfTextAtSize(HANDLE_TEXT, handleSize);
  const handleInkHeightMm = (handleSize * HANDLE_INK_ASCENT_EM) / MM_TO_PT;
  const handleBaselineMm =
    slot.y +
    HANDLE_TOP_MM +
    (LABEL_HEIGHT_MM - HANDLE_TOP_MM - handleInkHeightMm) / 2 +
    handleInkHeightMm;
  page.drawText(HANDLE_TEXT, {
    x: mm(boxX) + (boxWidthPt - handleWidth) / 2,
    y: mm(SHEET_HEIGHT_MM - handleBaselineMm),
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
 * `comprobante-<ingreso|egreso|traslado-destino>-<código>-<AAAAMMDD>-etiquetas.pdf`.
 * El traslado va por el lado que recibe, que es el comprobante que se dibuja.
 */
const buildReceiptWithLabelsFileName = (
  movementType: 'ENTRY' | 'EXIT' | 'TRANSFER',
  branchCode: string,
  date: string
) => {
  const kind = { ENTRY: 'ingreso', EXIT: 'egreso', TRANSFER: 'traslado-destino' }[movementType];
  return `comprobante-${kind}-${branchCode}-${date.replace(/[^0-9]/g, '').slice(0, 8)}-etiquetas.pdf`;
};

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

type Resolved<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * La selección ya resuelta y separada por tipo: las prendas van con la etiqueta
 * de prenda (una por talle), los peluches con la chica y el resto con la de
 * producto. Cada grupo sale en sus propias hojas, en ese orden.
 */
type ResolvedLabels = {
  branchCode: string;
  products: LabelContent[];
  prendas: PrendaLabelContent[];
  chicas: LabelContent[];
};

/**
 * Re-valida en el servidor lo que el wizard ya filtró: sucursal existente y que
 * cada producto esté **activo con stock > 0 en esa sucursal** (S6). Separa las
 * prendas (`kind`, nunca el prefijo del código) de los peluches marcados y del
 * resto de los productos.
 */
const resolveLabelSheets = async (
  branchId: number,
  selections: LabelSelection[],
  options: LabelPrintOptions = {}
): Promise<Resolved<ResolvedLabels>> => {
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

  // Qué es prenda lo dice `kind`. Va en su propia consulta para no cambiar la
  // proyección con la que ya se valida el stock de la sucursal.
  const prendaRows = await prisma.product.findMany({
    where: { id: { in: productIds }, kind: 'PRENDA' },
    select: {
      id: true,
      kind: true,
      prenda: {
        select: { esUnica: true, talles: { select: { talle: true, variante: true } } },
      },
    },
  });
  const prendasById = new Map(
    prendaRows.filter((row) => row.kind === 'PRENDA').map((row) => [row.id, row])
  );
  const pelucheIds = new Set(options.pelucheIds ?? []);

  const resolved: ResolvedLabels = {
    branchCode: branch.code,
    products: [],
    prendas: [],
    chicas: [],
  };

  for (const selection of selections) {
    const product = byId.get(selection.productId)!;
    const prenda = prendasById.get(selection.productId);

    if (prenda) {
      // Un peluche que además es prenda sigue siendo prenda: la ropa lleva talle.
      const talles = prenda.prenda?.talles ?? [];
      if (talles.length === 0) {
        return {
          ok: false,
          error: `La prenda ${product.code} no tiene talles cargados`,
        };
      }
      // Una etiqueta por combinación (talle + variante) y por unidad.
      for (const fila of talles) {
        for (let unit = 0; unit < selection.quantity; unit++) {
          resolved.prendas.push({
            code: product.code,
            price: product.price,
            talle: fila.talle,
            ...(fila.variante ? { variante: fila.variante } : {}),
            esUnica: prenda.prenda!.esUnica,
          });
        }
      }
      continue;
    }

    for (let unit = 0; unit < selection.quantity; unit++) {
      if (pelucheIds.has(selection.productId)) {
        resolved.chicas.push(product);
      } else {
        resolved.products.push(product);
      }
    }
  }

  if (resolved.prendas.length > 0 && !options.prendaTamano) {
    return { ok: false, error: 'Elegí el tamaño de las etiquetas de prenda' };
  }

  return { ok: true, data: resolved };
};

/** mm desde el borde superior de la hoja A4 vertical del peluche. */
const chicaYFromTop = (topMm: number) => mm(CHICA_SHEET_HEIGHT_MM - topMm);

/**
 * Texto centrado en la etiqueta del peluche, con su **borde superior** en `topMm`.
 */
const drawChicaCenteredText = (
  page: PDFPage,
  {
    slot,
    topMm,
    text,
    font,
    sizePt,
    maxWidthMm,
    fill,
  }: {
    slot: ChicaLabelSlot;
    topMm: number;
    text: string;
    font: PDFFont;
    sizePt: number;
    maxWidthMm: number;
    fill: ReturnType<typeof rgb>;
  }
) => {
  const centerX = mm(slot.x + CHICA_LABEL_WIDTH_MM / 2);
  const size = fitFontSize(font, text, mm(maxWidthMm), sizePt);
  page.drawText(text, {
    x: centerX - font.widthOfTextAtSize(text, size) / 2,
    y: chicaYFromTop(topMm) - font.heightAtSize(size, { descender: false }),
    size,
    font,
    color: fill,
  });
};

/**
 * Una etiqueta de peluche (modelo del dueño): vertical, borde cacao redondeado
 * sobre fondo crema, agujero troquelado con aro rosa, frutilla, «Polkalina's»,
 * la línea Código y el `$` con el importe en frutilla.
 */
const drawChicaLabel = (
  page: PDFPage,
  slot: ChicaLabelSlot,
  content: LabelContent,
  fonts: { display: PDFFont; regular: PDFFont; bold: PDFFont }
) => {
  const { display, regular, bold } = fonts;
  const ink = color(CHICA_TEXT_COLOR);
  const x = mm(slot.x);
  const bottom = chicaYFromTop(slot.y + CHICA_LABEL_HEIGHT_MM);
  const widthPt = mm(CHICA_LABEL_WIDTH_MM);
  const heightPt = mm(CHICA_LABEL_HEIGHT_MM);

  // Borde cacao: un rectángulo redondeado cacao y el fondo crema encima.
  drawRoundedRect(page, {
    x,
    y: bottom,
    width: widthPt,
    height: heightPt,
    radius: mm(CHICA_CORNER_RADIUS_MM),
    fill: color(CHICA_LABEL_BORDER_COLOR),
  });
  const border = mm(CHICA_BORDER_WIDTH_MM);
  drawRoundedRect(page, {
    x: x + border,
    y: bottom + border,
    width: widthPt - 2 * border,
    height: heightPt - 2 * border,
    radius: mm(CHICA_CORNER_RADIUS_MM) - border,
    fill: color(CHICA_LABEL_BACKGROUND_COLOR),
  });

  const centerXMm = slot.x + CHICA_LABEL_WIDTH_MM / 2;

  // Agujero troquelado: aro rosa de la marca sobre el crema del fondo.
  page.drawCircle({
    x: mm(centerXMm),
    y: chicaYFromTop(slot.y + CHICA_HOLE_CENTER_TOP_MM),
    size: mm(CHICA_HOLE_RADIUS_MM),
    borderColor: color(CHICA_HOLE_COLOR),
    borderWidth: mm(CHICA_HOLE_BORDER_WIDTH_MM),
  });

  drawBrandLogo(page, {
    x: mm(centerXMm - CHICA_LOGO_SIZE_MM / 2),
    y: chicaYFromTop(slot.y + CHICA_LOGO_TOP_MM),
    size: mm(CHICA_LOGO_SIZE_MM),
  });

  drawChicaCenteredText(page, {
    slot,
    topMm: slot.y + CHICA_BRAND_TOP_MM,
    text: HANDLE_TEXT,
    font: display,
    sizePt: CHICA_BRAND_FONT_SIZE_PT,
    maxWidthMm: CHICA_BRAND_MAX_WIDTH_MM,
    fill: ink,
  });

  // En vertical hay alto para el código, que la versión apaisada no tenía.
  drawChicaCenteredText(page, {
    slot,
    topMm: slot.y + CHICA_CODE_TOP_MM,
    text: CHICA_CODE_PREFIX + content.code,
    font: regular,
    sizePt: CHICA_CODE_FONT_SIZE_PT,
    maxWidthMm: CHICA_PRICE_MAX_WIDTH_MM,
    fill: ink,
  });

  // El precio, en frutilla: lo que se lee a un metro del peluche.
  drawChicaCenteredText(page, {
    slot,
    topMm: slot.y + CHICA_PRICE_TOP_MM,
    text: `${CURRENCY_SYMBOL} ${formatPrice(content.price)}`,
    font: bold,
    sizePt: CHICA_PRICE_FONT_SIZE_PT,
    maxWidthMm: CHICA_PRICE_MAX_WIDTH_MM,
    fill: color(CHICA_PRICE_TEXT_COLOR),
  });
};

/** Hojas A4 verticales con las etiquetas de los peluches. */
const renderChicaLabelsPdf = async (labels: LabelContent[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fonts = {
    display: await pdfDoc.embedFont(Buffer.from(SHRIKHAND_TTF_BASE64, 'base64')),
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const pages = Array.from(
    { length: calculateChicaSheetCount(labels.length) },
    () => pdfDoc.addPage([mm(CHICA_SHEET_WIDTH_MM), mm(CHICA_SHEET_HEIGHT_MM)])
  );
  for (const slot of calculateChicaLabelSlots(labels.length)) {
    drawCutMarks(
      pages[slot.page],
      [slot],
      { widthMm: CHICA_LABEL_WIDTH_MM, heightMm: CHICA_LABEL_HEIGHT_MM },
      CHICA_SHEET_HEIGHT_MM
    );
    drawChicaLabel(pages[slot.page], slot, labels[slot.index], fonts);
  }

  return pdfDoc.save();
};

/**
 * Hojas de la selección, en el orden en que se imprimen: primero las etiquetas
 * de producto, después las de prenda y al final las chicas de peluche. Cada
 * grupo va en sus propias hojas porque cambia la medida.
 */
const renderLabelParts = async (
  labels: ResolvedLabels,
  options: LabelPrintOptions & { fillLastSheet?: boolean }
): Promise<Uint8Array[]> => {
  const parts: Uint8Array[] = [];

  if (labels.products.length > 0) {
    parts.push(await renderLabelsPdf(labels.products, options.fillLastSheet));
  }
  if (labels.prendas.length > 0 && options.prendaTamano) {
    parts.push(await renderPrendaLabelsPdf(labels.prendas, options.prendaTamano));
  }
  if (labels.chicas.length > 0) {
    parts.push(await renderChicaLabelsPdf(labels.chicas));
  }

  return parts;
};

/** Un solo PDF con las hojas de cada tipo, en orden (mismo criterio que S2). */
const mergePdfParts = async (parts: Uint8Array[]): Promise<Uint8Array> => {
  const [first, ...rest] = parts;
  if (rest.length === 0) return first;

  const pdf = await PDFDocument.load(first);
  for (const part of rest) {
    const doc = await PDFDocument.load(part);
    for (const page of await pdf.copyPages(doc, doc.getPageIndices())) {
      pdf.addPage(page);
    }
  }

  return pdf.save();
};

/**
 * Genera el PDF de etiquetas de precio de una sucursal según la plantilla del
 * usuario (§S3): una página por hoja A4 horizontal con 72 etiquetas.
 *
 * Re-valida en el servidor lo que el wizard ya filtró: sucursal existente,
 * cantidad entre 1 y 999, al menos una selección y que cada producto esté
 * **activo con stock > 0 en esa sucursal** (S6). Las prendas salen con su propia
 * etiqueta en el tamaño elegido y los peluches marcados con la etiqueta chica.
 */
export async function generateProductLabels(data: unknown): Promise<GenerateLabelsResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { branchId, selections, fillLastSheet, prendaTamano, pelucheIds } =
      generateLabelsSchema.parse(data);

    const sheets = await resolveLabelSheets(branchId, selections, {
      prendaTamano,
      pelucheIds,
    });
    if (!sheets.ok) return { success: false, error: sheets.error };

    const parts = await renderLabelParts(sheets.data, { fillLastSheet, prendaTamano });
    if (parts.length === 0) {
      return { success: false, error: 'No hay etiquetas para imprimir' };
    }
    const pdfBytes = await mergePdfParts(parts);

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

// --- Detección: qué de la selección es prenda ----------------------------

export type DetectPrendaResult =
  | { success: true; data: { prendaIds: number[] } }
  | { success: false; error: string };

const detectPrendaSchema = z.object({
  productIds: z
    .array(z.number().int().positive('Producto inválido'))
    .min(1, 'Seleccioná al menos un producto'),
});

/**
 * Qué de la selección es **prenda**, para que el wizard pregunte el tamaño (y los
 * peluches) antes de generar. La decisión es `kind`, nunca el prefijo del código:
 * así RP/RPI/RPH no quedan hardcodeados acá.
 */
export async function detectPrendaProducts(data: unknown): Promise<DetectPrendaResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const { productIds } = detectPrendaSchema.parse(data);

    const rows = await prisma.product.findMany({
      where: { id: { in: [...new Set(productIds)] }, kind: 'PRENDA' },
      select: { id: true, kind: true },
    });

    return {
      success: true,
      data: {
        prendaIds: rows.filter((row) => row.kind === 'PRENDA').map((row) => row.id),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((issue) => issue.message).join(', '),
      };
    }
    console.error('Error detecting prenda products:', error);
    return { success: false, error: 'Error al detectar las prendas' };
  }
}

// --- Etiquetas de prenda: dos tamaños, una etiqueta por talle + variante (modelo del dueño) ---

export type PrendaLabelSelection = {
  productId: number;
  talle: string;
  /** Vacía o ausente = la combinación sin variante de ese talle. */
  variante?: string;
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
        variante: z.string().trim().optional(),
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
  /** Sin variante la línea no se dibuja. */
  variante?: string;
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
  const tops = prendaTextTops(layout, Boolean(content.variante));

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

  text(slot.y + tops.code, PRENDA_CODE_PREFIX + content.code, fonts.regular, layout.lineFontSizePt);
  text(slot.y + tops.talle, PRENDA_TALLE_PREFIX + content.talle, fonts.regular, layout.lineFontSizePt);
  if (tops.variante !== null) {
    text(
      slot.y + tops.variante,
      PRENDA_VARIANTE_PREFIX + content.variante,
      fonts.regular,
      layout.lineFontSizePt
    );
  }
  text(
    slot.y + tops.price,
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

/** `etiquetas-prenda-<código o «varias»>-<tamaño>-<AAAAMMDD>.pdf` */const buildPrendaLabelsFileName = (code: string, tamano: PrendaLabelSize, date: Date) => {
  const yyyy = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `etiquetas-prenda-${code}-${tamano}-${yyyy}${month}${day}.pdf`;
};

/**
 * Re-lee las prendas del servidor y arma una etiqueta por unidad pedida. Un
 * talle —o una variante de ese talle— que no pertenece a la prenda se rechaza: la
 * selección viene del cliente.
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
      prenda: {
        select: { esUnica: true, talles: { select: { talle: true, variante: true } } },
      },
    },
  });

  const byId = new Map(prendas.map((prenda) => [prenda.id, prenda]));
  const labels: PrendaLabelContent[] = [];

  for (const selection of selections) {
    const prenda = byId.get(selection.productId);
    if (!prenda?.prenda) {
      return { ok: false, error: 'Prenda no encontrada' };
    }

    const talles = prenda.prenda.talles;
    if (!talles.some((fila) => fila.talle === selection.talle)) {
      return {
        ok: false,
        error: `El talle «${selection.talle}» no pertenece a la prenda ${prenda.code}`,
      };
    }

    // Sin variante no se exige combinación: la etiqueta sale con el talle solo.
    const variante = selection.variante?.trim() ?? '';
    if (
      variante !== '' &&
      !talles.some((fila) => fila.talle === selection.talle && fila.variante === variante)
    ) {
      return {
        ok: false,
        error: `La variante «${variante}» no pertenece al talle «${selection.talle}» de la prenda ${prenda.code}`,
      };
    }

    const content = {
      code: prenda.code,
      talle: selection.talle,
      ...(variante !== '' ? { variante } : {}),
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
 * Una etiqueta por unidad de cada combinación talle + variante, con los datos
 * re-leídos de la base; un talle o una variante que no son de la prenda se
 * rechazan.
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

/** Snapshot del comprobante de un movimiento: lo único que se dibuja y etiqueta. */
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
  /** Paso extra del wizard: tamaño de la etiqueta de prenda si el ingreso trae ropa. */
  prendaTamano: z.enum(['grande', 'mediana']).optional(),
  /** Paso extra del wizard: cuáles de lo ingresado son peluches. */
  pelucheIds: z.array(z.number().int().positive()).optional(),
});

/**
 * Un único PDF con el comprobante de un movimiento **y** las etiquetas de lo que
 * se movió (S2): primero las páginas del comprobante, después una hoja con una
 * etiqueta por unidad y la última rellena para escribir a mano (S4, S5).
 *
 * Vale para el ingreso, el egreso y el traslado (lado que recibe, que es el
 * comprobante que dibuja el PDF). No vuelve a registrar nada (S6): re-lee lo
 * confirmado y sólo dibuja.
 */
export async function generateEntryReceiptWithLabels(
  data: unknown
): Promise<GenerateEntryReceiptWithLabelsResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false as const, error: auth.error };

    const receipt = entryReceiptSchema.parse(data);

    const sheets = await resolveLabelSheets(
      receipt.branchId,
      receipt.rows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
      { prendaTamano: receipt.prendaTamano, pelucheIds: receipt.pelucheIds }
    );
    if (!sheets.ok) return { success: false, error: sheets.error };

    // Cada PDF embebe sus propias fuentes (Poppins en el comprobante, Shrikhand en
    // las etiquetas), así que el comprobante se dibuja primero y las hojas de
    // etiquetas se le copian como páginas: `copyPages` se lleva el recurso entero
    // y el texto de ambas partes sigue leyéndose (lo fija
    // `label-print.combined.test.ts` con el lector de PDFs).
    const parts = await renderLabelParts(sheets.data, {
      fillLastSheet: true,
      prendaTamano: receipt.prendaTamano,
    });
    const pdfBytes = await mergePdfParts([
      await generateStockMovementPdf(receipt),
      ...parts,
    ]);

    return {
      success: true,
      data: {
        pdfBase64: Buffer.from(pdfBytes).toString('base64'),
        filename: buildReceiptWithLabelsFileName(
          receipt.movementType,
          receipt.branchCode,
          receipt.date
        ),
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
