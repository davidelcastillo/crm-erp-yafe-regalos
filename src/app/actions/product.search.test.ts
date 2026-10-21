/** @jest-environment node */

/**
 * Integración contra la base local: el buscador del selector de productos
 * (que usa el modal de ventas) tiene que encontrar por código y por prefijo,
 * además de por nombre. Verifica el bug 8.2 del usuario, que reportaba que
 * solo se podía buscar por nombre.
 *
 * Los tests que escriben datos corren con `npm run test:local-db`.
 */
import { prisma } from '@/lib/prisma'
import { getInactiveProducts, searchProducts } from './product'

jest.setTimeout(30000)

const PREFIX_A = 'ZZ'
const PREFIX_B = 'ZY'
const sufijo = Math.floor(1000 + Math.random() * 9000)

const codeA = `${PREFIX_A}${sufijo}`
const codeB = `${PREFIX_B}${sufijo}`
const nombreA = `QA producto ${sufijo} alfa`
const nombreB = `QA producto ${sufijo} beta`

const ids: number[] = []
let branchId = 0

describe('searchProducts (integración, base local)', () => {
  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `QA sucursal ${sufijo}`,
        code: `QA${sufijo}`,
        // authUserId no nulo: `branchAdminService.test.ts` cuenta las sucursales sin
        // authUserId de toda la base y falla si otra suite crea una en paralelo.
        authUserId: `qa-sucursal-${sufijo}`,
      },
    })
    branchId = branch.id

    const creados = await Promise.all([
      prisma.product.create({
        data: { name: nombreA, code: codeA, codePrefix: PREFIX_A, price: 10 },
      }),
      prisma.product.create({
        data: { name: nombreB, code: codeB, codePrefix: PREFIX_B, price: 20 },
      }),
    ])
    ids.push(...creados.map((p) => p.id))

    // En la sucursal: el primero con stock, el segundo en cero.
    await prisma.branchInventory.createMany({
      data: [
        { branchId, productId: ids[0], stock: 5 },
        { branchId, productId: ids[1], stock: 0 },
      ],
    })
  })

  afterAll(async () => {
    await prisma.branchInventory.deleteMany({ where: { branchId } })
    await prisma.product.deleteMany({ where: { id: { in: ids } } })
    await prisma.branch.deleteMany({ where: { id: branchId } })
    await prisma.$disconnect()
  })

  const idsDe = async (query: string) => {
    const resultado = await searchProducts({ query })
    expect(resultado.success).toBe(true)
    return (resultado.data ?? []).map((p) => p.id)
  }

  it('encuentra por código completo', async () => {
    expect(await idsDe(codeA)).toContain(ids[0])
  })

  it('encuentra por código en minúsculas', async () => {
    expect(await idsDe(codeB.toLowerCase())).toContain(ids[1])
  })

  it('encuentra por prefijo', async () => {
    const encontrados = await idsDe(PREFIX_A)
    expect(encontrados).toContain(ids[0])
    expect(encontrados).not.toContain(ids[1])
  })

  it('encuentra por nombre', async () => {
    expect(await idsDe('alfa')).toContain(ids[0])
  })

  it('devuelve la lista vacía con una consulta vacía', async () => {
    expect(await idsDe('   ')).toEqual([])
  })

  // S7.2/S8.1 del usuario: el selector de ventas solo puede ofrecer productos con
  // stock mayor a 0 en la sucursal elegida.
  it('con sucursal, solo devuelve los productos con stock mayor a 0 en esa sucursal', async () => {
    const resultado = await searchProducts({ query: `QA producto ${sufijo}`, branchId })
    expect(resultado.success).toBe(true)

    const encontrados = (resultado.data ?? []).map((p) => p.id)
    expect(encontrados).toContain(ids[0])
    expect(encontrados).not.toContain(ids[1])
  })

  it('sin sucursal no aplica el filtro de stock (etiquetas)', async () => {
    const encontrados = await idsDe(`QA producto ${sufijo}`)
    expect(encontrados).toContain(ids[0])
    expect(encontrados).toContain(ids[1])
  })
})

// S4: la lista de inactivos sale por código (prefijo alfabético + número), que es
// el orden por defecto de todas las listas de productos.
describe('getInactiveProducts — orden por código (integración, base local)', () => {
  const sufijoOrden = Math.floor(1000 + Math.random() * 9000)
  const creados: number[] = []

  beforeAll(async () => {
    // El nombre va al revés del código y la fecha de creación también: si la
    // action ordenara por nombre (o por fecha de modificación) el resultado
    // sería distinto del esperado. Los dos primeros códigos solo se diferencian
    // en los ceros/sufijo numérico (9 antes que 10).
    const filas = [
      { code: `AAA${sufijoOrden}9`, name: `QA orden ${sufijoOrden} zzz`, updatedAt: new Date('2020-01-01T00:00:00.000Z') },
      { code: `AAA${sufijoOrden}10`, name: `QA orden ${sufijoOrden} mmm`, updatedAt: new Date('2020-01-02T00:00:00.000Z') },
      { code: `BBB${sufijoOrden}`, name: `QA orden ${sufijoOrden} aaa`, updatedAt: new Date('2020-01-03T00:00:00.000Z') },
    ]

    for (const fila of filas) {
      const producto = await prisma.product.create({
        data: { ...fila, price: 10, active: false },
      })
      creados.push(producto.id)
    }
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: creados } } })
  })

  it('devuelve los productos por prefijo y número, no por nombre ni por fecha', async () => {
    const resultado = await getInactiveProducts()
    expect(resultado.success).toBe(true)

    const codigos = (resultado.data ?? [])
      .filter((producto) => creados.includes(producto.id))
      .map((producto) => producto.code)

    expect(codigos).toEqual([
      `AAA${sufijoOrden}9`,
      `AAA${sufijoOrden}10`,
      `BBB${sufijoOrden}`,
    ])
  })
})
