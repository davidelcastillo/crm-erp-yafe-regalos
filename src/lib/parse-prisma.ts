/**
 * Utility to parse Prisma data for client components
 * Converts Decimal and Date to native JavaScript types
 */

/**
 * Convert a Prisma Decimal to number
 */
function parseDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  // Handle Prisma Decimal objects
  if (typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

/**
 * Convert a Date to ISO string
 */
function parseDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return "";
}

/**
 * Recursively parse an object, converting Decimal and Date fields
 */
export function parsePrismaData<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      result[key] = null;
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => 
        typeof item === "object" && item !== null 
          ? parsePrismaData(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object") {
      // Handle Prisma Decimal objects
      if ("toNumber" in value) {
        result[key] = parseDecimal(value);
      } else if ("toISOString" in value) {
        result[key] = (value as Date).toISOString();
      } else {
        result[key] = parsePrismaData(value as Record<string, unknown>);
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Parse a single object
 */
export function parseObject<T extends Record<string, unknown>>(obj: T): T {
  return parsePrismaData(obj);
}

/**
 * Parse an array of objects
 */
export function parseArray<T extends Record<string, unknown>>(arr: T[]): T[] {
  return arr.map(parsePrismaData);
}