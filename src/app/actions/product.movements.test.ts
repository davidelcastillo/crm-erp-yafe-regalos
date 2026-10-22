/** @jest-environment node */

/**
 * Integración contra la base local: el historial de un producto tiene que mostrar
 * también los movimientos de sucursal (bug 10.1 del usuario: «se deben mostrar
 * tambien los movimientos de sucursales como movimientos»).
 *
 * Hasta ahora `getProductMovements` armaba la lista solo con `PurchaseItem` y
 * `SaleItem`, así que las transferencias entre sucursales y los ajustes de stock
 * —que sí quedan en `BranchMovement`— eran invisibles en el modal.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { getProductMovements } from './product'

jest.setTimeout(30000)

type Movimiento = {
  id: string
  type: string
  date: string
  quantity: number
  referenceId: number | null
  reference: string | null
  branchName: string | null
}

const sufijo = Math.floor(1000 + Math.random() * 9000)
const nombreA = `QA mov A ${sufijo}`
const nombreB = `QA mov B ${sufijo}`
const referenciaTransferencia = `MOVE-TEST-${sufijo}`

let branchAId = 0
let branchBId = 0
let productId = 0
let otroProductId = 0

const ids = { purchases: [] as number[], sales: [] as number[], movements: [] as number[] }

const movimientos = async () => {
  const resultado = await getProductMovements(productId)
  expect(resultado.success).toBe(true)
  return resultado.data as Movimiento[]
}

const porTipo = (datos: Movimiento[], tipo: string) =>
  datos.filter((d) => d.type === tipo)

describe('getProductMovements con movimientos de sucursal (integración, base local)', () => {
  let purchaseId = 0
  let saleId = 0

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      prisma.branch.create({
        data: { name: nombreA, code: `MA${sufijo}`, authUserId: `qa-mov-a-${sufijo}` },
      }),
      prisma.branch.create({
        data: { name: nombreB, code: `MB${sufijo}`, authUserId: `qa-mov-b-${sufijo}` },
      }),
    ])
    branchAId = a.id
    branchBId = b.id

    const [producto, otro] = await Promise.all([
      prisma.product.create({
        data: { name: `QA mov ${sufijo}`, code: `QM${sufijo}`, price: 10 },
      }),
      prisma.product.create({
        data: { name: `QA mov otro ${sufijo}`, code: `QN${sufijo}`, price: 10 },
      }),
    ])
    productId = producto.id
    otroProductId = otro.id

    // Compra con su movimiento ENTRY, como lo escribe la transacción de compra.
    const compra = await prisma.purchase.create({
      data: { branchId: branchAId, totalAmount: 50 },
    })
    purchaseId = compra.id
    ids.purchases.push(compra.id)

    await prisma.purchaseItem.create({
      data: { purchaseId: compra.id, productId, price: 10, quantity: 5, subtotal: 50 },
    })

    const venta = await prisma.sale.create({
      data: { branchId: branchAId, totalAmount: 20, amountPaid: 20, paymentMethod: 'EFECTIVO' },
    })
    saleId = venta.id
    ids.sales.push(venta.id)
    await prisma.saleItem.create({
      data: { saleId: venta.id, productId, price: 10, quantity: 2, subtotal: 20 },
    })

    const movimientosCreados = await Promise.all([
      prisma.branchMovement.create({
        data: {
          productId,
          branchId: branchAId,
          movementType: 'TRANSFER_OUT',
          quantity: 3,
          reference: referenciaTransferencia,
          performedBy: 'qa',
        },
      }),
      prisma.branchMovement.create({
        data: {
          productId,
          branchId: branchBId,
          movementType: 'TRANSFER_IN',
          quantity: 3,
          reference: referenciaTransferencia,
          performedBy: 'qa',
        },
      }),
      prisma.branchMovement.create({
        data: {
          productId,
          branchId: branchAId,
          movementType: 'ADJUSTMENT',
          quantity: 7,
          reference: 'ADJUSTMENT',
          performedBy: 'qa',
        },
      }),
      prisma.branchMovement.create({
        data: {
          productId,
          branchId: branchAId,
          movementType: 'ENTRY',
          quantity: 5,
          reference: `PURCHASE-${compra.id}`,
          performedBy: 'qa',
        },
      }),
      // El EXIT que deja la venta: tampoco se lista aparte, la venta ya es una fila.
      prisma.branchMovement.create({
        data: {
          productId,
          branchId: branchAId,
          movementType: 'EXIT',
          quantity: 2,
          reference: `SALE-${venta.id}`,
          performedBy: 'qa',
        },
      }),
      // De otro producto: no tiene que aparecer.
      prisma.branchMovement.create({
        data: {
          productId: otroProductId,
          branchId: branchAId,
          movementType: 'ADJUSTMENT',
          quantity: 99,
          reference: 'ADJUSTMENT',
          performedBy: 'qa',
        },
      }),
    ])
    ids.movements.push(...movimientosCreados.map((m) => m.id))
  })

  afterAll(async () => {
    await prisma.branchMovement.deleteMany({ where: { id: { in: ids.movements } } })
    await prisma.saleItem.deleteMany({ where: { saleId: { in: ids.sales } } })
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: ids.purchases } } })
    await prisma.sale.deleteMany({ where: { id: { in: ids.sales } } })
    await prisma.purchase.deleteMany({ where: { id: { in: ids.purchases } } })
    await prisma.product.deleteMany({ where: { id: { in: [productId, otroProductId] } } })
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } })
    await prisma.$disconnect()
  })

  it('muestra las transferencias y el ajuste, con su sucursal y su referencia', async () => {
    const datos = await movimientos()

    const salida = porTipo(datos, 'TRANSFER_OUT')
    expect(salida).toHaveLength(1)
    expect(salida[0]).toMatchObject({
      quantity: 3,
      reference: referenciaTransferencia,
      branchName: nombreA,
    })

    const entrada = porTipo(datos, 'TRANSFER_IN')
    expect(entrada).toHaveLength(1)
    expect(entrada[0]).toMatchObject({ quantity: 3, branchName: nombreB })

    // El ajuste es uno solo: el del otro producto no se mezcla.
    const ajustes = porTipo(datos, 'ADJUSTMENT')
    expect(ajustes).toHaveLength(1)
    expect(ajustes[0]).toMatchObject({ quantity: 7, branchName: nombreA })
  })

  it('no duplica la compra que ya viene como movimiento ENTRY', async () => {
    const datos = await movimientos()

    const compras = porTipo(datos, 'PURCHASE')
    expect(compras).toHaveLength(1)
    expect(compras[0]).toMatchObject({ quantity: 5, referenceId: purchaseId, branchName: nombreA })

    expect(porTipo(datos, 'ENTRY')).toHaveLength(0)
  })

  it('sigue mostrando la venta del producto', async () => {
    const datos = await movimientos()

    const ventas = porTipo(datos, 'SALE')
    expect(ventas).toHaveLength(1)
    expect(ventas[0]).toMatchObject({ quantity: 2, referenceId: saleId, branchName: nombreA })

    expect(porTipo(datos, 'EXIT')).toHaveLength(0)
  })
})

/**
 * S4: el historial se puede cortar en el **último control de stock** de la
 * sucursal, no solo en la creación del producto. El corte es por sucursal: el
 * control de una sucursal no recorta lo que pasó en otra, y un control en
 * borrador no cuenta (solo los cerrados dejan corte).
 */
describe('getProductMovements con rango desde el último control (integración, base local)', () => {
  const base = new Date('2026-01-10T12:00:00.000Z')
  const despuesDelControl = new Date('2026-01-12T12:00:00.000Z')
  const cierre = new Date('2026-01-11T12:00:00.000Z')

  let branchConControlId = 0
  let branchSinControlId = 0
  let productRangoId = 0
  let controlCerradoId = 0
  let controlBorradorId = 0
  const movimientosCreados: number[] = []
  const comprasCreadas: number[] = []

  const rango = async (opciones?: { range?: 'created' | 'last-control'; branchId?: number | null }) => {
    const resultado = await getProductMovements(productRangoId, opciones)
    expect(resultado.success).toBe(true)
    return {
      datos: resultado.data as Movimiento[],
      meta: (resultado as { meta?: { range: string; since: string; controlClosedAt: string | null } }).meta,
    }
  }

  beforeAll(async () => {
    const [conControl, sinControl] = await Promise.all([
      prisma.branch.create({
        data: { name: `QA rango A ${sufijo}`, code: `RA${sufijo}`, authUserId: `qa-rango-a-${sufijo}` },
      }),
      prisma.branch.create({
        data: { name: `QA rango B ${sufijo}`, code: `RB${sufijo}`, authUserId: `qa-rango-b-${sufijo}` },
      }),
    ])
    branchConControlId = conControl.id
    branchSinControlId = sinControl.id

    const producto = await prisma.product.create({
      data: { name: `QA rango ${sufijo}`, code: `QR${sufijo}`, price: 10, createdAt: base },
    })
    productRangoId = producto.id

    // Un control cerrado anterior al «después» y un borrador más nuevo: el
    // borrador no debe mover el corte.
    const cerrado = await prisma.stockControl.create({
      data: {
        branchId: branchConControlId,
        status: 'CLOSED',
        startedAt: base,
        closedAt: cierre,
        closedBy: 'qa',
        reason: 'control de prueba',
      },
    })
    controlCerradoId = cerrado.id

    const borrador = await prisma.stockControl.create({
      data: { branchId: branchConControlId, status: 'DRAFT', startedAt: despuesDelControl },
    })
    controlBorradorId = borrador.id

    const [antes, despues, enOtraSucursal] = await Promise.all([
      prisma.branchMovement.create({
        data: {
          productId: productRangoId,
          branchId: branchConControlId,
          movementType: 'ADJUSTMENT',
          quantity: 1,
          reference: 'ADJUSTMENT',
          performedBy: 'qa',
          createdAt: base,
        },
      }),
      prisma.branchMovement.create({
        data: {
          productId: productRangoId,
          branchId: branchConControlId,
          movementType: 'ADJUSTMENT',
          quantity: 2,
          reference: 'ADJUSTMENT',
          performedBy: 'qa',
          createdAt: despuesDelControl,
        },
      }),
      prisma.branchMovement.create({
        data: {
          productId: productRangoId,
          branchId: branchSinControlId,
          movementType: 'ADJUSTMENT',
          quantity: 3,
          reference: 'ADJUSTMENT',
          performedBy: 'qa',
          createdAt: despuesDelControl,
        },
      }),
    ])
    movimientosCreados.push(antes.id, despues.id, enOtraSucursal.id)

    // Compras a los dos lados del corte: el filtro también aplica a `Purchase.date`.
    const [compraAntes, compraDespues] = await Promise.all([
      prisma.purchase.create({
        data: { branchId: branchConControlId, totalAmount: 10, date: base },
      }),
      prisma.purchase.create({
        data: { branchId: branchConControlId, totalAmount: 20, date: despuesDelControl },
      }),
    ])
    comprasCreadas.push(compraAntes.id, compraDespues.id)
    await Promise.all([
      prisma.purchaseItem.create({
        data: { purchaseId: compraAntes.id, productId: productRangoId, price: 10, quantity: 1, subtotal: 10 },
      }),
      prisma.purchaseItem.create({
        data: { purchaseId: compraDespues.id, productId: productRangoId, price: 10, quantity: 2, subtotal: 20 },
      }),
    ])
  })

  afterAll(async () => {
    await prisma.branchMovement.deleteMany({ where: { id: { in: movimientosCreados } } })
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: comprasCreadas } } })
    await prisma.purchase.deleteMany({ where: { id: { in: comprasCreadas } } })
    await prisma.stockControl.deleteMany({ where: { id: { in: [controlCerradoId, controlBorradorId] } } })
    await prisma.product.deleteMany({ where: { id: productRangoId } })
    await prisma.branch.deleteMany({ where: { id: { in: [branchConControlId, branchSinControlId] } } })
  })

  it('desde el último control deja solo lo posterior al cierre, con su fecha en el meta', async () => {
    const { datos, meta } = await rango({ range: 'last-control', branchId: branchConControlId })

    expect(meta?.range).toBe('last-control')
    expect(meta?.controlClosedAt).toBe(cierre.toISOString())
    expect(meta?.since).toBe(cierre.toISOString())

    const ajustes = porTipo(datos, 'ADJUSTMENT')
    expect(ajustes).toHaveLength(1)
    expect(ajustes[0]).toMatchObject({ quantity: 2, branchName: `QA rango A ${sufijo}` })

    const compras = porTipo(datos, 'PURCHASE')
    expect(compras).toHaveLength(1)
    expect(compras[0]).toMatchObject({ quantity: 2, referenceId: comprasCreadas[1] })
  })

  it('sin control cerrado en la sucursal cae a «desde la creación» y lo informa', async () => {
    const { datos, meta } = await rango({ range: 'last-control', branchId: branchSinControlId })

    expect(meta?.range).toBe('created')
    expect(meta?.controlClosedAt).toBeNull()
    expect(meta?.since).toBe(base.toISOString())

    // Toda la vida del producto en esa sucursal, y ninguna fila de la otra.
    const ajustes = porTipo(datos, 'ADJUSTMENT')
    expect(ajustes).toHaveLength(1)
    expect(ajustes[0]).toMatchObject({ quantity: 3, branchName: `QA rango B ${sufijo}` })
    expect(porTipo(datos, 'PURCHASE')).toHaveLength(0)
  })

  it('sin opciones mantiene el comportamiento previo: desde la creación y todas las sucursales', async () => {
    const { datos, meta } = await rango()

    expect(meta?.range).toBe('created')
    expect(meta?.since).toBe(base.toISOString())

    const ajustes = porTipo(datos, 'ADJUSTMENT')
    expect(ajustes.map((a) => a.quantity).sort()).toEqual([1, 2, 3])
    expect(porTipo(datos, 'PURCHASE')).toHaveLength(2)
  })
})
