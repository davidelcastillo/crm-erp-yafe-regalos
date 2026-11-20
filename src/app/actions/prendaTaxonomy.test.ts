/**
 * Unit tests de las taxonomías creables de prendas (U2).
 *
 * Cubre, para las cinco taxonomías (categoría, estilo, condición, tipo de medida y
 * canal de venta): autorización admin antes de Zod y de Prisma, alta, duplicado sin
 * distinguir mayúsculas (incluye P2002), colisión al renombrar, desactivación
 * (las opciones excluyen lo inactivo) y round-trip alta → opciones.
 *
 * Refs: odd/tasks/prendas-pedidos.md (U2), AGENTS.md §0.2.
 */

import {
  createCategoriaPrenda,
  renameCategoriaPrenda,
  setCategoriaPrendaActive,
  getCategoriaPrendaOptions,
  createEstiloPrenda,
  renameEstiloPrenda,
  setEstiloPrendaActive,
  getEstiloPrendaOptions,
  createCondicionPrenda,
  renameCondicionPrenda,
  setCondicionPrendaActive,
  getCondicionPrendaOptions,
  createMedidaTipo,
  renameMedidaTipo,
  setMedidaTipoActive,
  getMedidaTipoOptions,
  createCanalVenta,
  renameCanalVenta,
  setCanalVentaActive,
  getCanalVentaOptions,
} from "@/app/actions/prendaTaxonomy";
import { requireAdmin } from "@/lib/auth-guard";

type DelegateMocks = {
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

const mockDelegates: Record<string, DelegateMocks> = {
  categoriaPrenda: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  estiloPrenda: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  condicionPrenda: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  medidaTipo: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  canalVenta: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => {
  const delegate = (key: string) => ({
    findFirst: (...args: unknown[]) => mockDelegates[key].findFirst(...args),
    findMany: (...args: unknown[]) => mockDelegates[key].findMany(...args),
    create: (...args: unknown[]) => mockDelegates[key].create(...args),
    update: (...args: unknown[]) => mockDelegates[key].update(...args),
  });
  return {
    prisma: {
      categoriaPrenda: delegate("categoriaPrenda"),
      estiloPrenda: delegate("estiloPrenda"),
      condicionPrenda: delegate("condicionPrenda"),
      medidaTipo: delegate("medidaTipo"),
      canalVenta: delegate("canalVenta"),
    },
  };
});

type Res = { success: boolean; data?: unknown; error?: string };

type TaxonomiaCase = {
  key: string;
  /** Etiqueta que aparece en los mensajes de error. */
  etiqueta: string;
  nombre: string;
  extra?: Record<string, unknown>;
  create: (data: { name: string; esUnicaPorDefecto?: boolean }) => Promise<Res>;
  rename: (data: { id: number; name: string }) => Promise<Res>;
  setActive: (data: { id: number; active: boolean }) => Promise<Res>;
  options: () => Promise<Res>;
};

const taxonomias: TaxonomiaCase[] = [
  {
    key: "categoriaPrenda",
    etiqueta: "categoría de prenda",
    nombre: "Second hand",
    extra: { esUnicaPorDefecto: true },
    create: createCategoriaPrenda,
    rename: renameCategoriaPrenda,
    setActive: setCategoriaPrendaActive,
    options: getCategoriaPrendaOptions,
  },
  {
    key: "estiloPrenda",
    etiqueta: "estilo",
    nombre: "Coquette",
    create: createEstiloPrenda,
    rename: renameEstiloPrenda,
    setActive: setEstiloPrendaActive,
    options: getEstiloPrendaOptions,
  },
  {
    key: "condicionPrenda",
    etiqueta: "condición",
    nombre: "Muy bueno",
    create: createCondicionPrenda,
    rename: renameCondicionPrenda,
    setActive: setCondicionPrendaActive,
    options: getCondicionPrendaOptions,
  },
  {
    key: "medidaTipo",
    etiqueta: "tipo de medida",
    nombre: "Largo total",
    create: createMedidaTipo,
    rename: renameMedidaTipo,
    setActive: setMedidaTipoActive,
    options: getMedidaTipoOptions,
  },
  {
    key: "canalVenta",
    etiqueta: "canal de venta",
    nombre: "WhatsApp",
    create: createCanalVenta,
    rename: renameCanalVenta,
    setActive: setCanalVentaActive,
    options: getCanalVentaOptions,
  },
];

describe.each(taxonomias)("taxonomía $key", (t) => {
  beforeEach(() => jest.clearAllMocks());

  // AGENTS.md §0.2: sesión + rol admin antes de validar y antes de Prisma.
  it("rechaza el alta sin sesión admin antes de Zod y sin tocar Prisma", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: "No autorizado",
    });

    // Nombre inválido: si el guardián no fuera primero, el error sería de Zod.
    const result = await t.create({ name: "", ...t.extra });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(mockDelegates[t.key].findFirst).not.toHaveBeenCalled();
    expect(mockDelegates[t.key].create).not.toHaveBeenCalled();
  });

  it("crea la fila (nombre recortado) y la devuelve", async () => {
    mockDelegates[t.key].findFirst.mockResolvedValue(null);
    mockDelegates[t.key].create.mockResolvedValue({
      id: 1,
      name: t.nombre,
      ...t.extra,
    });

    const result = await t.create({ name: `  ${t.nombre}  `, ...t.extra });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: t.nombre, ...t.extra });
    expect(mockDelegates[t.key].create).toHaveBeenCalledWith({
      data: { name: t.nombre, ...t.extra },
    });
  });

  it("rechaza un nombre duplicado sin distinguir mayúsculas", async () => {
    mockDelegates[t.key].findFirst.mockResolvedValue({ id: 9 });

    const result = await t.create({ name: t.nombre.toLowerCase() });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ya existe");
    expect(result.error).toContain(t.etiqueta);
    expect(mockDelegates[t.key].findFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: t.nombre.toLowerCase(), mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(mockDelegates[t.key].create).not.toHaveBeenCalled();
  });

  it("traduce P2002 (carrera contra el @unique) a 'Ya existe'", async () => {
    mockDelegates[t.key].findFirst.mockResolvedValue(null);
    mockDelegates[t.key].create.mockRejectedValue({ code: "P2002" });

    const result = await t.create({ name: t.nombre, ...t.extra });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ya existe");
  });

  it("rechaza renombrar a un nombre que colisiona", async () => {
    mockDelegates[t.key].findFirst.mockResolvedValue({ id: 2 });

    const result = await t.rename({ id: 1, name: t.nombre });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ya existe");
    expect(mockDelegates[t.key].findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: 1 },
        name: { equals: t.nombre, mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(mockDelegates[t.key].update).not.toHaveBeenCalled();
  });

  it("renombra cuando no hay colisión", async () => {
    mockDelegates[t.key].findFirst.mockResolvedValue(null);
    mockDelegates[t.key].update.mockResolvedValue({ id: 1, name: "Nuevo" });

    const result = await t.rename({ id: 1, name: "Nuevo" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: "Nuevo" });
  });

  it("desactiva (activa=false) y las opciones excluyen lo inactivo", async () => {
    mockDelegates[t.key].update.mockResolvedValue({
      id: 1,
      name: t.nombre,
      active: false,
    });

    const off = await t.setActive({ id: 1, active: false });

    expect(off.success).toBe(true);
    expect(mockDelegates[t.key].update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { active: false },
      select: { id: true, active: true },
    });

    mockDelegates[t.key].findMany.mockResolvedValue([{ id: 2, name: "Otra" }]);

    const options = await t.options();

    expect(options.success).toBe(true);
    expect(mockDelegates[t.key].findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true },
        orderBy: { name: "asc" },
      })
    );
    expect(options.data).toEqual([{ id: 2, name: "Otra" }]);
  });

  it("round-trip: la fila creada aparece en las opciones", async () => {
    const fila = { id: 5, name: t.nombre, ...t.extra };
    mockDelegates[t.key].findFirst.mockResolvedValue(null);
    mockDelegates[t.key].create.mockResolvedValue(fila);
    mockDelegates[t.key].findMany.mockResolvedValue([fila]);

    const created = await t.create({ name: t.nombre, ...t.extra });
    const options = await t.options();

    expect(created.success).toBe(true);
    expect(options.success).toBe(true);
    expect(options.data).toEqual([fila]);
  });
});

describe("taxonomías de prendas: detalles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("las opciones de categoría incluyen esUnicaPorDefecto y su prefijo de código", async () => {
    mockDelegates.categoriaPrenda.findMany.mockResolvedValue([
      { id: 1, name: "Second hand", esUnicaPorDefecto: true, codePrefix: "RPH" },
    ]);

    const result = await getCategoriaPrendaOptions();
    if (!result.success) throw new Error("esperaba que la consulta de opciones funcione");

    expect(mockDelegates.categoriaPrenda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true, esUnicaPorDefecto: true, codePrefix: true },
      })
    );
    expect(result.data).toEqual([
      { id: 1, name: "Second hand", esUnicaPorDefecto: true, codePrefix: "RPH" },
    ]);
  });

  it("la categoría acepta un prefijo de código y lo normaliza a mayúsculas (U8)", async () => {
    mockDelegates.categoriaPrenda.findFirst.mockResolvedValue(null);
    mockDelegates.categoriaPrenda.create.mockResolvedValue({
      id: 9,
      name: "Vestidos",
      esUnicaPorDefecto: true,
      codePrefix: "VES",
    });

    const result = await createCategoriaPrenda({ name: "Vestidos", codePrefix: " ves " });

    expect(result.success).toBe(true);
    expect(mockDelegates.categoriaPrenda.create).toHaveBeenCalledWith({
      data: { name: "Vestidos", codePrefix: "VES" },
    });
  });

  it("un prefijo inválido se rechaza con mensaje claro y sin tocar Prisma", async () => {
    const result = await createCategoriaPrenda({ name: "Vestidos", codePrefix: "V1" });

    expect(result).toEqual({
      success: false,
      error: "El prefijo debe tener entre 2 y 4 letras",
    });
    expect(mockDelegates.categoriaPrenda.create).not.toHaveBeenCalled();
  });

  it("renombrar una fila inexistente devuelve 'No se encontró'", async () => {
    mockDelegates.estiloPrenda.findFirst.mockResolvedValue(null);
    mockDelegates.estiloPrenda.update.mockRejectedValue({ code: "P2025" });

    const result = await renameEstiloPrenda({ id: 404, name: "Vintage" });
    if (result.success) throw new Error("esperaba que el rename fallara");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No se encontró");
  });
});
