/**
 * Orden compartido de las listas de productos (S4): por código —prefijo
 * alfabético y después el número como número— o por última modificación.
 * Puro y sin Prisma: lo usan tanto las Server Actions como los componentes.
 */

export type ProductSortMode = "code" | "updated";

type CodeProduct = {
  code: string;
  codePrefix?: string | null;
};

type SortableProduct = CodeProduct & {
  updatedAt?: Date | string | null;
};

// "AAA001" → prefijo "AAA" y número 1.
const CODE_PATTERN = /^(\D*)(\d+)$/;

function codeKey(product: CodeProduct) {
  const code = (product.code ?? "").trim().toLowerCase();
  const match = CODE_PATTERN.exec(code);
  const derivedPrefix = match ? match[1] : code;
  const prefix = product.codePrefix?.trim().toLowerCase() || derivedPrefix;
  const number = match ? Number.parseInt(match[2], 10) : Number.POSITIVE_INFINITY;
  return { prefix, number, code };
}

/** Comparador de códigos: prefijo alfabético y después el sufijo numérico. */
export function compareProductCodes(a: CodeProduct, b: CodeProduct): number {
  const left = codeKey(a);
  const right = codeKey(b);
  if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
  if (left.number !== right.number) return left.number < right.number ? -1 : 1;
  if (left.code === right.code) return 0;
  return left.code < right.code ? -1 : 1;
}

function timestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Devuelve una copia ordenada: por código (default) o por `updatedAt`
 * descendente. El código desempata las fechas iguales para que el orden sea
 * estable entre llamadas.
 */
export function sortProducts<T extends SortableProduct>(
  rows: readonly T[],
  mode: ProductSortMode = "code"
): T[] {
  const sorted = [...rows];
  if (mode === "updated") {
    sorted.sort(
      (a, b) =>
        timestamp(b.updatedAt) - timestamp(a.updatedAt) || compareProductCodes(a, b)
    );
    return sorted;
  }
  sorted.sort(compareProductCodes);
  return sorted;
}
