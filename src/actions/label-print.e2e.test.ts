// src/actions/label-print.e2e.test.ts
import { generateProductLabels } from './label-print';
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

describe('E2E label generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate PDF with 3 labels for two products (2 of A, 1 of B)', async () => {
    // Mock product data: Product A (id=1) and Product B (id=2)
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 1, code: 'AAA000', price: 150.0 },
      { id: 2, code: 'BBB000', price: 75.5 },
    ]);

    // Simulate user selecting 2 of product A and 1 of product B
    const selections = [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ];

    const pdfBuffer = await generateProductLabels(selections);

    // Verify that a PDF buffer was returned
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    // Verify that the product data was fetched correctly
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      select: { id: true, code: true, price: true },
    });
  });

  test('should generate correct number of pages based on label count', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 1, code: 'AAA000', price: 10.0 },
    ]);

    // Test exactly 91 labels (one full page)
    let pdfBuffer = await generateProductLabels([{ productId: 1, quantity: 91 }]);
    expect(pdfBuffer).toBeInstanceOf(Buffer);

    // Test 92 labels (should overflow to second page)
    pdfBuffer = await generateProductLabels([{ productId: 1, quantity: 92 }]);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });
});