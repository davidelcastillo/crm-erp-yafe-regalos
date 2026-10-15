// Los tests que escriben en base solo pueden apuntar a una base local: si el
// cliente Prisma se construye contra un host remoto, el módulo tiene que fallar.
describe('prisma en entorno de tests', () => {
  const original = process.env.DATABASE_URL
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.DATABASE_URL = original
    process.env.NODE_ENV = originalNodeEnv
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

  // Jest corre igual con NODE_ENV prefijado: la guarda no puede depender de eso.
  it('rechaza una base que no es local tambien con NODE_ENV=development', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@remoto.example.com:5432/postgres'
    jest.resetModules()

    await expect(import('./prisma')).rejects.toThrow(/no pueden escribir/i)
  })
})
