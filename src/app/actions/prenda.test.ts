/**
 * @jest-environment node
 *
 * Alta y edición de prenda (U3): `createPrenda` y `updatePrenda`.
 *
 * Lo que se fija acá: guardián admin primero, código generado con el lock del
 * prefijo de SU categoría (nunca lo manda el cliente), la ficha completa (`Product` kind
 * PRENDA + `PrendaDetalle` + estilos/medidas/publicaciones), la fila de
 * inventario con su movimiento `ENTRY` y su comprobante, `esUnica` con cantidad
 * 1, taxonomías inactivas rechazadas y una edición que reemplaza los hijos pero
 * nunca toca stock.
 */
import { createPrenda, updatePrenda, getPrenda, destacarPrenda } from "./prenda";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { prefixLockKey } from "@/lib/utils/product-code";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/prisma", () => {
  const delegate = () => ({
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  });
  const delegados = {
    categoriaPrenda: { findFirst: jest.fn() },
    product: delegate(),
    prendaDetalle: delegate(),
    prendaTalle: delegate(),
    purchase: delegate(),
    purchaseItem: delegate(),
    prendaEstilo: delegate(),
    prendaMedida: delegate(),
    prendaPublicacion: delegate(),
    productImage: delegate(),
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
  talles: [{ talle: "M", cantidad: 1 }],
  condicionId: 2,
  detalleCondicion: "Mancha chica en el puño",
  detalleIntervencion: "Sin intervenir",
  estilos: [4, 5],
  medidas: [{ medidaTipoId: 6, valorCm: 48.5 }],
  esUnica: true,
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
  (prisma.categoriaPrenda.findFirst as jest.Mock).mockResolvedValue({
    id: 1,
    name: "Second hand",
    codePrefix: "RPH",
  });
  (prisma.condicionPrenda.findFirst as jest.Mock).mockResolvedValue({ id: 2 });
  (prisma.estiloPrenda.findMany as jest.Mock).mockResolvedValue([{ id: 4 }, { id: 5 }]);
  (prisma.medidaTipo.findMany as jest.Mock).mockResolvedValue([{ id: 6 }]);
  (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.product.create as jest.Mock).mockResolvedValue({
    id: 9,
    code: "RPH000",
    name: "Campera de jean",
    price: 12000,
  });
  (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 1 });
  (prisma.purchase.create as jest.Mock).mockResolvedValue({ id: 77 });
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
    const result = await createPrenda({
      ...alta,
      nombre: "   ",
      talles: [{ talle: "   ", cantidad: 1 }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("El nombre es requerido");
    expect(result.error).toContain("El talle es requerido");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("una prenda única lleva un solo talle con cantidad 1", async () => {
    const tres = await createPrenda({ ...alta, talles: [{ talle: "M", cantidad: 3 }] });
    expect(tres).toEqual({
      success: false,
      error: "Una prenda única lleva un solo talle sin variante y con cantidad 1",
    });

    const dos = await createPrenda({
      ...alta,
      talles: [
        { talle: "M", cantidad: 1 },
        { talle: "L", cantidad: 1 },
      ],
    });
    expect(dos).toEqual({
      success: false,
      error: "Una prenda única lleva un solo talle sin variante y con cantidad 1",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("sin talles el alta se rechaza antes de abrir transacción", async () => {
    const result = await createPrenda({ ...alta, talles: [] });

    expect(result).toEqual({ success: false, error: "Cargá al menos un talle" });
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

  it("rechaza repetir talle + variante y una prenda única con variante", async () => {
    expect(
      await createPrenda({
        ...alta,
        esUnica: false,
        talles: [
          { talle: "M", variante: "Rojo", cantidad: 1 },
          { talle: "M", variante: "Rojo", cantidad: 2 },
        ],
      })
    ).toEqual({ success: false, error: "Talle y variante repetidos" });

    expect(
      await createPrenda({ ...alta, talles: [{ talle: "M", variante: "Rojo", cantidad: 1 }] })
    ).toEqual({
      success: false,
      error: "Una prenda única lleva un solo talle sin variante y con cantidad 1",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("una foto de talle fuera de rango se rechaza antes de la transacción", async () => {
    const result = await createPrenda({
      ...alta,
      esUnica: false,
      talles: [{ talle: "M", cantidad: 1, fotoPosition: 4 }],
    });

    expect(result).toEqual({ success: false, error: "La foto del talle es inválida" });
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

    // Lock y código: el prefijo viene de la categoría y nunca lo manda el cliente.
    const sql = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sql).toEqual([`SELECT pg_advisory_xact_lock(${prefixLockKey("RPH")})`]);

    const producto = (prisma.product.create as jest.Mock).mock.calls[0][0].data;
    expect(producto).toEqual({
      name: "Campera de jean",
      description: "Talle M, segunda mano",
      price: 12000,
      code: "RPH000",
      codePrefix: "RPH",
      kind: "PRENDA",
    });

    // La ficha: todo lo propio de la ropa, incluido el costo. El talle vive en
    // sus filas (S1), no acá.
    const ficha = (prisma.prendaDetalle.create as jest.Mock).mock.calls[0][0].data;
    expect(ficha).toEqual({
      productId: 9,
      esUnica: true,
      categoriaId: 1,
      condicionId: 2,
      detalleCondicion: "Mancha chica en el puño",
      detalleIntervencion: "Sin intervenir",
      costo: 4000,
    });

    // Talles: una fila por talle con su cantidad (S1).
    expect((prisma.prendaTalle.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, talle: "M", variante: "", cantidad: 1, fotoPosition: null },
    ]);

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

    // Compra del alta (S2): con costo > 0 se registra en la misma transacción,
    // sin tocar stock (el ENTRY de arriba ya lo ingresó).
    expect((prisma.purchase.create as jest.Mock).mock.calls[0][0].data).toEqual({
      totalAmount: 4000,
      branchId: 3,
    });
    expect((prisma.purchaseItem.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { purchaseId: 77, productId: 9, price: 4000, quantity: 1, subtotal: 4000 },
    ]);

    // Comprobante: la misma forma que consume el panel del alta masiva.
    expect(result.data.receipt).toEqual({
      movementType: "ENTRY",
      branchId: 3,
      branchName: "Depósito",
      branchCode: "DE",
      reference: "ALTA DE PRENDA",
      date: expect.any(String),
      rows: [
        { productId: 9, code: "RPH000", name: "Campera de jean", price: 12000, quantity: 1, stock: 1 },
      ],
    });

    expect(mockRevalidate).toHaveBeenCalledWith("/inventario");
  });

  it("una prenda con varios talles suma las cantidades para el stock, el movimiento y la compra", async () => {
    (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 5 });

    const result = await createPrenda({
      ...alta,
      esUnica: false,
      talles: [
        { talle: "S", cantidad: 2 },
        { talle: "M", cantidad: 3 },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((prisma.branchInventory.create as jest.Mock).mock.calls[0][0].data.stock).toBe(5);
    expect((prisma.branchMovement.create as jest.Mock).mock.calls[0][0].data.quantity).toBe(5);
    expect(result.data.receipt?.rows[0].quantity).toBe(5);
    expect(result.data.receipt?.rows[0].stock).toBe(5);
    // La compra lleva el total de unidades (S2).
    expect((prisma.purchaseItem.createMany as jest.Mock).mock.calls[0][0].data[0]).toEqual({
      purchaseId: 77,
      productId: 9,
      price: 4000,
      quantity: 5,
      subtotal: 20000,
    });
    expect((prisma.purchase.create as jest.Mock).mock.calls[0][0].data.totalAmount).toBe(20000);
  });

  it("cada fila es talle + variante: escribe las tres filas y suma el stock", async () => {
    (prisma.branchInventory.create as jest.Mock).mockResolvedValue({ stock: 4 });

    const result = await createPrenda({
      ...alta,
      esUnica: false,
      talles: [
        { talle: "M", variante: "Color rojo", cantidad: 1 },
        { talle: "M", variante: "Color azul", cantidad: 2 },
        { talle: "L", cantidad: 1 },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((prisma.prendaTalle.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, talle: "M", variante: "Color rojo", cantidad: 1, fotoPosition: null },
      { productId: 9, talle: "M", variante: "Color azul", cantidad: 2, fotoPosition: null },
      // Sin variante queda el texto vacío, nunca null: es parte de la clave.
      { productId: 9, talle: "L", variante: "", cantidad: 1, fotoPosition: null },
    ]);
    // El stock sigue siendo la suma de las filas (S1).
    expect((prisma.branchInventory.create as jest.Mock).mock.calls[0][0].data.stock).toBe(4);
    expect((prisma.branchMovement.create as jest.Mock).mock.calls[0][0].data.quantity).toBe(4);
    expect(result.data.receipt?.rows[0].quantity).toBe(4);
  });

  it("costo 0 no genera compra", async () => {
    await createPrenda({ ...alta, costo: 0 });

    expect(prisma.purchase.create).not.toHaveBeenCalled();
    expect(prisma.purchaseItem.createMany).not.toHaveBeenCalled();
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
      detalleCondicion: "Mancha chica en el puño",
      detalleIntervencion: "Sin intervenir",
      costo: 4000,
      esUnica: true,
    });

    // Talles: reemplazo entero, como estilos y medidas (S1).
    expect((prisma.prendaTalle.deleteMany as jest.Mock).mock.calls[0][0]).toEqual({
      where: { productId: 9 },
    });
    expect((prisma.prendaTalle.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, talle: "M", variante: "", cantidad: 1, fotoPosition: null },
    ]);

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

  it("guarda variante y foto de cada fila y rechaza una foto que no es de la prenda", async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 9,
      kind: "PRENDA",
      prenda: { esUnica: false },
      inventory: [{ stock: 3 }],
    });
    (prisma.productImage.findMany as jest.Mock).mockResolvedValue([
      { position: 0 },
      { position: 1 },
    ]);

    const result = await updatePrenda({
      ...alta,
      id: 9,
      esUnica: false,
      talles: [
        { talle: "M", variante: "Rojo", cantidad: 2, fotoPosition: 1 },
        { talle: "L", cantidad: 1 },
      ],
    });

    expect(result.success).toBe(true);
    expect(prisma.productImage.findMany).toHaveBeenCalledWith({
      where: { productId: 9 },
      select: { position: true },
    });
    expect((prisma.prendaTalle.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { productId: 9, talle: "M", variante: "Rojo", cantidad: 2, fotoPosition: 1 },
      { productId: 9, talle: "L", variante: "", cantidad: 1, fotoPosition: null },
    ]);

    // Elegir una foto que la prenda no tiene no puede guardarse a medias.
    const inexistente = await updatePrenda({
      ...alta,
      id: 9,
      esUnica: false,
      talles: [{ talle: "M", cantidad: 1, fotoPosition: 2 }],
    });

    expect(inexistente).toEqual({ success: false, error: "La foto del talle no existe" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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

describe("createPrenda: código por categoría (U8)", () => {
  it("usa el prefijo de SU categoría y sigue desde el máximo existente de ese prefijo", async () => {
    (prisma.categoriaPrenda.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      name: "Second hand",
      codePrefix: "RPH",
    });
    (prisma.product.findMany as jest.Mock).mockResolvedValue([{ code: "RPH007" }]);

    const result = await createPrenda(alta);

    expect(result.success).toBe(true);
    const sql = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(sql).toEqual([`SELECT pg_advisory_xact_lock(${prefixLockKey("RPH")})`]);
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { codePrefix: "RPH" },
      select: { code: true },
    });
    const producto = (prisma.product.create as jest.Mock).mock.calls[0][0].data;
    expect(producto.code).toBe("RPH008");
    expect(producto.codePrefix).toBe("RPH");
  });

  it("una categoría sin prefijo de código rechaza el alta sin escribir nada", async () => {
    (prisma.categoriaPrenda.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      name: "Vestidos",
      codePrefix: null,
    });

    const result = await createPrenda(alta);

    expect(result).toEqual({
      success: false,
      error: "La categoría «Vestidos» no tiene prefijo de código",
    });
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.product.create).not.toHaveBeenCalled();
    expect(prisma.prendaDetalle.create).not.toHaveBeenCalled();
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
      destacado: true,
      kind: "PRENDA",
      prenda: {
        esUnica: true,
        categoriaId: 1,
        condicionId: 2,
        detalleCondicion: null,
        detalleIntervencion: null,
        costo: 4000,
        estilos: [{ estiloId: 4 }],
        medidas: [{ medidaTipoId: 6, valorCm: 48.5 }],
        talles: [{ talle: "M", variante: "Color rojo", cantidad: 1, fotoPosition: 2 }],
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
        talles: [{ talle: "M", variante: "Color rojo", cantidad: 1, fotoPosition: 2 }],
        detalleCondicion: "",
        detalleIntervencion: "",
        costo: 4000,
        esUnica: true,
        estilos: [4],
        medidas: [{ medidaTipoId: 6, valorCm: 48.5 }],
        publicadaEn: ["Web"],
        destacado: true,
      },
    });
    // El destacado se lee del producto, no de la ficha de prenda.
    const select = (prisma.product.findUnique as jest.Mock).mock.calls[0][0].select;
    expect(select.destacado).toBe(true);
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

/**
 * Destacado de la portada (pedido del dueño): uno solo a la vez, y solo si el
 * producto está activo y publicado en Web.
 */
describe("destacarPrenda", () => {
  /** Producto activo y publicado en Web: la única lectura previa que habilita. */
  const publicable = { id: 10 };

  it("rechaza sin sesión admin antes de validar y no toca Prisma", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: "No autorizado" });

    expect(await destacarPrenda({})).toEqual({ success: false, error: "No autorizado" });
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("un payload inválido devuelve el mensaje de Zod y no escribe", async () => {
    const result = await destacarPrenda({ productId: 0, destacado: true });

    expect(result).toEqual({ success: false, error: "Producto inválido" });
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza destacar una prenda que no está publicada en Web y no escribe", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await destacarPrenda({ productId: publicable.id, destacado: true });

    expect(result).toEqual({
      success: false,
      error: "Solo se puede destacar una prenda activa y publicada en Web",
    });
    // La condición se filtra en la consulta: activo + publicación Web.
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        id: publicable.id,
        active: true,
        publicaciones: { some: { canal: "Web" } },
      },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it("destacar desmarca al anterior en la misma transacción", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(publicable);

    const result = await destacarPrenda({ productId: publicable.id, destacado: true });

    expect(result).toEqual({
      success: true,
      data: { productId: publicable.id, destacado: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Primero el barrido de todos los destacados, después la marca de este:
    // así nunca quedan dos a la vez.
    expect((prisma.product.updateMany as jest.Mock).mock.calls[0][0]).toEqual({
      where: { destacado: true },
      data: { destacado: false },
    });
    expect((prisma.product.update as jest.Mock).mock.calls[0][0]).toEqual({
      where: { id: publicable.id },
      data: { destacado: true },
    });
    expect(
      (prisma.product.updateMany as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((prisma.product.update as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("desmarcar deja la portada sin destacado, sin mirar la publicación", async () => {
    const result = await destacarPrenda({ productId: publicable.id, destacado: false });

    expect(result).toEqual({
      success: true,
      data: { productId: publicable.id, destacado: false },
    });
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect((prisma.product.updateMany as jest.Mock).mock.calls[0][0]).toEqual({
      where: { destacado: true },
      data: { destacado: false },
    });
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it("un error de la transacción no devuelve éxito", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(publicable);
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await destacarPrenda({ productId: publicable.id, destacado: true });

    consoleError.mockRestore();
    expect(result).toEqual({ success: false, error: "Error al destacar la prenda" });
  });
});
