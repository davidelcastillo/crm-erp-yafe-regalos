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
import { searchProducts } from './product'

jest.setTimeout(30000)

const PREFIX_A = 'ZZ'
const PREFIX_B = 'ZY'
const sufijo = Math.floor(1000 + Math.random() * 9000)

const codeA = `${PREFIX_A}${sufijo}`
const codeB = `${PREFIX_B}${sufijo}`
const nombreA = `QA producto ${sufijo} alfa`
const nombreB = `QA producto ${sufijo} beta`

const ids: number[] = []

describe('searchProducts (integración, base local)', () => {
  beforeAll(async () => {
    const creados = await Promise.all([
      prisma.product.create({
        data: { name: nombreA, code: codeA, codePrefix: PREFIX_A, price: 10 },
      }),
      prisma.product.create({
        data: { name: nombreB, code: codeB, codePrefix: PREFIX_B, price: 20 },
      }),
    ])
    ids.push(...creados.map((p) => p.id))
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: ids } } })
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
})
