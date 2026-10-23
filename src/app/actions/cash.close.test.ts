/** @jest-environment node */

/**
 * Integración contra la base local: cierre de caja por sucursal (T9).
 *
 * S9 del usuario: el cierre muestra el total de las ventas de la sucursal por
 * método de pago (efectivo a retirar, transferencia a verificar, mixto aparte) y
 * persiste el corte. S17: cerrada la caja, los indicadores se **resetean** — las
 * ventas y la plata anteriores al último cierre dejan de contar — sin perder el
 * histórico (las ventas no se tocan). S19: el corte viaja en la misma migración
 * que `CashMovement`.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { closeCash, getCashClosePreview } from './cash'
import { getStats, getPerformanceData } from './dashboard'

jest.setTimeout(30000)

const sufijo = Math.floor(1000 + Math.random() * 9000)
const ACTOR = `qa-cierre-${sufijo}@local`
const NOMBRE_SUCURSAL = `QA cierre ${sufijo}`

// Caja que se cierra: 100 efectivo + 50 transferencia + 30 mixto.
const EFECTIVO = 100
const TRANSFERENCIA = 50
const MIXTO = 30

// Después del cierre: una venta nueva y un ingreso de plata; antes, una venta
// vieja y un ingreso viejo que no deben contar. La compra sí sigue contando.
const VENTA_ANTERIOR = 900
const VENTA_NUEVA = 70
const INGRESO_ANTERIOR = 999
const INGRESO_POSTERIOR = 40
const COMPRA_DEL_PERIODO = 500
const COMPRA_ANTERIOR = 700

let branchId = 0
let branchInactivaId = 0
let productoId = 0

const ventasIds: number[] = []
const comprasIds: number[] = []

/** Venta directa con un ítem del producto propio (no pasa por `registerSale`). */
const crearVenta = (
  totalAmount: number,
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO',
  date?: Date
) =>
  prisma.sale.create({
    data: {
      branchId,
      totalAmount,
      paymentMethod,
      ...(date ? { date } : {}),
      items: {
        create: [
          { productId: productoId, price: totalAmount, quantity: 1, subtotal: totalAmount },
        ],
      },
    },
  })

describe('cierre de caja (integración, base local)', () => {
  beforeAll(async () => {
    const [branch, inactiva] = await Promise.all([
      prisma.branch.create({
        data: {
          name: NOMBRE_SUCURSAL,
          code: `QC${sufijo}`,
          authUserId: `qa-cierre-${sufijo}`,
        },
      }),
      prisma.branch.create({
        data: {
          name: `QA cierre inactiva ${sufijo}`,
          code: `QH${sufijo}`,
          authUserId: `qa-cierre-inactiva-${sufijo}`,
          isActive: false,
        },
      }),
    ])
    branchId = branch.id
    branchInactivaId = inactiva.id

    const producto = await prisma.product.create({
      data: { name: `QA cierre producto ${sufijo}`, code: `QC${sufijo}-1`, price: 1 },
    })
    productoId = producto.id

    const ventas = await Promise.all([
      crearVenta(EFECTIVO, 'EFECTIVO'),
      crearVenta(TRANSFERENCIA, 'TRANSFERENCIA'),
      crearVenta(MIXTO, 'MIXTO'),
    ])
    ventasIds.push(...ventas.map((v) => v.id))
  })

  afterAll(async () => {
    await prisma.cashClose.deleteMany({
      where: { branchId: { in: [branchId, branchInactivaId] } },
    })
    await prisma.cashMovement.deleteMany({
      where: { branchId: { in: [branchId, branchInactivaId] } },
    })
    await prisma.saleItem.deleteMany({ where: { saleId: { in: ventasIds } } })
    await prisma.sale.deleteMany({
      where: { branchId: { in: [branchId, branchInactivaId] } },
    })
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: comprasIds } } })
    await prisma.purchase.deleteMany({
      where: { branchId: { in: [branchId, branchInactivaId] } },
    })
    await prisma.product.deleteMany({ where: { id: productoId } })
    await prisma.branch.deleteMany({ where: { id: { in: [branchId, branchInactivaId] } } })
    await prisma.$disconnect()
  })

  it('(a) el preview suma por método de pago y arranca sin cierre previo', async () => {
    const resultado = await getCashClosePreview({ branchId })
    if (!resultado.success) throw new Error(resultado.error)

    expect(resultado.data).toMatchObject({
      branchName: NOMBRE_SUCURSAL,
      since: null,
      cashTotal: EFECTIVO,
      transferTotal: TRANSFERENCIA,
      mixedTotal: MIXTO,
      total: EFECTIVO + TRANSFERENCIA + MIXTO,
      salesCount: 3,
    })
  })

  it('(b) closeCash persiste el corte y no toca las ventas', async () => {
    const ventasAntes = await prisma.sale.count({ where: { branchId } })

    const resultado = await closeCash({ branchId, performedBy: ACTOR })
    if (!resultado.success) throw new Error(resultado.error)

    const fila = await prisma.cashClose.findUniqueOrThrow({
      where: { id: resultado.data!.id },
    })
    expect(fila.branchId).toBe(branchId)
    expect(fila.closedBy).toBe(ACTOR)
    expect(Number(fila.cashTotal)).toBe(EFECTIVO)
    expect(Number(fila.transferTotal)).toBe(TRANSFERENCIA)
    expect(Number(fila.mixedTotal)).toBe(MIXTO)
    expect(Number(fila.total)).toBe(EFECTIVO + TRANSFERENCIA + MIXTO)

    // El cierre ordena la plata, no borra ventas: el histórico queda intacto.
    expect(await prisma.sale.count({ where: { branchId } })).toBe(ventasAntes)
  })

  it('(c) el período «desde el último cierre» resetea todo; los períodos de días muestran el rango completo', async () => {
    const corte = await prisma.cashClose.findFirstOrThrow({
      where: { branchId },
      orderBy: { closedAt: 'desc' },
    })
    const closedAt = corte.closedAt

    // Venta anterior al cierre: es de la caja cerrada y no debe contar.
    const anterior = await crearVenta(
      VENTA_ANTERIOR,
      'EFECTIVO',
      new Date(closedAt.getTime() - 60_000)
    )
    // Venta nueva: posterior al cierre y hasta el próximo corte.
    const nueva = await crearVenta(VENTA_NUEVA, 'EFECTIVO')
    ventasIds.push(anterior.id, nueva.id)

    await prisma.cashMovement.create({
      data: {
        branchId,
        type: 'INGRESO',
        method: 'EFECTIVO',
        amount: INGRESO_POSTERIOR,
        performedBy: ACTOR,
      },
    })
    await prisma.cashMovement.create({
      data: {
        branchId,
        type: 'INGRESO',
        method: 'EFECTIVO',
        amount: INGRESO_ANTERIOR,
        date: new Date(closedAt.getTime() - 60_000),
        performedBy: ACTOR,
      },
    })

    // La compra del período: en el período del cierre cuenta (el piso mide todo
    // desde el corte), y en un período de días también.
    const compra = await prisma.purchase.create({
      data: { branchId, totalAmount: COMPRA_DEL_PERIODO },
    })
    comprasIds.push(compra.id)

    // Compra anterior al cierre: solo entra en un período de días.
    const compraAnterior = await prisma.purchase.create({
      data: {
        branchId,
        totalAmount: COMPRA_ANTERIOR,
        date: new Date(closedAt.getTime() - 60_000),
      },
    })
    comprasIds.push(compraAnterior.id)

    const preview = await getCashClosePreview({ branchId })
    if (!preview.success) throw new Error(preview.error)
    // El ingreso posterior al cierre también entra al corte nuevo (S1/S2): el
    // movimiento viejo queda afuera, el nuevo suma en su medio.
    expect(preview.data).toMatchObject({
      since: closedAt.toISOString(),
      cashTotal: VENTA_NUEVA + INGRESO_POSTERIOR,
      transferTotal: 0,
      mixedTotal: 0,
      total: VENTA_NUEVA + INGRESO_POSTERIOR,
      salesCount: 1,
    })

    // El período del cierre es el único con piso: solo lo posterior al corte.
    const cierre = await getStats({ type: 'cierre', branchId })
    if (!cierre.success) throw new Error(cierre.error)
    expect(cierre.data!.totalIncome).toBe(VENTA_NUEVA + INGRESO_POSTERIOR)
    expect(cierre.data!.totalExpense).toBe(COMPRA_DEL_PERIODO)

    // Un período de días muestra todo lo que cae en el rango, sin piso de cierre.
    const semana = await getStats({ type: '7', branchId })
    if (!semana.success) throw new Error(semana.error)
    expect(semana.data!.totalIncome).toBe(
      EFECTIVO + TRANSFERENCIA + MIXTO + VENTA_ANTERIOR + VENTA_NUEVA + INGRESO_ANTERIOR + INGRESO_POSTERIOR
    )
    expect(semana.data!.totalExpense).toBe(COMPRA_DEL_PERIODO + COMPRA_ANTERIOR)

    // El gráfico sigue el mismo criterio que las tarjetas.
    const grafico = await getPerformanceData({ type: 'cierre', branchId })
    if (!grafico.success) throw new Error(grafico.error)
    const sumar = (campo: 'income' | 'expense') =>
      grafico.data!.reduce((acc, dia) => acc + dia[campo], 0)
    expect(sumar('income')).toBe(VENTA_NUEVA + INGRESO_POSTERIOR)
    expect(sumar('expense')).toBe(COMPRA_DEL_PERIODO)
  })

  it('(d) rechaza el cierre de una sucursal inactiva sin dejar corte', async () => {
    const resultado = await closeCash({ branchId: branchInactivaId, performedBy: ACTOR })
    if (resultado.success) throw new Error('debería rechazar la sucursal inactiva')

    expect(resultado.error).toContain('inactiva')
    expect(
      await prisma.cashClose.count({ where: { branchId: branchInactivaId } })
    ).toBe(0)
  })
})

/**
 * Los movimientos de caja entran al corte (S1/S2): cada uno suma o resta en su
 * medio, dentro de la misma ventana que las ventas (S4), sin recortar los
 * negativos (S5) y plegados en las columnas que ya existen (S6).
 */
describe('cierre de caja con movimientos (integración, base local)', () => {
  const sufijoMov = Math.floor(1000 + Math.random() * 9000)
  const NOMBRE_MOV = `QA movimientos ${sufijoMov}`
  const ACTOR_MOV = `qa-movimientos-${sufijoMov}@local`

  let branchMovId = 0
  let productoMovId = 0
  const ventasMovIds: number[] = []

  const crearVentaMov = (
    totalAmount: number,
    paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO'
  ) =>
    prisma.sale.create({
      data: {
        branchId: branchMovId,
        totalAmount,
        paymentMethod,
        items: {
          create: [
            {
              productId: productoMovId,
              price: totalAmount,
              quantity: 1,
              subtotal: totalAmount,
            },
          ],
        },
      },
    })

  const crearMovimiento = (
    type: 'INGRESO' | 'EGRESO',
    method: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO',
    amount: number,
    date?: Date
  ) =>
    prisma.cashMovement.create({
      data: {
        branchId: branchMovId,
        type,
        method,
        amount,
        performedBy: ACTOR_MOV,
        ...(date ? { date } : {}),
      },
    })

  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: NOMBRE_MOV,
        code: `QM${sufijoMov}`,
        authUserId: `qa-movimientos-${sufijoMov}`,
      },
    })
    branchMovId = branch.id

    const producto = await prisma.product.create({
      data: {
        name: `QA movimientos producto ${sufijoMov}`,
        code: `QM${sufijoMov}-1`,
        price: 1,
      },
    })
    productoMovId = producto.id

    const ventas = await Promise.all([
      crearVentaMov(EFECTIVO, 'EFECTIVO'),
      crearVentaMov(TRANSFERENCIA, 'TRANSFERENCIA'),
      crearVentaMov(MIXTO, 'MIXTO'),
    ])
    ventasMovIds.push(...ventas.map((v) => v.id))
  })

  afterAll(async () => {
    await prisma.cashClose.deleteMany({ where: { branchId: branchMovId } })
    await prisma.cashMovement.deleteMany({ where: { branchId: branchMovId } })
    await prisma.saleItem.deleteMany({ where: { saleId: { in: ventasMovIds } } })
    await prisma.sale.deleteMany({ where: { branchId: branchMovId } })
    await prisma.product.deleteMany({ where: { id: productoMovId } })
    await prisma.branch.deleteMany({ where: { id: branchMovId } })
  })

  it('(a) sin movimientos el corte queda igual que antes: solo ventas', async () => {
    const resultado = await getCashClosePreview({ branchId: branchMovId })
    if (!resultado.success) throw new Error(resultado.error)

    expect(resultado.data).toMatchObject({
      since: null,
      cashTotal: EFECTIVO,
      transferTotal: TRANSFERENCIA,
      mixedTotal: MIXTO,
      total: EFECTIVO + TRANSFERENCIA + MIXTO,
      salesCount: 3,
      desglose: {
        efectivo: { ventas: EFECTIVO, ingresos: 0, egresos: 0, total: EFECTIVO },
        transferencia: {
          ventas: TRANSFERENCIA,
          ingresos: 0,
          egresos: 0,
          total: TRANSFERENCIA,
        },
        mixto: { ventas: MIXTO, ingresos: 0, egresos: 0, total: MIXTO },
      },
    })
  })

  it('(b) un ingreso suma y un egreso resta en su propio medio', async () => {
    await crearMovimiento('INGRESO', 'EFECTIVO', 40)
    await crearMovimiento('EGRESO', 'EFECTIVO', 15)

    const resultado = await getCashClosePreview({ branchId: branchMovId })
    if (!resultado.success) throw new Error(resultado.error)

    // El efectivo mezcla los dos movimientos; los otros medios no se mueven.
    expect(resultado.data).toMatchObject({
      cashTotal: EFECTIVO + 40 - 15,
      transferTotal: TRANSFERENCIA,
      mixedTotal: MIXTO,
      total: EFECTIVO + 40 - 15 + TRANSFERENCIA + MIXTO,
      salesCount: 3,
      desglose: {
        efectivo: { ventas: EFECTIVO, ingresos: 40, egresos: 15, total: EFECTIVO + 40 - 15 },
      },
    })
  })

  it('(c) un ingreso por transferencia sube la transferencia a verificar', async () => {
    await crearMovimiento('INGRESO', 'TRANSFERENCIA', 20)

    const resultado = await getCashClosePreview({ branchId: branchMovId })
    if (!resultado.success) throw new Error(resultado.error)

    expect(resultado.data).toMatchObject({
      cashTotal: EFECTIVO + 40 - 15,
      transferTotal: TRANSFERENCIA + 20,
      mixedTotal: MIXTO,
      desglose: {
        transferencia: {
          ventas: TRANSFERENCIA,
          ingresos: 20,
          egresos: 0,
          total: TRANSFERENCIA + 20,
        },
      },
    })
  })

  it('(d) un egreso puede dejar el medio en negativo y el corte lo persiste plegado', async () => {
    await crearMovimiento('EGRESO', 'EFECTIVO', 200)
    // El tercer medio también tiene su línea: se pliega en `mixedTotal`.
    await crearMovimiento('INGRESO', 'MIXTO', 5)

    const preview = await getCashClosePreview({ branchId: branchMovId })
    if (!preview.success) throw new Error(preview.error)

    // S5: la caja quedó corta y el número lo dice; no se recorta a 0.
    expect(preview.data).toMatchObject({
      cashTotal: EFECTIVO + 40 - 15 - 200,
      mixedTotal: MIXTO + 5,
      total: EFECTIVO + 40 - 15 - 200 + TRANSFERENCIA + 20 + MIXTO + 5,
    })
    expect(preview.data!.cashTotal).toBeLessThan(0)

    // S6: sin migración, los movimientos se pliegan en las columnas del corte.
    const cierre = await closeCash({ branchId: branchMovId, performedBy: ACTOR_MOV })
    if (!cierre.success) throw new Error(cierre.error)

    const fila = await prisma.cashClose.findUniqueOrThrow({
      where: { id: cierre.data!.id },
    })
    expect(Number(fila.cashTotal)).toBe(EFECTIVO + 40 - 15 - 200)
    expect(Number(fila.transferTotal)).toBe(TRANSFERENCIA + 20)
    expect(Number(fila.mixedTotal)).toBe(MIXTO + 5)
    expect(Number(fila.total)).toBe(
      EFECTIVO + 40 - 15 - 200 + TRANSFERENCIA + 20 + MIXTO + 5
    )
  })

  it('(e) la ventana es la de las ventas: el movimiento anterior al cierre no cuenta', async () => {
    const corte = await prisma.cashClose.findFirstOrThrow({
      where: { branchId: branchMovId },
      orderBy: { closedAt: 'desc' },
    })

    // Anterior al corte: ya se firmó en el cierre anterior, no vuelve a entrar.
    await crearMovimiento(
      'INGRESO',
      'EFECTIVO',
      999,
      new Date(corte.closedAt.getTime() - 60_000)
    )
    // Posterior: entra una sola vez; el próximo cierre mueve el piso.
    await crearMovimiento(
      'INGRESO',
      'EFECTIVO',
      30,
      new Date(corte.closedAt.getTime() + 60_000)
    )

    const resultado = await getCashClosePreview({ branchId: branchMovId })
    if (!resultado.success) throw new Error(resultado.error)

    expect(resultado.data).toMatchObject({
      since: corte.closedAt.toISOString(),
      cashTotal: 30,
      transferTotal: 0,
      mixedTotal: 0,
      total: 30,
      salesCount: 0,
      desglose: {
        efectivo: { ventas: 0, ingresos: 30, egresos: 0, total: 30 },
      },
    })
  })
})
