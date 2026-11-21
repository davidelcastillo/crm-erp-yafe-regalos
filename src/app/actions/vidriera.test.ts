/**
 * Unit tests de la vidriera pública (src/app/actions/vidriera.ts), T4/T5 de
 * `odd/tasks/fotos-vidriera-polkalinas.md` (S2 + S4).
 *
 * Cubre:
 *   - solo se publica lo marcado en el canal «Web» (PrendaPublicacion) y activo
 *   - estados derivados: prenda Disponible/Reservada/Vendida, producto Agotado
 *   - filtro por categoría de prenda y búsqueda por texto
 *   - ficha: fotos ordenadas por posición, URL `_lg`, talles, categoría, condición
 *   - no publicado y no existente devuelven la misma respuesta (sin filtrar
 *     la existencia) y el select no pide ningún dato interno (costo, clientes,
 *     stock por sucursal)
 *
 * El mock de Prisma aplica los filtros del `where` como la base real, así el
 * test ejerce la consulta que arma la acción y no solo el formateo.
 */
import { getVidriera, getVidrieraItem } from "@/app/actions/vidriera";

const mockProductFindMany = jest.fn();
const mockProductFindFirst = jest.fn();
const mockInventoryGroupBy = jest.fn();
const mockInventoryFindMany = jest.fn();
const mockPedidoItemFindMany = jest.fn();
const mockSaleItemFindMany = jest.fn();
const mockCategoriaFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
      findFirst: (...args: unknown[]) => mockProductFindFirst(...args),
    },
    branchInventory: {
      groupBy: (...args: unknown[]) => mockInventoryGroupBy(...args),
      findMany: (...args: unknown[]) => mockInventoryFindMany(...args),
    },
    pedidoItem: { findMany: (...args: unknown[]) => mockPedidoItemFindMany(...args) },
    saleItem: { findMany: (...args: unknown[]) => mockSaleItemFindMany(...args) },
    categoriaPrenda: { findMany: (...args: unknown[]) => mockCategoriaFindMany(...args) },
  },
}));

type Fila = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price: number;
  kind: "PRENDA" | "PRODUCT";
  active: boolean;
  /** Categoría propia del producto normal (las prendas usan la de prenda). */
  category: { id: number; name: string } | null;
  /** Canales de `PrendaPublicacion`: la vidriera solo muestra «Web». */
  canales: string[];
  images: { path: string; alt: string | null }[];
  prenda: {
    categoria: { id: number; name: string } | null;
    condicion: { name: string } | null;
    detalleCondicion?: string | null;
    talles?: { talle: string }[];
  } | null;
};

const CAMPERA: Fila = {
  id: 1,
  code: "PK-1",
  name: "Campera de jean",
  // Placeholder heredado: la ficha pública lo devuelve vacío.
  description: "-",
  price: 45000,
  kind: "PRENDA",
  active: true,
  category: null,
  canales: ["Web"],
  images: [
    { path: "hash-portada", alt: "Campera de frente" },
    { path: "hash-espalda", alt: null },
  ],
  prenda: {
    categoria: { id: 7, name: "Camperas" },
    condicion: { name: "Muy bueno" },
    detalleCondicion: "Con marcas en el ruedo",
    talles: [{ talle: "M" }, { talle: "S" }],
  },
};

const REMERA: Fila = {
  id: 2,
  code: "PK-2",
  name: "Remera lisa",
  description: "Remera de algodón",
  price: 12000,
  kind: "PRENDA",
  active: true,
  category: null,
  // Publicada en Instagram, no en la web: no va a la vidriera.
  canales: ["Instagram"],
  images: [],
  prenda: {
    categoria: { id: 8, name: "Tops" },
    condicion: { name: "Nuevo" },
    talles: [{ talle: "L" }],
  },
};

const PERFUME: Fila = {
  id: 3,
  code: "AR-1",
  name: "Perfume floral",
  description: "Perfume floral 100 ml",
  price: 30000,
  kind: "PRODUCT",
  active: true,
  category: { id: 9, name: "Perfumes" },
  canales: ["Web"],
  images: [{ path: "hash-perfume", alt: null }],
  prenda: null,
};

const PUBLICADAS = [CAMPERA, REMERA, PERFUME];

type FilaStock = { productId: number; branch: { id: number; name: string }; stock: number };

/** Stock por (producto, sucursal): el `groupBy` lo suma y la ficha lista las
 * sucursales con stock > 0. Un producto sin filas está en 0. */
let INVENTARIO: FilaStock[] = [];

const CASA_CENTRAL = { id: 1, name: "Casa central" };

/** Deja el stock de un producto en una sola sucursal (los tests de estado). */
const setStock = (productId: number, stock: number) => {
  INVENTARIO = INVENTARIO.filter((fila) => fila.productId !== productId);
  if (stock > 0) INVENTARIO.push({ productId, branch: CASA_CENTRAL, stock });
};
/** Productos con un pedido abierto (`RESERVADO`). */
let RESERVADOS: number[] = [];
/** Productos con al menos una venta. */
let VENDIDOS: number[] = [];

type Where = {
  active?: boolean;
  publicaciones?: { some?: { canal?: string } };
  prenda?: { categoriaId?: number };
  OR?: { name?: { contains?: string }; code?: { contains?: string } }[];
};

const coincide = (fila: Fila, where: Where | undefined): boolean => {
  if (!where) return true;
  if (where.active !== undefined && fila.active !== where.active) return false;
  const canal = where.publicaciones?.some?.canal;
  if (canal && !fila.canales.includes(canal)) return false;
  const categoriaId = where.prenda?.categoriaId;
  if (categoriaId !== undefined && fila.prenda?.categoria?.id !== categoriaId) return false;
  const texto = where.OR?.[0]?.name?.contains?.toLowerCase();
  if (texto) {
    return (
      fila.name.toLowerCase().includes(texto) || fila.code.toLowerCase().includes(texto)
    );
  }
  return true;
};

const porIds = <T extends { productId: number }>(filas: T[], where?: { productId?: { in?: number[] } }) =>
  filas.filter((fila) => (where?.productId?.in ?? []).includes(fila.productId));

beforeEach(() => {
  jest.clearAllMocks();
  INVENTARIO = [
    { productId: 1, branch: CASA_CENTRAL, stock: 1 },
    { productId: 2, branch: CASA_CENTRAL, stock: 1 },
  ];
  RESERVADOS = [];
  VENDIDOS = [];

  mockProductFindMany.mockImplementation(async (args: { where?: Where }) =>
    PUBLICADAS.filter((fila) => coincide(fila, args?.where))
  );
  mockProductFindFirst.mockImplementation(
    async (args: { where?: { id?: number } & Where }) =>
      PUBLICADAS.find(
        (fila) => fila.id === args?.where?.id && coincide(fila, args?.where)
      ) ?? null
  );
  mockInventoryGroupBy.mockImplementation(
    async (args: { where?: { productId?: { in?: number[] } } }) => {
      const agrupado = new Map<number, number>();
      for (const fila of INVENTARIO) {
        if (!(args?.where?.productId?.in ?? []).includes(fila.productId)) continue;
        agrupado.set(fila.productId, (agrupado.get(fila.productId) ?? 0) + fila.stock);
      }
      return [...agrupado].map(([productId, stock]) => ({
        productId,
        _sum: { stock },
      }));
    }
  );
  // Sucursales con stock > 0 de un producto, ordenadas por nombre (la base lo hace).
  mockInventoryFindMany.mockImplementation(
    async (args: { where?: { productId?: number; stock?: { gt?: number } } }) =>
      INVENTARIO
        .filter(
          (fila) =>
            fila.productId === args?.where?.productId &&
            fila.stock > (args?.where?.stock?.gt ?? 0)
        )
        .map((fila) => ({ branch: fila.branch }))
        .sort((a, b) => a.branch.name.localeCompare(b.branch.name))
  );
  mockPedidoItemFindMany.mockImplementation(
    async (args: { where?: { productId?: { in?: number[] } } }) =>
      porIds(RESERVADOS.map((productId) => ({ productId })), args?.where)
  );
  mockSaleItemFindMany.mockImplementation(
    async (args: { where?: { productId?: { in?: number[] } } }) =>
      porIds(VENDIDOS.map((productId) => ({ productId })), args?.where)
  );
  mockCategoriaFindMany.mockImplementation(async () => {
    const prendas = PUBLICADAS.filter(
      (fila) => fila.active && fila.canales.includes("Web") && fila.prenda?.categoria
    );
    const unicas = new Map(prendas.map((fila) => [fila.prenda!.categoria!.id, fila.prenda!.categoria!]));
    return [...unicas.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
});

describe("getVidriera — qué se publica (S2)", () => {
  it("solo lista lo publicado en el canal Web y activo", async () => {
    const resultado = await getVidriera({});

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.items.map((item) => item.code)).toEqual(["PK-1", "AR-1"]);
  });

  it("filtra en la consulta por publicación Web y por activo", async () => {
    await getVidriera();

    const consulta = mockProductFindMany.mock.calls[0][0] as {
      where?: Where;
      orderBy?: unknown;
    };
    expect(consulta.where?.active).toBe(true);
    expect(consulta.where?.publicaciones).toEqual({ some: { canal: "Web" } });
    expect(consulta.orderBy).toEqual({ name: "asc" });
  });

  it("el select no pide ningún dato interno (costo, sucursales, clientes)", async () => {
    await getVidriera();

    const consulta = mockProductFindMany.mock.calls[0][0] as { select?: unknown };

    // Contrato exacto: cualquier campo nuevo que se agregue al select tiene que
    // ser público, así que este test es el que obliga a revisarlo.
    expect(consulta.select).toEqual({
      id: true,
      code: true,
      name: true,
      price: true,
      kind: true,
      // Categoría propia del producto normal (`Category`): dato público del ítem.
      category: { select: { id: true, name: true } },
      images: {
        orderBy: { position: "asc" },
        select: { path: true, alt: true },
      },
      prenda: {
        select: {
          categoria: { select: { id: true, name: true } },
          condicion: { select: { name: true } },
          // Talles para mostrarlos en la card (dato público de la prenda).
          talles: { select: { talle: true, cantidad: true }, orderBy: { talle: "asc" } },
          // Estilos: filtro «Estilo» del catálogo (dato público de la prenda).
          estilos: { select: { estilo: { select: { name: true } } } },
        },
      },
    });
    expect(JSON.stringify(consulta.select)).not.toContain("costo");
    expect(JSON.stringify(consulta.select)).not.toContain("inventory");
  });

  it("devuelve solo datos públicos y la portada en miniatura", async () => {
    const resultado = await getVidriera();
    if (!resultado.success) throw new Error("la vidriera tendría que responder");

    expect(resultado.data.items[0]).toEqual({
      id: 1,
      code: "PK-1",
      name: "Campera de jean",
      price: 45000,
      kind: "PRENDA",
      estado: "DISPONIBLE",
      portada: expect.stringMatching(/\/product-images\/1\/hash-portada_sm\.webp$/),
      categoria: "Camperas",
      categoriaId: 7,
      talles: ["M", "S"],
      estilos: [],
    });
  });

  it("un producto normal llega con su categoría de producto", async () => {
    const resultado = await getVidriera();
    if (!resultado.success) throw new Error("la vidriera tendría que responder");

    const perfume = resultado.data.items.find((item) => item.code === "AR-1");
    expect(perfume?.categoria).toBe("Perfumes");
    expect(perfume?.categoriaId).toBe(9);
  });

  it("un producto sin categoría no rompe la lista", async () => {
    PERFUME.category = null;
    try {
      const resultado = await getVidriera();
      if (!resultado.success) throw new Error("la vidriera tendría que responder");

      const perfume = resultado.data.items.find((item) => item.code === "AR-1");
      expect(perfume?.categoria).toBeNull();
      expect(perfume?.categoriaId).toBeNull();
    } finally {
      PERFUME.category = { id: 9, name: "Perfumes" };
    }
  });

  it("lista para los chips solo las categorías con prendas publicadas", async () => {
    const resultado = await getVidriera();
    if (!resultado.success) throw new Error("la vidriera tendría que responder");

    expect(resultado.data.categorias).toEqual([{ id: 7, name: "Camperas" }]);

    const consulta = mockCategoriaFindMany.mock.calls[0][0] as { where?: unknown };
    expect(consulta.where).toEqual({
      active: true,
      prendas: {
        some: {
          product: { active: true, publicaciones: { some: { canal: "Web" } } },
        },
      },
    });
  });
});

describe("getVidriera — estados derivados (S2)", () => {
  const estadoDe = async (code: string) => {
    const resultado = await getVidriera();
    if (!resultado.success) throw new Error("la vidriera tendría que responder");
    return resultado.data.items.find((item) => item.code === code)?.estado;
  };

  it("una prenda con stock disponible queda Disponible", async () => {
    expect(await estadoDe("PK-1")).toBe("DISPONIBLE");
  });

  it("una prenda reservada por un pedido abierto queda Reservada", async () => {
    RESERVADOS = [1];

    expect(await estadoDe("PK-1")).toBe("RESERVADA");
  });

  it("una prenda sin stock y con venta queda Vendida", async () => {
    setStock(1, 0);
    VENDIDOS = [1];

    expect(await estadoDe("PK-1")).toBe("VENDIDA");
  });

  it("un producto sin stock queda Agotado (aunque se haya vendido)", async () => {
    setStock(3, 0);
    VENDIDOS = [3];

    expect(await estadoDe("AR-1")).toBe("AGOTADO");
  });

  it("un producto con stock queda Disponible", async () => {
    setStock(3, 4);

    expect(await estadoDe("AR-1")).toBe("DISPONIBLE");
  });

  it("consulta reservado y ventas de los productos publicados", async () => {
    await getVidriera();

    expect(mockPedidoItemFindMany.mock.calls[0][0]).toEqual({
      where: { productId: { in: [1, 3] }, pedido: { estado: "RESERVADO" } },
      distinct: ["productId"],
      select: { productId: true },
    });
    expect(mockSaleItemFindMany.mock.calls[0][0]).toEqual({
      where: { productId: { in: [1, 3] } },
      distinct: ["productId"],
      select: { productId: true },
    });
  });
});

describe("getVidriera — filtros", () => {
  it("filtra por categoría de prenda", async () => {
    REMERA.canales = ["Web"];
    try {
      const resultado = await getVidriera({ categoriaId: 8 });

      expect(mockProductFindMany.mock.calls[0][0].where.prenda).toEqual({ categoriaId: 8 });
      if (!resultado.success) throw new Error("la vidriera tendría que responder");
      expect(resultado.data.items.map((item) => item.code)).toEqual(["PK-2"]);
    } finally {
      REMERA.canales = ["Instagram"];
    }
  });

  it("busca por nombre o código sin distinguir mayúsculas", async () => {
    const resultado = await getVidriera({ q: "  campera " });

    const consulta = mockProductFindMany.mock.calls[0][0] as { where?: Where };
    expect(consulta.where?.OR).toEqual([
      { name: { contains: "campera", mode: "insensitive" } },
      { code: { contains: "campera", mode: "insensitive" } },
    ]);
    if (!resultado.success) throw new Error("la vidriera tendría que responder");
    expect(resultado.data.items.map((item) => item.code)).toEqual(["PK-1"]);
  });

  it("un filtro inválido no consulta la base", async () => {
    const resultado = await getVidriera({ categoriaId: "camperas" });

    expect(resultado.success).toBe(false);
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});

describe("getVidrieraItem — ficha pública (T5)", () => {
  it("devuelve la ficha con las fotos grandes ordenadas por posición", async () => {
    const resultado = await getVidrieraItem({ id: 1 });

    if (!resultado.success) throw new Error("la ficha tendría que responder");
    expect(resultado.data).toEqual({
      id: 1,
      code: "PK-1",
      name: "Campera de jean",
      price: 45000,
      kind: "PRENDA",
      estado: "DISPONIBLE",
      portada: expect.stringMatching(/\/hash-portada_sm\.webp$/),
      categoria: "Camperas",
      categoriaId: 7,
      descripcion: "",
      sucursales: [{ id: 1, name: "Casa central" }],
      condicion: "Muy bueno",
      detalleCondicion: "Con marcas en el ruedo",
      talles: ["M", "S"],
      estilos: [],
      fotos: [
        {
          url: expect.stringMatching(/\/product-images\/1\/hash-portada_lg\.webp$/),
          alt: "Campera de frente",
        },
        {
          url: expect.stringMatching(/\/product-images\/1\/hash-espalda_lg\.webp$/),
          // Sin alt cargado se usa el nombre: nunca queda una foto sin texto.
          alt: "Campera de jean",
        },
      ],
    });
  });

  it("pide las fotos ordenadas por posición y sin costo en el select", async () => {
    await getVidrieraItem({ id: 1 });

    const consulta = mockProductFindFirst.mock.calls[0][0] as {
      where?: Record<string, unknown>;
      select?: Record<string, unknown> & {
        images?: { orderBy?: unknown };
        prenda?: { select?: Record<string, unknown> };
      };
    };

    expect(consulta.where).toEqual({
      id: 1,
      active: true,
      publicaciones: { some: { canal: "Web" } },
    });
    expect(consulta.select?.images?.orderBy).toEqual({ position: "asc" });
    expect(consulta.select?.prenda?.select?.talles).toEqual({
      orderBy: { talle: "asc" },
      select: { talle: true },
    });
    // Datos públicos que la ficha necesita también para productos normales.
    expect(consulta.select?.description).toBe(true);
    expect(consulta.select?.category).toEqual({ select: { id: true, name: true } });
    expect(JSON.stringify(consulta.select)).not.toContain("costo");
    expect(JSON.stringify(consulta.select)).not.toContain("inventory");
  });

  it("un producto publicado muestra sus datos públicos", async () => {
    const resultado = await getVidrieraItem({ id: 3 });

    if (!resultado.success) throw new Error("la ficha tendría que responder");
    expect(resultado.data).toEqual({
      id: 3,
      code: "AR-1",
      name: "Perfume floral",
      price: 30000,
      kind: "PRODUCT",
      estado: "AGOTADO",
      portada: expect.stringMatching(/\/hash-perfume_sm\.webp$/),
      categoria: "Perfumes",
      categoriaId: 9,
      descripcion: "Perfume floral 100 ml",
      // Sin stock no hay sucursal para mostrar, pero el campo siempre viene.
      sucursales: [],
      condicion: null,
      detalleCondicion: null,
      talles: [],
      estilos: [],
      fotos: [
        {
          url: expect.stringMatching(/\/product-images\/3\/hash-perfume_lg\.webp$/),
          alt: "Perfume floral",
        },
      ],
    });
  });

  it("un producto con stock muestra las sucursales donde retirarlo, sin el stock", async () => {
    setStock(3, 0);
    INVENTARIO.push(
      { productId: 3, branch: { id: 2, name: "Sucursal Norte" }, stock: 3 },
      { productId: 3, branch: { id: 1, name: "Casa central" }, stock: 1 }
    );

    const resultado = await getVidrieraItem({ id: 3 });

    if (!resultado.success) throw new Error("la ficha tendría que responder");
    expect(resultado.data.sucursales).toEqual([
      { id: 1, name: "Casa central" },
      { id: 2, name: "Sucursal Norte" },
    ]);
    // Disponibilidad pública, no inventario: ni el stock ni el costo salen de acá.
    expect(JSON.stringify(resultado.data)).not.toContain("stock");
    expect(JSON.stringify(resultado.data)).not.toContain("costo");
  });

  it("el placeholder \"-\" de la descripción se publica vacío", async () => {
    PERFUME.description = "-";
    try {
      const resultado = await getVidrieraItem({ id: 3 });

      if (!resultado.success) throw new Error("la ficha tendría que responder");
      expect(resultado.data.descripcion).toBe("");
    } finally {
      PERFUME.description = "Perfume floral 100 ml";
    }
  });

  it("no publicado y no existente dan la misma respuesta (sin filtrar la existencia)", async () => {
    const noPublicada = await getVidrieraItem({ id: 2 });
    const inexistente = await getVidrieraItem({ id: 999 });

    expect(noPublicada).toEqual({ success: false });
    expect(inexistente).toEqual(noPublicada);
  });

  it("un id inválido no consulta la base", async () => {
    const resultado = await getVidrieraItem({ id: "1" });

    expect(resultado.success).toBe(false);
    expect(mockProductFindFirst).not.toHaveBeenCalled();
  });
});
