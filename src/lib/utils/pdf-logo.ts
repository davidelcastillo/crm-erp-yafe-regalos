// src/lib/utils/pdf-logo.ts
import type { PDFPage } from 'pdf-lib';
import { PDF_BRAND_COLOR } from '@/lib/pdf-brand';
import { documentColor } from '@/lib/fonts/document-fonts';

/**
 * La frutilla de la marca dibujada con vectores: mismo arte que el SVG de
 * `src/app/polkalinas/components/Marca.tsx` (viewBox 0 0 100 100), sin PNG
 * embebido y sin leer archivos en tiempo de ejecución.
 */
const BODY =
  'M50 94 C30 86 14 64 16 46 C18 32 32 28 50 33 C68 28 82 32 84 46 C86 64 70 86 50 94 Z';
const CROWN =
  'M50 36 C44 30 34 30 28 33 C34 26 42 24 47 26 C46 20 48 14 50 10 C52 14 54 20 53 26 C58 24 66 26 72 33 C66 30 56 30 50 36 Z';
const POLKA_DOTS = [
  { cx: 38, cy: 54 },
  { cx: 62, cy: 54 },
  { cx: 50, cy: 74 },
];
const DOT_RADIUS = 6;

/**
 * Dibuja el logo con la esquina **superior izquierda** en (`x`, `y`): el origen
 * del SVG es el de arriba, no el de pdf-lib.
 */
export function drawBrandLogo(
  page: PDFPage,
  { x, y, size }: { x: number; y: number; size: number }
): void {
  const scale = size / 100;
  const origin = { x, y, scale };

  // Cuerpo frutilla y corona cacao: `drawSvgPath` ya invierte el eje Y del SVG.
  page.drawSvgPath(BODY, { ...origin, color: documentColor(PDF_BRAND_COLOR.strawberry) });
  page.drawSvgPath(CROWN, { ...origin, color: documentColor(PDF_BRAND_COLOR.cacao) });

  // Lunares crema, en coordenadas del SVG traducidas al punto de origen.
  for (const dot of POLKA_DOTS) {
    page.drawCircle({
      x: x + dot.cx * scale,
      y: y - dot.cy * scale,
      size: DOT_RADIUS * scale,
      color: documentColor(PDF_BRAND_COLOR.cream),
    });
  }
}
