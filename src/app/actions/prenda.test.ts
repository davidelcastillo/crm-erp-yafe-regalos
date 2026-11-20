/**
 * @jest-environment node
 *
 * Alta y edición de prenda (U3): `createPrenda` y `updatePrenda`.
 *
 * Lo que se fija acá: guardián admin primero, código generado con el lock del
 * prefijo `PK` (nunca lo manda el cliente), la ficha completa (`Product` kind
 * PRENDA + `PrendaDetalle` + estilos/medidas/publicaciones), la fila de
 * inventario con su movimiento `ENTRY` y su comprobante, `esUnica` con cantidad
 * 1, taxonomías inactivas rechazadas y una edición que reemplaza los hijos pero
 * nunca toca stock.
 */
import { createPrenda, updatePrenda, getPrenda } from "./prenda";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { prefixLockKey } from "@/lib/utils/product-code";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/prisma", () => {
  const delegate = () => ({
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  });
  const delegados = {
    product: delegate(),
    prendaDetalle: delegate(),
    prendaEstilo: delegate(),
    prendaMedida: delegate(),
    prendaPublicacion: delegate(),
    branchInventory: delegate(),
    branchMovement: delegate(),
  };
  const $executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
  const tx = { ...delegados, $executeRawUnsafe };
  const $transaction = jest.fn(async (callback: (t: unknown) => Promise<unknown>) =>
    callback(tx)
  );

  return {
    prisma: {
      ...delegados,
      $executeRawUnsafe,
      $transaction,
      branch: { findFirst: jest.fn() },
      categoriaPrenda: { findFirst: jest.fn() },
      condicionPrenda: { findFirst: jest.fn() },
      estiloPrenda: { findMany: jest.fn() },
      medidaTipo: { findMany: jest.fn() },
    },
  };
});

const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockRevalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

/** Payload mínimo válido: una prenda única en el depósito. */
const alta = {
  nombre: "  Campera de jean  ",
  descripcion: "Talle M, segunda mano",
  precio: 12000,
  costo: 4000,
  categoriaPrendaId: 1,
  talle: "M",
  condicionId: 2,
  detalleCondicion: "Mancha chica en el puño",
  detalleIntervencion: "Sin intervenir",
  estilos: [4, 5],
  medidas: [{ medidaTipoId: 6, valorCm: 48.5 }],
  esUnica: true,
  cantidad: 1,
  branchId: 3,
  publicadaEn: ["Web", "WhatsApp"],
};

/** Deja las lecturas previas a la transacción contestando OK. */
function prepararLecturas() {
  (prisma.branch.findFirst as jest.Mock).mockResolvedValue({
    id: 3,
    name: "Depósito",
    code: "DE",
  });
  (prisma.categoriaPrenda.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
  (prisma.condicionPrenda.findFirst as jest.Mock).mockResolvedValue({ id: 2 });
  (prisma.estiloPrenda.findMany as jest.Mock).mockResolvedValue([{ id: 4 }, { id: 5 }]);
  (prisma.medidaTipo.findMany as jest.Mock).mockResolvedValue([{ id: 6 }]);
  (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.product.create as jest.Mock).mockResolvedValue({
    id: 9,
    code: "PK000",
    name: "Campera de jean",
    price: 12000,
  });
  (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 1 });
}

beforeEach(() => {
  jest.clearAllMocks();
  prepararLecturas();
});

describe("createPrenda: autorización y validación", () => {
  it("rechaza sin sesión admin antes de validar y no toca Prisma", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    // Payload inválido a propósito: si el guardián no fuera primero, el error sería de Zod.
    const result = await createPrenda({ nombre: "" });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("un payload inválido devuelve el mensaje de Zod y no abre transacción", async () => {
    const result = await createPrenda({ ...alta, nombre: "   ", talle: "" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("El nombre es requerido");
    expect(result.error).toContain("El talle es requerido");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("una prenda única no admite cantidad distinta de 1", async () => {
    const result = await createPrenda({ ...alta, esUnica: true, cantidad: 3 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Una prenda única lleva cantidad 1");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza una taxonomía inactiva o inexistente sin abrir transacción", async () => {
    // La consulta real filtra por id + active: el mock devuelve solo lo elegido.
    (prisma.estiloPrenda.findMany as jest.Mock).mockResolvedValue([{ id: 4 }]);
    (prisma.medidaTipo.findMany as jest.Mock).mockResolvedValue([]);

    (prisma.categoriaPrenda.findFirst as jest.Mock).mockResolvedValueOnce(null);
    expect(await createPrenda({ ...alta, categoriaPrendaId: 99 })).toEqual({
      success: false,
      error: "Categoría de prenda inválida o inactiva",
    });

    (prisma.condicionPrenda.findFirst as jest.Mock).mockResolvedValueOnce(null);
    expect(await createPrenda({ ...alta, condicionId: 99 })).toEqual({
      success: false,
      error: "Condición inválida o inactiva",
    });

    expect(await createPrenda({ ...alta, estilos: [4, 99] })).toEqual({
      success: false,
      error: "Un estilo seleccionado no existe o está inactivo",
    });

    (prisma.estiloPrenda.findMany as jest.Mock).mockResolvedValue([{ id: 4 }, { id: 5 }]);
    expect(await createPrenda({ ...alta, medidas: [{ medidaTipoId: 99, valorCm: 10 }] })).toEqual({
      success: false,
      error: "Un tipo de medida no existe o está inactivo",
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("una sucursal inactiva no crea nada", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await createPrenda(alta);

    expect(result).toEqual({ success: false, error: "Sucursal inválida o inactiva" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("createPrenda: alta completa", () => {
  it("crea el producto, la ficha, las filas hijas, el stock y el movimiento con su comprobante", async () => {
    const result = await createPrenda(alta);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Lock y código: el prefijo es fijo y nunca lo manda el cliente.
    const sql = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sql).toEqual([`SELECT pg_advisory_xact_lock(${prefixLockKey("PK")})`]);

    const producto = (prisma.product.create as jest.Mock).mock.calls[0][0].data;
    expect(producto).toEqual({
      name: "Campera de jean",
      description: "Talle M, segunda mano",
      price: 12000,
      code: "PK000",
      codePrefix: "PK",
      kind: "PRENDA",
    });

    // La ficha: todo lo propio de la ropa, incluido el costo.
    const ficha = (prisma.prendaDetalle.create as jest.Mock).mock.calls[0][0].data;
    expect(ficha).toEqual({
      productId: 9,
      esUnica: true,
      categoriaId: 1,
      condicionId: 2,
      talle: "M",
      detalleCondicion: "Mancha chica en el puño",
      detalleIntervencion: "Sin intervenir",
      costo: 4000,
    });

    expect((prisma.prendaEstilo.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, estiloId: 4 },
      { productId: 9, estiloId: 5 },
    ]);
    expect((prisma.prendaMedida.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, medidaTipoId: 6, valorCm: 48.5 },
    ]);
    expect((prisma.prendaPublicacion.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, canal: "Web" },
      { productId: 9, canal: "WhatsApp" },
    ]);

    // Stock y movimiento: la cantidad cargada y el actor de la sesión.
    expect((prisma.branchInventory.create as jest.Mock).mock.calls[0][0].data).toEqual({
      branchId: 3,
      productId: 9,
      stock: 1,
    });
    expect((prisma.branchMovement.create as jest.Mock).mock.calls[0][0].data).toEqual({
      productId: 9,
      branchId: 3,
      movementType: "ENTRY",
      quantity: 1,
      reference: "ALTA DE PRENDA",
      performedBy: "test@feria.test",
    });

    // Comprobante: la misma forma que consume el panel del alta masiva.
    expect(result.data.receipt).toEqual({
      movementType: "ENTRY",
      branchId: 3,
      branchName: "Depósito",
      branchCode: "DE",
      reference: "ALTA DE PRENDA",
      date: expect.any(String),
      rows: [
        { productId: 9, code: "PK000", name: "Campera de jean", price: 12000, quantity: 1, stock: 1 },
      ],
    });

    expect(mockRevalidate).toHaveBeenCalledWith("/inventario");
  });

  it("una prenda nueva con cantidad carga el stock y el movimiento de esa cantidad", async () => {
    (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 4 });

    const result = await createPrenda({ ...alta, esUnica: false, cantidad: 4 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((prisma.branchInventory.create as jest.Mock).mock.calls[0][0].data.stock).toBe(4);
    expect((prisma.branchMovement.create as jest.Mock).mock.calls[0][0].data.quantity).toBe(4);
    expect(result.data.receipt?.rows[0].quantity).toBe(4);
    expect(result.data.receipt?.rows[0].stock).toBe(4);
  });

  it("ignora canales vacíos o desconocidos en «Publicar en»", async () => {
    await createPrenda({ ...alta, publicadaEn: [" Web ", "", "  ", "TikTok", "Web"] });

    expect((prisma.prendaPublicacion.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, canal: "Web" },
    ]);
  });

  it("sin publicaciones ni medidas no escribe filas hijas vacías", async () => {
    const result = await createPrenda({
      ...alta,
      medidas: [],
      estilos: [],
      publicadaEn: [],
    });

    expect(result.success).toBe(true);
    expect(prisma.prendaEstilo.createMany).not.toHaveBeenCalled();
    expect(prisma.prendaMedida.createMany).not.toHaveBeenCalled();
    expect(prisma.prendaPublicacion.createMany).not.toHaveBeenCalled();
  });

  it("un error de la transacción no devuelve éxito ni revalida", async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await createPrenda(alta);

    consoleError.mockRestore();
    expect(result).toEqual({ success: false, error: "Error al crear la prenda" });
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
});

describe("updatePrenda", () => {
  const prendaActual = {
    id: 9,
    kind: "PRENDA",
    prenda: { esUnica: true },
    inventory: [{ stock: 1 }],
  };

  beforeEach(() => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(prendaActual);
    (prisma.product.update as jest.Mock).mockResolvedValue({ id: 9 });
    (prisma.prendaDetalle.update as jest.Mock).mockResolvedValue({ productId: 9 });
  });

  it("rechaza sin sesión admin antes de leer la prenda", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    const result = await updatePrenda({ ...alta, id: 9 });

    expect(result).toEqual({ success: false, error: "No autorizado" });
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it("actualiza la prenda y reemplaza estilos, medidas y publicaciones", async () => {
    (prisma.estiloPrenda.findMany as jest.Mock).mockResolvedValue([{ id: 5 }]);

    const result = await updatePrenda({
      ...alta,
      id: 9,
      nombre: "Campera de jean corta",
      estilos: [5],
      medidas: [],
      publicadaEn: ["Instagram"],
    });

    expect(result.success).toBe(true);

    // Product: nombre/descripción/precio. El código no se toca nunca.
    const producto = (prisma.product.update as jest.Mock).mock.calls[0][0].data;
    expect(producto).toEqual({
      name: "Campera de jean corta",
      description: "Talle M, segunda mano",
      price: 12000,
    });
    expect(producto).not.toHaveProperty("code");

    expect((prisma.prendaDetalle.update as jest.Mock).mock.calls[0][0].data).toEqual({
      categoriaId: 1,
      condicionId: 2,
      talle: "M",
      detalleCondicion: "Mancha chica en el puño",
      detalleIntervencion: "Sin intervenir",
      costo: 4000,
      esUnica: true,
    });

    // Se reemplazan enteras: borrar primero y volver a crear solo lo elegido.
    expect((prisma.prendaEstilo.deleteMany as jest.Mock).mock.calls[0][0]).toEqual({
      where: { productId: 9 },
    });
    expect((prisma.prendaEstilo.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, estiloId: 5 },
    ]);
    expect((prisma.prendaMedida.deleteMany as jest.Mock).mock.calls[0][0]).toEqual({
      where: { productId: 9 },
    });
    expect(prisma.prendaMedida.createMany).not.toHaveBeenCalled();
    expect((prisma.prendaPublicacion.deleteMany as jest.Mock).mock.calls[0][0]).toEqual({
      where: { productId: 9 },
    });
    expect((prisma.prendaPublicacion.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, canal: "Instagram" },
    ]);
    expect(mockRevalidate).toHaveBeenCalledWith("/inventario");
  });

  it("la edición nunca escribe stock, inventario ni movimientos (S20)", async () => {
    await updatePrenda({ ...alta, id: 9 });

    expect(prisma.branchInventory.create).not.toHaveBeenCalled();
    expect(prisma.branchInventory.update).not.toHaveBeenCalled();
    expect(prisma.branchMovement.create).not.toHaveBeenCalled();
  });

  it("no deja pasar una prenda de cantidad a única si el stock total supera 1", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 9,
      kind: "PRENDA",
      prenda: { esUnica: false },
      inventory: [{ stock: 2 }, { stock: 1 }],
    });

    const result = await updatePrenda({ ...alta, id: 9, esUnica: true });

    expect(result).toEqual({
      success: false,
      error: "No se puede marcar como única: la prenda tiene más de una unidad en stock",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("no encuentra una prenda inexistente o que es un producto normal", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 9,
      kind: "PRODUCT",
      prenda: null,
      inventory: [],
    });

    const result = await updatePrenda({ ...alta, id: 9 });

    expect(result).toEqual({ success: false, error: "Prenda no encontrada" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza una taxonomía inactiva en la edición", async () => {
    (prisma.estiloPrenda.findMany as jest.Mock).mockResolvedValue([{ id: 4 }]);

    const result = await updatePrenda({ ...alta, id: 9, estilos: [4, 5] });

    expect(result).toEqual({
      success: false,
      error: "Un estilo seleccionado no existe o está inactivo",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("getPrenda", () => {
  it("devuelve la ficha editable de una prenda", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 9,
      code: "PK000",
      name: "Campera de jean",
      description: "Talle M",
      price: 12000,
      kind: "PRENDA",
      prenda: {
        esUnica: true,
        categoriaId: 1,
        condicionId: 2,
        talle: "M",
        detalleCondicion: null,
        detalleIntervencion: null,
        costo: 4000,
        estilos: [{ estiloId: 4 }],
        medidas: [{ medidaTipoId: 6, valorCm: 48.5 }],
      },
      publicaciones: [{ canal: "Web" }],
    });

    const result = await getPrenda(9);

    expect(result).toEqual({
      success: true,
      data: {
        id: 9,
        code: "PK000",
        nombre: "Campera de jean",
        descripcion: "Talle M",
        precio: 12000,
        categoriaPrendaId: 1,
        condicionId: 2,
        talle: "M",
        detalleCondicion: "",
        detalleIntervencion: "",
        costo: 4000,
        esUnica: true,
        estilos: [4],
        medidas: [{ medidaTipoId: 6, valorCm: 48.5 }],
        publicadaEn: ["Web"],
      },
    });
  });

  it("un producto normal no se lee como prenda", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 9,
      kind: "PRODUCT",
      prenda: null,
    });

    expect(await getPrenda(9)).toEqual({ success: false, error: "Prenda no encontrada" });
  });
});
