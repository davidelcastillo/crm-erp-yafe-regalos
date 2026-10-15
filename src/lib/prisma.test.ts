// Los tests que escriben en base solo pueden apuntar a una base local: si el
// cliente Prisma se construye contra un host remoto, el módulo tiene que fallar.
describe('prisma en entorno de tests', () => {
  const original = process.env.DATABASE_URL

  afterEach(() => {
    process.env.DATABASE_URL = original
  })

  it('rechaza una base que no es local', async () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@remoto.example.com:5432/postgres'
    jest.resetModules()

    await expect(import('./prisma')).rejects.toThrow(/no pueden escribir/i)
  })

  it('acepta la base local', async () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    jest.resetModules()

    await expect(import('./prisma')).resolves.toBeDefined()
  })
})
