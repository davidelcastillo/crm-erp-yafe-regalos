/** @jest-environment node */

/**
 * Integración contra la base local: registrar una venta tiene que dejar su
 * movimiento en el libro de la sucursal, como ya hace la compra con `ENTRY`.
 *
 * Hallazgo de T10.1: las ventas bajaban `BranchInventory` pero **no** escribían
 * `BranchMovement`, así que el historial del producto quedaba sin ellas en el
 * lado de las sucursales y el libro no servía para auditar stock.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { registerSale } from './sale'

jest.setTimeout(30000)

const sufijo = Math.floor(1000 + Math.random() * 9000)
const ACTOR = `qa-venta-${sufijo}@local`
const STOCK_INICIAL = 10
const CANTIDAD = 3

let branchId = 0
let productId = 0
const salesIds: number[] = []
const movementsIds: number[] = []

describe('registerSale deja su movimiento de sucursal (integración, base local)', () => {
  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `QA venta mov ${sufijo}`,
        code: `QV${sufijo}`,
        // authUserId no nulo: `branchAdminService.test.ts` cuenta las sucursales sin
        // authUserId de toda la base y falla si otra suite crea una en paralelo.
        authUserId: `qa-venta-mov-${sufijo}`,
      },
    })
    branchId = branch.id

    const product = await prisma.product.create({
      data: { name: `QA venta mov ${sufijo}`, code: `QW${sufijo}`, price: 10 },
    })
    productId = product.id

    await prisma.branchInventory.create({
      data: { branchId, productId, stock: STOCK_INICIAL },
    })
  })

  afterAll(async () => {
    await prisma.branchMovement.deleteMany({ where: { id: { in: movementsIds } } })
    await prisma.saleItem.deleteMany({ where: { saleId: { in: salesIds } } })
    await prisma.sale.deleteMany({ where: { id: { in: salesIds } } })
    await prisma.branchInventory.deleteMany({ where: { branchId, productId } })
    await prisma.product.deleteMany({ where: { id: productId } })
    await prisma.branch.deleteMany({ where: { id: branchId } })
    await prisma.$disconnect()
  })

  it('escribe el EXIT de la venta, con la sucursal, la cantidad y la referencia', async () => {
    const resultado = await registerSale({
      branchId,
      items: [{ productId, price: 10, quantity: CANTIDAD }],
      paymentMethod: 'EFECTIVO',
      performedBy: ACTOR,
    })

    expect(resultado.success).toBe(true)
    const saleId = (resultado.data as { sale: { id: number } }).sale.id
    salesIds.push(saleId)

    const movimientos = await prisma.branchMovement.findMany({
      where: { productId, reference: `SALE-${saleId}` },
    })
    movementsIds.push(...movimientos.map((m) => m.id))

    expect(movimientos).toHaveLength(1)
    expect(movimientos[0]).toMatchObject({
      branchId,
      movementType: 'EXIT',
      quantity: CANTIDAD,
      performedBy: ACTOR,
    })

    // El stock sigue bajando como antes.
    const inventario = await prisma.branchInventory.findFirst({
      where: { branchId, productId },
      select: { stock: true },
    })
    expect(inventario?.stock).toBe(STOCK_INICIAL - CANTIDAD)
  })

  it('sin actor no inventa el movimiento: la venta se registra igual', async () => {
    const resultado = await registerSale({
      branchId,
      items: [{ productId, price: 10, quantity: 1 }],
      paymentMethod: 'EFECTIVO',
    })

    expect(resultado.success).toBe(true)
    const saleId = (resultado.data as { sale: { id: number } }).sale.id
    salesIds.push(saleId)

    const movimientos = await prisma.branchMovement.findMany({
      where: { productId, reference: `SALE-${saleId}` },
    })

    expect(movimientos).toHaveLength(0)
  })
})
