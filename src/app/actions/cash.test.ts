/** @jest-environment node */

/**
 * Integración contra la base local: plata de caja de una sucursal.
 *
 * S14 del usuario: «agreguemos la opcion de hacer el CashMovement tambien».
 * S18 (L24): el movimiento lleva **fecha propia, elegible al cargar** y **entra
 * en el balance del dashboard**.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { toLocalDateKey } from '@/lib/dates'
import { getCashMovements, registerCashMovement } from './cash'
import { getStats } from './dashboard'

jest.setTimeout(30000)

const sufijo = Math.floor(1000 + Math.random() * 9000)
const ACTOR = `qa-caja-${sufijo}@local`

let branchId = 0
let branchInactivaId = 0
const ids: number[] = []

const guardar = async (data: unknown) => {
  const resultado = await registerCashMovement(data)
  if (resultado.success && resultado.data) ids.push(resultado.data.id)
  return resultado
}

describe('plata de caja (integración, base local)', () => {
  beforeAll(async () => {
    const [branch, inactiva] = await Promise.all([
      prisma.branch.create({
        data: {
          name: `QA caja ${sufijo}`,
          code: `QF${sufijo}`,
          authUserId: `qa-caja-${sufijo}`,
        },
      }),
      prisma.branch.create({
        data: {
          name: `QA caja inactiva ${sufijo}`,
          code: `QG${sufijo}`,
          authUserId: `qa-caja-inactiva-${sufijo}`,
          isActive: false,
        },
      }),
    ])
    branchId = branch.id
    branchInactivaId = inactiva.id
  })

  afterAll(async () => {
    await prisma.cashMovement.deleteMany({ where: { id: { in: ids } } })
    await prisma.branch.deleteMany({
      where: { id: { in: [branchId, branchInactivaId] } },
    })
    await prisma.$disconnect()
  })

  it('registra un INGRESO con la fecha propia que elige el usuario', async () => {
    const resultado = await guardar({
      branchId,
      type: 'INGRESO',
      method: 'EFECTIVO',
      amount: 1500,
      date: '2026-03-04',
      description: 'Corrección de conteo',
      performedBy: ACTOR,
    })

    expect(resultado.success).toBe(true)
    const fila = await prisma.cashMovement.findUniqueOrThrow({
      where: { id: resultado.data!.id },
    })
    expect(fila).toMatchObject({
      branchId,
      type: 'INGRESO',
      method: 'EFECTIVO',
      description: 'Corrección de conteo',
      performedBy: ACTOR,
    })
    expect(Number(fila.amount)).toBe(1500)
    // Día calendario local, no medianoche UTC: si no, en UTC-3 cae el día anterior.
    expect(toLocalDateKey(fila.date)).toBe('2026-03-04')
    expect(fila.date.getHours()).toBe(0)
  })

  it('sin fecha guarda el momento de la carga', async () => {
    const antes = Date.now()
    const resultado = await guardar({
      branchId,
      type: 'EGRESO',
      method: 'TRANSFERENCIA',
      amount: 400,
      performedBy: ACTOR,
    })

    expect(resultado.success).toBe(true)
    const fila = await prisma.cashMovement.findUniqueOrThrow({
      where: { id: resultado.data!.id },
    })
    expect(fila.date.getTime()).toBeGreaterThanOrEqual(antes)
    expect(toLocalDateKey(fila.date)).toBe(toLocalDateKey(new Date()))
  })

  it('lista los movimientos de la sucursal con sus totales y filtra por fecha', async () => {
    const todos = await getCashMovements({ branchId })
    expect(todos.success).toBe(true)
    expect(todos.data!.items.length).toBeGreaterThanOrEqual(2)
    expect(todos.data!.totals).toEqual({ ingresos: 1500, egresos: 400, balance: 1100 })

    const soloElDia = await getCashMovements({
      branchId,
      startDate: '2026-03-04',
      endDate: '2026-03-04',
    })
    expect(soloElDia.success).toBe(true)
    expect(soloElDia.data!.items).toHaveLength(1)
    expect(soloElDia.data!.items[0]).toMatchObject({ type: 'INGRESO', amount: 1500 })
    expect(soloElDia.data!.totals).toEqual({ ingresos: 1500, egresos: 0, balance: 1500 })
  })

  it('rechaza un monto no positivo y una sucursal inactiva', async () => {
    const cero = await registerCashMovement({
      branchId,
      type: 'INGRESO',
      amount: 0,
      performedBy: ACTOR,
    })
    expect(cero.success).toBe(false)

    const negativo = await registerCashMovement({
      branchId,
      type: 'EGRESO',
      amount: -10,
      performedBy: ACTOR,
    })
    expect(negativo.success).toBe(false)

    const inactiva = await registerCashMovement({
      branchId: branchInactivaId,
      type: 'INGRESO',
      amount: 100,
      performedBy: ACTOR,
    })
    expect(inactiva.success).toBe(false)
    expect(inactiva.error).toContain('inactiva')

    const fechaImposible = await registerCashMovement({
      branchId,
      type: 'INGRESO',
      amount: 100,
      date: '2026-02-31',
      performedBy: ACTOR,
    })
    expect(fechaImposible.success).toBe(false)

    expect(await prisma.cashMovement.count({ where: { branchId: branchInactivaId } })).toBe(0)
    // Los intentos rechazados no dejaron filas.
    expect(await prisma.cashMovement.count({ where: { branchId } })).toBe(ids.length)
  })

  it('el INGRESO suma a los ingresos del tablero y el EGRESO a los egresos', async () => {
    const antes = await getStats({ type: '7', branchId })
    expect(antes.success).toBe(true)

    await guardar({
      branchId,
      type: 'INGRESO',
      method: 'EFECTIVO',
      amount: 200,
      performedBy: ACTOR,
    })
    await guardar({
      branchId,
      type: 'EGRESO',
      method: 'EFECTIVO',
      amount: 50,
      performedBy: ACTOR,
    })

    const despues = await getStats({ type: '7', branchId })
    expect(despues.success).toBe(true)
    expect(despues.data!.totalIncome - antes.data!.totalIncome).toBeCloseTo(200)
    expect(despues.data!.totalExpense - antes.data!.totalExpense).toBeCloseTo(50)
  })
})
