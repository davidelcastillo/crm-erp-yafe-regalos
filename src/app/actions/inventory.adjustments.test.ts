/** @jest-environment node */

/**
 * Integración contra la base local: entrada/salida de stock por lote en una
 * sucursal — la forma auditable de corregir stock (S13 del usuario: «agregar/
 * quitar stock de N productos en una X sucursal»).
 *
 * Es hermana de `moveStockBatchBetweenBranches` (que mueve entre dos
 * sucursales): acá la sucursal es una sola y el sentido lo da `movementType`.
 * Cada línea deja su `BranchMovement` `ENTRY`/`EXIT`.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { adjustBranchStockBatch } from './inventory'

jest.setTimeout(30000)

const sufijo = Math.floor(1000 + Math.random() * 9000)
const ACTOR = `qa-ajuste-${sufijo}@local`

let branchId = 0
let otraBranchId = 0
let branchInactivaId = 0
let productId = 0
let productoSinFilaId = 0
const movementsIds: number[] = []

const stock = async (branch: number, product: number) => {
  const fila = await prisma.branchInventory.findFirst({
    where: { branchId: branch, productId: product },
    select: { stock: true },
  })
  return fila?.stock ?? null
}

const movimientos = async (reference: string) =>
  prisma.branchMovement.findMany({ where: { reference } })

describe('adjustBranchStockBatch (integración, base local)', () => {
  beforeAll(async () => {
    const [branch, otra, inactiva] = await Promise.all([
      prisma.branch.create({
        data: {
          name: `QA ajuste ${sufijo}`,
          code: `QA${sufijo}`,
          authUserId: `qa-ajuste-${sufijo}`,
        },
      }),
      prisma.branch.create({
        data: {
          name: `QA ajuste otra ${sufijo}`,
          code: `QB2${sufijo}`,
          authUserId: `qa-ajuste-otra-${sufijo}`,
        },
      }),
      prisma.branch.create({
        data: {
          name: `QA ajuste inactiva ${sufijo}`,
          code: `QC2${sufijo}`,
          authUserId: `qa-ajuste-inactiva-${sufijo}`,
          isActive: false,
        },
      }),
    ])
    branchId = branch.id
    otraBranchId = otra.id
    branchInactivaId = inactiva.id

    const [producto, sinFila] = await Promise.all([
      prisma.product.create({
        data: { name: `QA ajuste ${sufijo}`, code: `QD${sufijo}`, price: 10 },
      }),
      prisma.product.create({
        data: { name: `QA ajuste nuevo ${sufijo}`, code: `QE${sufijo}`, price: 10 },
      }),
    ])
    productId = producto.id
    productoSinFilaId = sinFila.id

    await Promise.all([
      prisma.branchInventory.create({ data: { branchId, productId, stock: 5 } }),
      prisma.branchInventory.create({ data: { branchId: otraBranchId, productId, stock: 9 } }),
    ])
  })

  afterAll(async () => {
    await prisma.branchMovement.deleteMany({ where: { id: { in: movementsIds } } })
    await prisma.branchInventory.deleteMany({
      where: { branchId: { in: [branchId, otraBranchId] } },
    })
    await prisma.product.deleteMany({ where: { id: { in: [productId, productoSinFilaId] } } })
    await prisma.branch.deleteMany({
      where: { id: { in: [branchId, otraBranchId, branchInactivaId] } },
    })
    await prisma.$disconnect()
  })

  it('ENTRY suma al stock existente y crea la fila del producto que no la tenía', async () => {
    const reference = `Conteo ${sufijo}`
    const resultado = await adjustBranchStockBatch({
      branchId,
      movementType: 'ENTRY',
      items: [
        { productId, quantity: 4 },
        { productId: productoSinFilaId, quantity: 7 },
      ],
      reference,
      performedBy: ACTOR,
    })

    expect(resultado.success).toBe(true)
    expect(await stock(branchId, productId)).toBe(9)
    expect(await stock(branchId, productoSinFilaId)).toBe(7)
    // La otra sucursal no se toca.
    expect(await stock(otraBranchId, productId)).toBe(9)

    const filas = await movimientos(reference)
    movementsIds.push(...filas.map((m) => m.id))
    expect(filas).toHaveLength(2)
    expect(filas.map((m) => m.movementType)).toEqual(['ENTRY', 'ENTRY'])
    expect(filas.reduce((acc, m) => acc + m.quantity, 0)).toBe(11)
    expect(filas.every((m) => m.branchId === branchId && m.performedBy === ACTOR)).toBe(true)
  })

  it('EXIT resta del stock y deja su movimiento', async () => {
    const reference = `Salida ${sufijo}`
    const resultado = await adjustBranchStockBatch({
      branchId,
      movementType: 'EXIT',
      items: [{ productId, quantity: 3 }],
      reference,
      performedBy: ACTOR,
    })

    expect(resultado.success).toBe(true)
    expect(await stock(branchId, productId)).toBe(6)

    const filas = await movimientos(reference)
    movementsIds.push(...filas.map((m) => m.id))
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ movementType: 'EXIT', quantity: 3, branchId })
  })

  it('EXIT rechaza si no alcanza el stock y no cambia nada', async () => {
    const reference = `Salida fallida ${sufijo}`
    const resultado = await adjustBranchStockBatch({
      branchId,
      movementType: 'EXIT',
      items: [{ productId, quantity: 999 }],
      reference,
      performedBy: ACTOR,
    })

    expect(resultado.success).toBe(false)
    expect(resultado.error).toContain('Stock insuficiente')
    expect(await stock(branchId, productId)).toBe(6)
    expect(await movimientos(reference)).toHaveLength(0)
  })

  it('rechaza una sucursal inactiva', async () => {
    const resultado = await adjustBranchStockBatch({
      branchId: branchInactivaId,
      movementType: 'ENTRY',
      items: [{ productId, quantity: 1 }],
      performedBy: ACTOR,
    })

    expect(resultado.success).toBe(false)
    expect(resultado.error).toContain('inactiva')
    expect(await stock(branchInactivaId, productId)).toBeNull()
  })

  it('rechaza un lote vacío o con cantidades inválidas', async () => {
    const vacio = await adjustBranchStockBatch({
      branchId,
      movementType: 'ENTRY',
      items: [],
      performedBy: ACTOR,
    })
    expect(vacio.success).toBe(false)

    const cantidadCero = await adjustBranchStockBatch({
      branchId,
      movementType: 'EXIT',
      items: [{ productId, quantity: 0 }],
      performedBy: ACTOR,
    })
    expect(cantidadCero.success).toBe(false)

    const tipoInvalido = await adjustBranchStockBatch({
      branchId,
      movementType: 'TRANSFER_IN',
      items: [{ productId, quantity: 1 }],
      performedBy: ACTOR,
    })
    expect(tipoInvalido.success).toBe(false)
  })
})
