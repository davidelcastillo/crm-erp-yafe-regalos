// Los tests que escriben en base solo pueden apuntar a una base local: si el
// cliente Prisma se construye contra un host remoto, el módulo tiene que fallar.
// `process.env.NODE_ENV` está declarado readonly; el test lo escribe a propósito.
const env = process.env as Record<string, string | undefined>;

describe('prisma en entorno de tests', () => {
  const original = env.DATABASE_URL
  const originalNodeEnv = env.NODE_ENV

  afterEach(() => {
    env.DATABASE_URL = original
    if (originalNodeEnv === undefined) delete env.NODE_ENV
    else env.NODE_ENV = originalNodeEnv
  })

  it('rechaza una base que no es local', async () => {
    env.DATABASE_URL = 'postgresql://postgres:postgres@remoto.example.com:5432/postgres'
    jest.resetModules()

    await expect(import('./prisma')).rejects.toThrow(/no pueden escribir/i)
  })

  it('acepta la base local', async () => {
    env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
    jest.resetModules()

    await expect(import('./prisma')).resolves.toBeDefined()
  })

  // Jest corre igual con NODE_ENV prefijado: la guarda no puede depender de eso.
  it('rechaza una base que no es local tambien con NODE_ENV=development', async () => {
    env.NODE_ENV = 'development'
    env.DATABASE_URL = 'postgresql://postgres:postgres@remoto.example.com:5432/postgres'
    jest.resetModules()

    await expect(import('./prisma')).rejects.toThrow(/no pueden escribir/i)
  })
})
