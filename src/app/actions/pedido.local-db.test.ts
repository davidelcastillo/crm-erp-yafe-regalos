/** @jest-environment node */

/**
 * Pedidos contra la base local (`npm run test:local-db`). Zona de dinero.
 *
 * Lo que recién acá se puede probar: el número `V-####` sale del lock real, la
 * reserva derivada cuenta lo reservado de verdad, el cobro crea la `Sale` con el
 * mismo helper que `registerSale` (stock descontado exacto, movimiento `EXIT`
 * con actor y totales de la foto de precios), el pedido no se puede cobrar dos
 * veces y una falla DESPUÉS del insert de la `Sale` no deja nada a medias.
 */

jest.setTimeout(60000);

// El archivo es un módulo: si no, sus nombres de nivel superior chocan con los
// de las otras suites de base local, que no importan nada arriba.
export {};

const sufijo = Math.floor(1000 + Math.random() * 9000);
const marca = `QA pedido ${sufijo}`;
const CODIGO_SUCURSAL = `QO${sufijo}`;
const ACTOR = "test@feria.test";

type Cliente = (typeof import("@/lib/prisma"))["prisma"];
type Acciones = typeof import("@/app/actions/pedido");
type AccionesPrenda = typeof import("@/app/actions/prenda");

let prisma: Cliente;
let pedidos: Acciones;
let prendas: AccionesPrenda;
let branchId = 0;
let customerId = 0;
let canalId = 0;
let categoriaId = 0;
let condicionId = 0;

const idsPedidos: number[] = [];
const idsVentas: number[] = [];

const limpiarProductos = async () => {
  await prisma.product.deleteMany({ where: { name: { startsWith: marca } } });
};

/** Alta de una prenda única de `precio` en la sucursal del pedido. */
async function altaPrenda(nombre: string, precio: number) {
  const resultado = await prendas.createPrenda({
    nombre: `${marca} ${nombre}`,
    descripcion: "Segunda mano",
    precio,
    costo: 1000,
    categoriaPrendaId: categoriaId,
    talle: "Único",
    condicionId,
    esUnica: true,
    cantidad: 1,
    branchId,
    estilos: [],
    medidas: [],
    publicadaEn: [],
  });
  expect(resultado.success).toBe(true);
  if (!resultado.success) throw new Error("no se pudo crear la prenda de prueba");
  return resultado.data.product;
}

const altaPedido = (productId: number, extra: Record<string, unknown> = {}) => ({
  customerId,
  canalId,
  branchId,
  items: [{ productId, cantidad: 1 }],
  ...extra,
});

describe("pedidos (integración, base local)", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    jest.resetModules();

    prisma = (await import("@/lib/prisma")).prisma;
    pedidos = await import("@/app/actions/pedido");
    prendas = await import("@/app/actions/prenda");

    await limpiarProductos();
    await prisma.branch.deleteMany({ where: { code: CODIGO_SUCURSAL } });
    await prisma.categoriaPrenda.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.condicionPrenda.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.canalVenta.deleteMany({ where: { name: { startsWith: marca } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: marca } } });

    const sucursal = await prisma.branch.create({
      data: { name: `${marca} deposito`, code: CODIGO_SUCURSAL, authUserId: `qa-pedido-${sufijo}` },
    });
    branchId = sucursal.id;

    customerId = (
      await prisma.customer.create({ data: { name: `${marca} Ana`, surname: "Paz" } })
    ).id;
    canalId = (
      await prisma.canalVenta.create({ data: { name: `${marca} whatsapp` } })
    ).id;
    categoriaId = (
      await prisma.categoriaPrenda.create({ data: { name: `${marca} categoria` } })
    ).id;
    condicionId = (
      await prisma.condicionPrenda.create({ data: { name: `${marca} condicion` } })
    ).id;
  });

  afterAll(async () => {
    await prisma.pedido.deleteMany({ where: { id: { in: idsPedidos } } });
    await prisma.sale.deleteMany({ where: { id: { in: idsVentas } } });
    await prisma.branchMovement.deleteMany({ where: { branchId } });
    await limpiarProductos();
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.canalVenta.deleteMany({ where: { id: canalId } });
    await prisma.categoriaPrenda.deleteMany({ where: { id: categoriaId } });
    await prisma.condicionPrenda.deleteMany({ where: { id: condicionId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  const prenda = () => altaPrenda("campera", 12000);

  it("reserva la prenda, la cobra y deja una sola Sale con su movimiento", async () => {
    const producto = await prenda();

    const alta = await pedidos.createPedido(
      altaPedido(producto.id, { sena: { monto: 5000, metodo: "TRANSFERENCIA" } })
    );
    expect(alta.success).toBe(true);
    if (!alta.success) return;
    const pedidoId = alta.data.id as number;
    idsPedidos.push(pedidoId);

    // Número del generador real y precios del servidor, no del cliente.
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        numero: true,
        estado: true,
        total: true,
        createdBy: true,
        saleId: true,
        items: { select: { productId: true, branchId: true, cantidad: true, precio: true, subtotal: true } },
        pagos: { select: { monto: true, metodo: true, performedBy: true } },
      },
    });
    expect(pedido?.numero).toMatch(/^V-\d{4,}$/);
    expect(pedido?.estado).toBe("RESERVADO");
    expect(Number(pedido?.total)).toBe(12000);
    expect(pedido?.createdBy).toBe(ACTOR);
    expect(pedido?.saleId).toBeNull();
    expect(pedido?.items).toHaveLength(1);
    expect(pedido?.items[0]).toMatchObject({ productId: producto.id, branchId, cantidad: 1 });
    expect(Number(pedido?.items[0].precio)).toBe(12000);
    expect(Number(pedido?.items[0].subtotal)).toBe(12000);
    expect(pedido?.pagos).toHaveLength(1);
    expect(Number(pedido?.pagos[0].monto)).toBe(5000);
    expect(pedido?.pagos[0]).toMatchObject({ metodo: "TRANSFERENCIA", performedBy: ACTOR });

    // La reserva es derivada: el stock físico todavía está en el estante.
    expect(
      await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId: producto.id } },
        select: { stock: true },
      })
    ).toEqual({ stock: 1 });

    // Segunda reserva de la misma prenda: no hay disponible.
    const repetido = await pedidos.createPedido(altaPedido(producto.id));
    expect(repetido.success).toBe(false);
    if (repetido.success) return;
    expect(repetido.error).toContain("Sin stock disponible");

    // Cobro: la Sale es la venta de siempre.
    const cobro = await pedidos.cobrarPedido({ id: pedidoId, metodo: "EFECTIVO" });
    expect(cobro.success).toBe(true);
    if (!cobro.success) return;
    const saleId = cobro.data.saleId as number;
    idsVentas.push(saleId);

    const venta = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        branchId: true,
        customerId: true,
        totalAmount: true,
        amountPaid: true,
        pendingBalance: true,
        paymentMethod: true,
        items: { select: { productId: true, price: true, quantity: true, subtotal: true } },
      },
    });
    expect(venta?.branchId).toBe(branchId);
    expect(venta?.customerId).toBe(customerId);
    // Seña por transferencia + saldo en efectivo: la venta es MIXTA.
    expect(venta?.paymentMethod).toBe("MIXTO");
    expect(Number(venta?.totalAmount)).toBe(12000);
    expect(Number(venta?.amountPaid)).toBe(12000);
    expect(Number(venta?.pendingBalance)).toBe(0);
    expect(venta?.items).toHaveLength(1);
    expect(venta?.items[0]).toMatchObject({ productId: producto.id, quantity: 1 });
    expect(Number(venta?.items[0].price)).toBe(12000);
    expect(Number(venta?.items[0].subtotal)).toBe(12000);

    // Stock descontado exacto y movimiento EXIT con actor (I10).
    expect(
      await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId: producto.id } },
        select: { stock: true },
      })
    ).toEqual({ stock: 0 });

    const movimientos = await prisma.branchMovement.findMany({
      where: { productId: producto.id, movementType: "EXIT" },
      select: { branchId: true, quantity: true, reference: true, performedBy: true },
    });
    expect(movimientos).toEqual([
      {
        branchId,
        quantity: 1,
        reference: `PEDIDO-${pedido?.numero} SALE-${saleId}`,
        performedBy: ACTOR,
      },
    ]);

    // El pedido queda pagado, vinculado y con el saldo registrado.
    const cobrado = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        estado: true,
        saleId: true,
        pagadoAt: true,
        pagos: { select: { monto: true, metodo: true } },
      },
    });
    expect(cobrado?.estado).toBe("PAGADO");
    expect(cobrado?.saleId).toBe(saleId);
    expect(cobrado?.pagadoAt).not.toBeNull();
    expect(cobrado?.pagos.map((p) => [Number(p.monto), p.metodo]).sort()).toEqual([
      [5000, "TRANSFERENCIA"],
      [7000, "EFECTIVO"],
    ]);

    // Un segundo cobro no crea otra venta (I4).
    const otraVez = await pedidos.cobrarPedido({ id: pedidoId, metodo: "EFECTIVO" });
    expect(otraVez).toEqual({
      success: false,
      error: "Solo se puede cobrar un pedido reservado",
    });
    expect(await prisma.sale.count({ where: { id: saleId } })).toBe(1);
    expect(await prisma.pedidoPago.count({ where: { pedidoId } })).toBe(2);
  });

  it("una falla después de crear la Sale no deja nada a medias", async () => {
    // Precio al tope del DECIMAL(10,2): con un pago negativo inyectado, el saldo
    // ya no entra en PedidoPago y la transacción falla justo después de la Sale.
    const producto = await altaPrenda("cara", 99999999.99);
    const alta = await pedidos.createPedido(altaPedido(producto.id));
    expect(alta.success).toBe(true);
    if (!alta.success) return;
    const pedidoId = alta.data.id as number;
    idsPedidos.push(pedidoId);

    await prisma.pedidoPago.create({
      data: { pedidoId, monto: -1, metodo: "EFECTIVO", performedBy: "qa" },
    });

    const antes = await Promise.all([
      prisma.sale.count({ where: { branchId } }),
      prisma.saleItem.count({ where: { productId: producto.id } }),
      prisma.branchMovement.count({ where: { productId: producto.id, movementType: "EXIT" } }),
    ]);

    // Se miran las sentencias reales: la falla tiene que ser POSTERIOR al insert
    // de la Sale, que es lo único que prueba el rollback de la venta.
    const consultas: string[] = [];
    // El tipo del `$on` sale del `log` del cliente; en desarrollo incluye queries.
    const escuchar = prisma.$on.bind(prisma) as unknown as (
      evento: "query",
      cb: (consulta: { query: string }) => void
    ) => void;
    escuchar("query", (evento) => consultas.push(evento.query));

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const cobro = await pedidos.cobrarPedido({ id: pedidoId, metodo: "EFECTIVO" });
    consoleError.mockRestore();

    expect(cobro).toEqual({ success: false, error: "Error al cobrar el pedido" });
    expect(consultas.some((sql) => sql.includes('INSERT INTO "public"."Sale"'))).toBe(true);
    expect(consultas.some((sql) => sql.includes('INSERT INTO "public"."PedidoPago"'))).toBe(
      true
    );

    // Nada escrito: ni Sale, ni ítems, ni movimiento, ni stock, y sigue reservado.
    expect(
      await Promise.all([
        prisma.sale.count({ where: { branchId } }),
        prisma.saleItem.count({ where: { productId: producto.id } }),
        prisma.branchMovement.count({ where: { productId: producto.id, movementType: "EXIT" } }),
      ])
    ).toEqual(antes);
    expect(
      await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId, productId: producto.id } },
        select: { stock: true },
      })
    ).toEqual({ stock: 1 });
    expect(
      await prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: { estado: true, saleId: true, pagadoAt: true },
      })
    ).toEqual({ estado: "RESERVADO", saleId: null, pagadoAt: null });
  });
});
