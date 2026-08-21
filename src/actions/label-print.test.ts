// src/actions/label-print.test.ts
import { generateProductLabels } from './label-print';
import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
    },
  },
}));

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn().mockReturnValue({
      addPage: jest.fn().mockReturnValue({
        drawRectangle: jest.fn(),
        drawText: jest.fn(),
      }),
      embedFont: jest.fn().mockResolvedValue({
        widthOfTextAtSize: jest.fn().mockResolvedValue(10),
      }),
      save: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    }),
  },
  rgb: jest.fn(),
  StandardFonts: {
    Helvetica: 'Helvetica',
  },
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
}));

// Mock path
jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

describe('generateProductLabels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws error when no selections provided', async () => {
    await expect(generateProductLabels([])).rejects.toThrow('No product selections provided');
  });

  test('throws error when quantity less than 1', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 1, code: 'AAA000', price: 100 },
    ]);
    await expect(generateProductLabels([{ productId: 1, quantity: 0 }])).rejects.toThrow(
      'Quantity must be at least 1 for product 1'
    );
  });

  test('throws error when product not found', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    await expect(generateProductLabels([{ productId: 999, quantity: 1 }])).rejects.toThrow(
      'Product with ID 999 not found'
    );
  });

  test('returns base64 PDF string for valid selection', async () => {
    // Mock product data
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 1, code: 'AAA000', price: 123.45 },
    ]);

    const result = await generateProductLabels([{ productId: 1, quantity: 2 }]);

    // Action returns a base64-encoded PDF string (not a Buffer)
    expect(typeof result).toBe('string');
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      select: { id: true, code: true, price: true },
    });
  });
});