/** @jest-environment node */

/**
 * Integración contra la base local: el gráfico de ingresos vs egresos tiene que
 * seguir el período que se elige en el dashboard (bug 5 del usuario: «Agregar
 * opción para mostrar el grafico de 7 dias, 1 mes, 3 meses o personalizado»).
 *
 * La acción recibía solo `days` y armaba siempre los últimos N días, así que el
 * rango personalizado se ignoraba.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { getPerformanceData } from './dashboard'

jest.setTimeout(30000)

/** Fecha local en formato YYYY-MM-DD (independiente de la zona horaria). */
const aFechaLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const aLasHorasDeHoy = (horas: number, minutos: number) =>
  new Date(new Date().setHours(horas, minutos, 0, 0))

const hoy = aFechaLocal(new Date())
const haceDiezDias = aFechaLocal(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000))

const sufijo = Math.floor(1000 + Math.random() * 9000)
const VENTA_TARDE = 70
let branchId = 0
const ventasIds: number[] = []

type Punto = { date: string; income: number; expense: number }

const puntos = async (parametros: Record<string, unknown>) => {
  const resultado = await getPerformanceData({ branchId, ...parametros })
  expect(resultado.success).toBe(true)
  return resultado.data as Punto[]
}

describe('getPerformanceData por período (integración, base local)', () => {
  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `QA grafico ${sufijo}`,
        code: `QG${sufijo}`,
        // authUserId no nulo: `branchAdminService.test.ts` cuenta las sucursales sin
        // authUserId de toda la base y falla si otra suite crea una en paralelo.
        authUserId: `qa-grafico-${sufijo}`,
      },
    })
    branchId = branch.id

    const ventas = await Promise.all([
      prisma.sale.create({
        data: {
          branchId,
          totalAmount: 100,
          amountPaid: 100,
          paymentMethod: 'EFECTIVO',
          date: aLasHorasDeHoy(10, 0),
        },
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
      // Tarde en hora local: en UTC ya es el día siguiente.
      prisma.sale.create({
        data: {
          branchId,
          totalAmount: VENTA_TARDE,
          amountPaid: VENTA_TARDE,
          paymentMethod: 'EFECTIVO',
          date: aLasHorasDeHoy(23, 30),
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

  it('con un rango de un solo día devuelve solo ese día', async () => {
    const datos = await puntos({ startDate: hoy, endDate: hoy })

    expect(datos.map((d) => d.date)).toEqual([hoy])
    // Incluye la venta de las 23:30 locales: si el día se armara en UTC, caería afuera.
    expect(datos[0].income).toBe(100 + VENTA_TARDE)
    expect(datos[0].expense).toBe(0)
  })

  it('con un rango personalizado de un día viejo trae la venta de ese día', async () => {
    const datos = await puntos({ startDate: haceDiezDias, endDate: haceDiezDias })

    expect(datos.map((d) => d.date)).toEqual([haceDiezDias])
    expect(datos[0].income).toBe(50)
  })

  it('con un rango de varios días devuelve un punto por día, en orden', async () => {
    const datos = await puntos({ startDate: haceDiezDias, endDate: hoy })

    expect(datos).toHaveLength(11)
    expect(datos[0].date).toBe(haceDiezDias)
    expect(datos[10].date).toBe(hoy)
    // Los días sin movimiento existen en el eje, con 0.
    expect(datos[1].income).toBe(0)
  })

  // Regresión del comportamiento previo, que comparte el código del rango.
  it('sin rango personalizado mantiene los últimos N días', async () => {
    const datos = await puntos({ days: 7 })

    expect(datos).toHaveLength(7)
    expect(datos[6].date).toBe(hoy)
    expect(datos[6].income).toBe(100 + VENTA_TARDE)
  })

  it('rechaza un rango incompleto o inválido', async () => {
    const incompleto = await getPerformanceData({ branchId, startDate: hoy })
    expect(incompleto.success).toBe(false)

    const invalido = await getPerformanceData({
      branchId,
      startDate: 'no-es-fecha',
      endDate: hoy,
    })
    expect(invalido.success).toBe(false)

    const alReves = await getPerformanceData({
      branchId,
      startDate: hoy,
      endDate: haceDiezDias,
    })
    expect(alReves.success).toBe(false)
  })
})
