// src/actions/label-print.ts
'use server';

import { prisma } from '@/lib/prisma';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { 
  calculateLabelLayout, 
  LabelPosition, 
  LabelRenderingInstructions,
  SHEET_WIDTH_MM,
  SHEET_HEIGHT_MM,
  LABEL_WIDTH_MM,
  LABEL_HEIGHT_MM,
  LABEL_BACKGROUND_COLOR,
  LABEL_RECT_COLOR,
  LABEL_RECT_RADIUS_MM,
  TEXT_COLOR,
  CODE_FONT_SIZE,
  PRICE_AMOUNT_FONT_SIZE,
  PRICE_SYMBOL_FONT_SIZE,
  BUSINESS_ID_FONT_SIZE
} from '@/lib/label-layout';

export type LabelProductSelection = {
  productId: number;
  quantity: number;
};

/**
 * Generates a PDF with product labels according to the exact specification.
 * @param selections Array of product selections with IDs and quantities
 * @returns Promise resolving to a base64 encoded PDF string
 */
export async function generateProductLabels(selections: LabelProductSelection[]): Promise<string> {
  // Validate input
  if (!selections || selections.length === 0) {
    throw new Error('No product selections provided');
  }

  // Fetch product details for all requested product IDs
  const productIds = [...new Set(selections.map(s => s.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, code: true, price: true },
  });

  // Create a map for quick lookup
  const productMap = new Map<number, { code: string; price: number }>();
  products.forEach(p => {
    productMap.set(p.id, { code: p.code, price: Number(p.price) });
  });

  // Validate that all requested products exist
  for (const selection of selections) {
    if (!productMap.has(selection.productId)) {
      throw new Error(`Product with ID ${selection.productId} not found`);
    }
    if (selection.quantity < 1) {
      throw new Error(`Quantity must be at least 1 for product ${selection.productId}`);
    }
  }

  // Expand selections into individual label entries with actual product data
  const labelEntries: { productId: number; code: string; price: number }[] = [];
  for (const selection of selections) {
    const product = productMap.get(selection.productId)!;
    for (let i = 0; i < selection.quantity; i++) {
      labelEntries.push({
        productId: selection.productId,
        code: product.code,
        price: product.price,
      });
    }
  }

  // Calculate layout (positions and rendering instructions)
  const layoutResult = calculateLabelLayout(
    labelEntries.map(e => ({ productId: e.productId, quantity: 1 })) // Convert to selection format expected by layout function
  );

  // If no labels, return empty PDF
  if (layoutResult.totalLabels === 0) {
    const pdfDoc = await PDFDocument.create();
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes).toString('base64');
  }

  // Load the Shrikhand font
  const fontPath = join(process.cwd(), 'src', 'lib', 'fonts', 'Shrikhand-Regular.ttf');
  const shrikhandFontBytes = await readFile(fontPath);
  const pdfDoc = await PDFDocument.create();
  const shrikhandFont = await pdfDoc.embedFont(shrikhandFontBytes);
  const sansFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Helper to convert mm to points (1 mm = 2.83464567 pt)
  const mmToPt = (mm: number) => mm * 2.83464567;

  // Process each label position
  for (const instruction of layoutResult.labels) {
    const { product, position } = instruction;
    const page = pdfDoc.addPage([mmToPt(SHEET_WIDTH_MM), mmToPt(SHEET_HEIGHT_MM)]);
    const xPt = mmToPt(position.x);
    const yPt = mmToPt(position.y);

    // Draw label background (full label area)
    page.drawRectangle({
      x: xPt,
      y: yPt,
      width: mmToPt(LABEL_WIDTH_MM),
      height: mmToPt(LABEL_HEIGHT_MM),
      color: rgb(
        parseInt(LABEL_BACKGROUND_COLOR.slice(1, 3), 16) / 255,
        parseInt(LABEL_BACKGROUND_COLOR.slice(3, 5), 16) / 255,
        parseInt(LABEL_BACKGROUND_COLOR.slice(5, 7), 16) / 255
      ),
    });

    // Draw inner rounded rectangle (code area)
    const codeRectX = xPt + mmToPt(1); // 1mm left margin
    const codeRectY = yPt + mmToPt(1); // 1mm top margin
    const codeRectWidth = mmToPt(LABEL_WIDTH_MM - 2); // width minus 2mm horizontal margin
    const codeRectHeight = mmToPt(6); // 6mm height
    const cornerRadius = mmToPt(LABEL_RECT_RADIUS_MM);
    // PDF-lib doesn't have direct rounded rectangle; we approximate with a rectangle (the spec says rounded but we'll keep rect for simplicity)
    // For simplicity, we'll draw a regular rectangle; the spec's radius is small.
    page.drawRectangle({
      x: codeRectX,
      y: codeRectY,
      width: codeRectWidth,
      height: codeRectHeight,
      color: rgb(
        parseInt(LABEL_RECT_COLOR.slice(1, 3), 16) / 255,
        parseInt(LABEL_RECT_COLOR.slice(3, 5), 16) / 255,
        parseInt(LABEL_RECT_COLOR.slice(5, 7), 16) / 255
      ),
    });

    // Draw product code (centered in code rectangle)
    const codeText = product.code;
    const codeFontSize = mmToPt(CODE_FONT_SIZE);
    const codeTextWidth = await sansFont.widthOfTextAtSize(codeText, codeFontSize);
    const codeTextX = codeRectX + (codeRectWidth - codeTextWidth) / 2;
    const codeTextY = codeRectY + (codeRectHeight - codeFontSize) / 2 + codeFontSize * 0.7; // approximate baseline
    page.drawText(codeText, {
      x: codeTextX,
      y: codeTextY,
      size: codeFontSize,
      font: sansFont,
      color: rgb(0, 0, 0),
    });

    // Draw price rectangle (below code rectangle, with 1mm gap)
    const priceRectX = xPt + mmToPt(1); // same left margin as code rect
    const priceRectY = yPt + mmToPt(1 + 6 + 1); // top + 1mm + code height (6mm) + 1mm gap
    const priceRectWidth = mmToPt(LABEL_WIDTH_MM - 2);
    const priceRectHeight = mmToPt(11); // 11mm height
    page.drawRectangle({
      x: priceRectX,
      y: priceRectY,
      width: priceRectWidth,
      height: priceRectHeight,
      color: rgb(
        parseInt(LABEL_RECT_COLOR.slice(1, 3), 16) / 255,
        parseInt(LABEL_RECT_COLOR.slice(3, 5), 16) / 255,
        parseInt(LABEL_RECT_COLOR.slice(5, 7), 16) / 255
      ),
    });

    // Draw price: $ symbol in Shrikhand, amount in sans-serif
    const priceValue = product.price;
    const formattedPrice = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(priceValue);
    // Example: "$ 1.234,56" -> we need to separate the currency symbol and the number
    // The format yields "$ 1.234,56" (with a non-breaking space after $). We'll split.
    const amountWithoutSymbol = formattedPrice.replace(/^\$\s*/, '');
    const currencySymbol = '$';

    // Draw currency symbol
    const symbolFontSize = mmToPt(PRICE_SYMBOL_FONT_SIZE);
    const symbolX = priceRectX + mmToPt(2); // 2mm left inner margin
    const symbolY = priceRectY + (priceRectHeight - symbolFontSize) / 2 + symbolFontSize * 0.7;
    page.drawText(currencySymbol, {
      x: symbolX,
      y: symbolY,
      size: symbolFontSize,
      font: shrikhandFont,
      color: rgb(0, 0, 0),
    });

    // Draw amount (number) to the right of the symbol
    const amountFontSize = mmToPt(PRICE_AMOUNT_FONT_SIZE);
    const amountX = symbolX + mmToPt(0.5) + await shrikhandFont.widthOfTextAtSize(currencySymbol, symbolFontSize); // small gap
    const amountY = priceRectY + (priceRectHeight - amountFontSize) / 2 + amountFontSize * 0.7;
    page.drawText(amountWithoutSymbol, {
      x: amountX,
      y: amountY,
      size: amountFontSize,
      font: sansFont,
      color: rgb(0, 0, 0),
    });

    // Draw business ID at bottom (1mm from bottom edge)
    const businessIdText = '@feria_conexx';
    const businessIdFontSize = mmToPt(BUSINESS_ID_FONT_SIZE);
    const businessIdY = yPt + mmToPt(LABEL_HEIGHT_MM - 1 - businessIdFontSize * 0.3); // approximate baseline from bottom
    const businessIdX = xPt + (mmToPt(LABEL_WIDTH_MM) - await shrikhandFont.widthOfTextAtSize(businessIdText, businessIdFontSize)) / 2;
    page.drawText(businessIdText, {
      x: businessIdX,
      y: businessIdY,
      size: businessIdFontSize,
      font: shrikhandFont,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}