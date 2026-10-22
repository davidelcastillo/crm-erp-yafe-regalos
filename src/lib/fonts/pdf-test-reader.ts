// src/lib/fonts/pdf-test-reader.ts
/**
 * Sólo tests: lector del contenido de los PDF de documento.
 *
 * Con Poppins embebida los `Tj` ya no son bytes WinAnsi sino ids de glifo
 * (Identity-H, 2 bytes por glifo), así que los textos no se pueden leer sin
 * traducirlos. Este lector infla los content streams, sigue el `Tf` vigente y
 * traduce cada id con el CMap `/ToUnicode` que pdf-lib escribe por cada fuente
 * embebida (siempre como `beginbfchar`).
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';

export interface PdfContent {
  doc: PDFDocument;
  /** Cada `Tj` ya traducido a texto, en orden de aparición. */
  text: string[];
  /** Color `rg` de la primera aparición de cada texto. */
  colors: Map<string, number[]>;
  /** `/BaseFont` de las fuentes de la página, p. ej. `Poppins-Regular-<sufijo>`. */
  fonts: string[];
}

/** UTF-16BE (como lo escribe el CMap) a texto. */
const utf16be = (hex: string): string => {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return out;
};

/** Mapa id de glifo → texto desde el CMap `/ToUnicode` de una fuente embebida. */
const readToUnicode = (doc: PDFDocument, font: PDFDict): Map<number, string> => {
  const glyphs = new Map<number, string>();
  const stream = font.lookupMaybe(PDFName.of('ToUnicode'), PDFStream);
  if (!stream) return glyphs;
  const cmap = inflateSync(stream.getContents()).toString('latin1');
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const entry of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      const char = utf16be(entry[2]);
      if (char) glyphs.set(parseInt(entry[1], 16), char);
    }
  }
  return glyphs;
};

// Operadores relevantes: fuente activa (`/F1 9 Tf`), texto (`<hex> Tj`) y color (`r g b rg`).
const OPERATOR = /\/([^\s/[\]<>()]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/g;

export async function readPdfContent(bytes: Uint8Array): Promise<PdfContent> {
  const doc = await PDFDocument.load(bytes);
  const text: string[] = [];
  const colors = new Map<string, number[]>();
  const fonts: string[] = [];

  for (const page of doc.getPages()) {
    const fontDict = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict);
    const cmaps = new Map<string, Map<number, string>>();
    for (const [name, ref] of fontDict?.entries() ?? []) {
      const font = doc.context.lookup(ref, PDFDict);
      fonts.push(String(font.lookupMaybe(PDFName.of('BaseFont'), PDFName) ?? ''));
      cmaps.set(String(name).replace(/^\//, ''), readToUnicode(doc, font));
    }

    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    for (const ref of streams) {
      const raw = inflateSync(doc.context.lookup(ref, PDFStream).getContents()).toString('latin1');
      let cmap: Map<number, string> = new Map();
      for (const match of raw.matchAll(OPERATOR)) {
        if (match[1] !== undefined) {
          cmap = cmaps.get(match[1]) ?? new Map();
          continue;
        }
        if (match[2] === undefined) continue;
        let value = '';
        for (let i = 0; i + 4 <= match[2].length; i += 4) {
          value += cmap.get(parseInt(match[2].slice(i, i + 4), 16)) ?? '';
        }
        text.push(value);
        const operator = [...raw.slice(0, match.index).matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg/g)].pop();
        if (operator && !colors.has(value)) {
          colors.set(value, [operator[1], operator[2], operator[3]].map((part) => Math.round(Number(part) * 100) / 100));
        }
      }
    }
  }

  return { doc, text, colors, fonts };
}
