// src/actions/label-print.integration.test.ts
import { generateProductLabels } from './label-print';
import { searchProducts } from '@/app/actions/product';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
    },
  },
}));

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

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
}));

jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

describe('generateProductLabels integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates PDF after searching for products', async () => {
    // Mock product data for search
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 1, code: 'AAA000', name: 'Product A', price: 100.0 },
    ]);

    // Simulate searching for a product
    const searchResults = await searchProducts('AAA');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].code).toBe('AAA000');

    // Now generate labels for the found product
    const selection = [{ productId: searchResults[0].id, quantity: 3 }];
    const pdfBuffer = await generateProductLabels(selection);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  test('handles multiple products from search', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 1, code: 'AAA000', name: 'Product A', price: 100.0 },
      { id: 2, code: 'BBB000', name: 'Product B', price: 200.0 },
    ]);

    const searchResults = await searchProducts('');
    expect(searchResults).toHaveLength(2);

    const selections = searchResults.map(p => ({
      productId: p.id,
      quantity: 2,
    }));

    const pdfBuffer = await generateProductLabels(selections);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });
});