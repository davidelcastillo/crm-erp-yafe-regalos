/** @jest-environment node */

/**
 * Integración contra la base local: las tarjetas del dashboard tienen que
 * responder al filtro de período. Bug 4 del usuario: con un rango personalizado
 * los movimientos del día elegido no se contaban, porque el rango se armaba con
 * `new Date("YYYY-MM-DD")` (medianoche UTC) y con `lte` el día final quedaba
 * afuera.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { getStats } from './dashboard'

jest.setTimeout(30000)

/** Fecha local en formato YYYY-MM-DD (independiente de la zona horaria). */
const aFechaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const hoy = aFechaLocal(new Date())
const haceVeinteDias = aFechaLocal(new Date(Date.now() - 20 * 24 * 60 * 60 * 1000))

const sufijo = Math.floor(1000 + Math.random() * 9000)
let branchId = 0
const ventasIds: number[] = []

const ingresos = async (parametros: Record<string, unknown>) => {
  const resultado = await getStats({ branchId, ...parametros })
  expect(resultado.success).toBe(true)
  return (resultado.data as { totalIncome: number }).totalIncome
}

describe('getStats por período (integración, base local)', () => {
  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `QA dashboard ${sufijo}`,
        code: `QD${sufijo}`,
        // authUserId no nulo: `branchAdminService.test.ts` cuenta las sucursales sin
        // authUserId de toda la base y falla si otra suite crea una en paralelo.
        authUserId: `qa-dashboard-${sufijo}`,
      },
    })
    branchId = branch.id

    const ventas = await Promise.all([
      prisma.sale.create({
        data: { branchId, totalAmount: 100, amountPaid: 100, paymentMethod: 'EFECTIVO' },
      }),
      prisma.sale.create({
        data: {
          branchId,
          totalAmount: 50,
          amountPaid: 50,
          paymentMethod: 'EFECTIVO',
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      }),
    ])
    ventasIds.push(...ventas.map((v) => v.id))
  })

  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { id: { in: ventasIds } } })
    await prisma.branch.deleteMany({ where: { id: branchId } })
    await prisma.$disconnect()
  })

  it('con un rango de un solo día cuenta lo vendido ese día', async () => {
    expect(await ingresos({ type: 'custom', startDate: hoy, endDate: hoy })).toBe(100)
  })

  it('con un rango que incluye ambos días suma las dos ventas', async () => {
    expect(
      await ingresos({ type: 'custom', startDate: haceVeinteDias, endDate: hoy })
    ).toBe(150)
  })

  it('con un rango que termina antes de la venta vieja solo cuenta la de hoy', async () => {
    expect(await ingresos({ type: '7' })).toBe(100)
  })

  it('rechaza un rango con fechas inválidas', async () => {
    const resultado = await getStats({
      branchId,
      type: 'custom',
      startDate: 'no-es-fecha',
      endDate: hoy,
    })
    expect(resultado.success).toBe(false)
  })
})
