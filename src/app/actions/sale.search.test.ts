/** @jest-environment node */

/**
 * Integración contra la base local: la búsqueda de la lista de ventas
 * (`getSales({ search })`) tiene que encontrar por nombre y por código de
 * producto. Verifica el bug 1 del usuario, que reportaba que solo se buscaba
 * por nombre.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { getSales } from './sale'

jest.setTimeout(30000)

const sufijo = Math.floor(1000 + Math.random() * 9000)
const codeProducto = `QS${sufijo}`
const nombreProducto = `QA venta ${sufijo} buscable`

let branchId = 0
let saleId = 0
let productId = 0

describe('getSales search (integración, base local)', () => {
  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `QA venta ${sufijo}`,
        code: `QB${sufijo}`,
        // authUserId no nulo: `branchAdminService.test.ts` cuenta las sucursales sin
        // authUserId de toda la base y falla si otra suite crea una en paralelo.
        authUserId: `qa-venta-${sufijo}`,
      },
    })
    branchId = branch.id

    const product = await prisma.product.create({
      data: { name: nombreProducto, code: codeProducto, codePrefix: 'QS', price: 50 },
    })
    productId = product.id

    const sale = await prisma.sale.create({
      data: {
        branchId,
        totalAmount: 50,
        amountPaid: 50,
        paymentMethod: 'EFECTIVO',
        items: { create: [{ productId, price: 50, quantity: 1, subtotal: 50 }] },
      },
    })
    saleId = sale.id
  })

  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { id: saleId } })
    await prisma.product.deleteMany({ where: { id: productId } })
    await prisma.branch.deleteMany({ where: { id: branchId } })
    await prisma.$disconnect()
  })

  const buscar = async (search: string) => {
    const resultado = await getSales({ search, branchId })
    expect(resultado.success).toBe(true)
    return (resultado.data?.items ?? []).map((venta) => venta.id as number)
  }

  it('encuentra la venta por código de producto', async () => {
    expect(await buscar(codeProducto)).toContain(saleId)
  })

  it('encuentra la venta por código en minúsculas', async () => {
    expect(await buscar(codeProducto.toLowerCase())).toContain(saleId)
  })

  it('encuentra la venta por nombre de producto', async () => {
    expect(await buscar(nombreProducto)).toContain(saleId)
  })

  it('no devuelve la venta con una búsqueda que no coincide', async () => {
    expect(await buscar('no-existe-xyz')).not.toContain(saleId)
  })
})
