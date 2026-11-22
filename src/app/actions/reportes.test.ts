/** @jest-environment node */

/**
 * Consultas de la home interna (`getResumenPanel`, en `dashboard.ts`) y de la
 * página de reportes (`getReportes`). Sin base: Prisma se mockea.
 *
 * Decisiones del dueño que estos tests fijan:
 *  - las ventas se reparten entre los estilos del producto (prorrateo), y la
 *    suma de los estilos tiene que dar el total vendido;
 *  - un producto sin estilo cae en «Sin estilo»;
 *  - la venta directa (sin pedido) se atribuye a la sucursal donde se vendió;
 *  - «gastos» del panel es el mismo egreso que el tablero: compras + caja.
 */
import { getResumenPanel } from "./dashboard";
import { getReportes } from "./reportes";
import { requireAdmin } from "@/lib/auth-guard";

const mockSaleFindMany = jest.fn();
const mockSaleItemFindMany = jest.fn();
const mockInventoryFindMany = jest.fn();
const mockInventoryAggregate = jest.fn();
const mockPurchaseAggregate = jest.fn();
const mockCashGroupBy = jest.fn();
const mockPedidoFindMany = jest.fn();
const mockPedidoCount = jest.fn();
const mockCashCloseFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    sale: { findMany: (...args: unknown[]) => mockSaleFindMany(...args) },
    saleItem: { findMany: (...args: unknown[]) => mockSaleItemFindMany(...args) },
    branchInventory: {
      findMany: (...args: unknown[]) => mockInventoryFindMany(...args),
      aggregate: (...args: unknown[]) => mockInventoryAggregate(...args),
    },
    purchase: { aggregate: (...args: unknown[]) => mockPurchaseAggregate(...args) },
    cashMovement: { groupBy: (...args: unknown[]) => mockCashGroupBy(...args) },
    pedido: {
      findMany: (...args: unknown[]) => mockPedidoFindMany(...args),
      count: (...args: unknown[]) => mockPedidoCount(...args),
    },
    // Piso del cierre de caja (`pisosDeCaja`), solo en el período «cierre».
    cashClose: { findMany: (...args: unknown[]) => mockCashCloseFindMany(...args) },
  },
}));

const hoyALas = (horas: number) => new Date(new Date().setHours(horas, 0, 0, 0));
const manana = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d;
};

const ESTILOS_DE = (nombres: string[]) =>
  nombres.map((name) => ({ estilo: { name } }));

describe("guardián de sesión", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getResumenPanel no devuelve datos sin admin", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: "No autorizado",
    });

    const resultado = await getResumenPanel({});

    expect(resultado).toEqual({ success: false, error: "No autorizado" });
    expect(mockSaleFindMany).not.toHaveBeenCalled();
  });

  it("getReportes no devuelve datos sin admin", async () => {
    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: "No autorizado",
    });

    const resultado = await getReportes({
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });

    expect(resultado).toEqual({ success: false, error: "No autorizado" });
    expect(mockSaleItemFindMany).not.toHaveBeenCalled();
  });
});

describe("getResumenPanel", () => {
  // Dos ventas del período: una de un pedido (WhatsApp) y una directa, sin
  // pedido, que se atribuye a la sucursal donde se vendió.
  const VENTAS = [
    {
      id: 1,
      date: hoyALas(10),
      totalAmount: 100,
      items: [{ quantity: 2, subtotal: 8000, product: { name: "Vestido lino", prenda: { estilos: [] }, estilosProducto: [{ estilo: { name: "Second hand" } }] } }],
      pedido: { canal: { name: "WhatsApp" } },
      branch: { name: "Punto Rosa" },
      customer: { name: "Ana", surname: "Paz" },
    },
    {
      id: 2,
      date: hoyALas(11),
      totalAmount: 300,
      items: [{ quantity: 3, subtotal: 6000, product: { name: "Top seda", prenda: { estilos: [] }, estilosProducto: [] } }],
      pedido: null,
      branch: { name: "Punto Rosa" },
      customer: null,
    },
  ];

  const RESERVAS = [
    {
      id: 7,
      numero: "V-0007",
      total: 100,
      venceEl: hoyALas(18),
      customer: { name: "Ana", surname: "Paz" },
      items: [{ cantidad: 1, product: { name: "Vestido lino" } }],
      pagos: [{ monto: 40 }],
    },
    {
      // Ya está cobrada: no es «reserva sin cobrar».
      id: 8,
      numero: "V-0008",
      total: 50,
      venceEl: manana(),
      customer: { name: "Bea", surname: "Ruiz" },
      items: [{ cantidad: 1, product: { name: "Top seda" } }],
      pagos: [{ monto: 50 }],
    },
  ];

  const PARA_ENVIAR = [
    {
      id: 9,
      numero: "V-0009",
      venceEl: hoyALas(17),
      envioEstado: "FALTA_EMBALAR",
      customer: { name: "Caro", surname: "Gil" },
      items: [{ cantidad: 2, product: { name: "Blazer" } }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSaleFindMany.mockImplementation(async (args: { take?: number }) =>
      args?.take ? VENTAS.slice(0, args.take) : VENTAS
    );
    mockInventoryAggregate.mockResolvedValue({ _sum: { stock: 12 } });
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 250 } });
    // Solo el egreso de caja es gasto; el ingreso no.
    mockCashGroupBy.mockResolvedValue([
      { type: "EGRESO", _sum: { amount: 50 } },
      { type: "INGRESO", _sum: { amount: 900 } },
    ]);
    mockPedidoFindMany.mockImplementation(async (args: { where: { estado: string } }) =>
      args.where.estado === "RESERVADO" ? RESERVAS : PARA_ENVIAR
    );
    // 1º: todos los PARA_ENVIAR; 2º: los que salen hoy.
    mockPedidoCount.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mockCashCloseFindMany.mockResolvedValue([]);
  });

  it("resume ventas, gastos, reservas y envíos del período", async () => {
    const resultado = await getResumenPanel({ branchId: 2 });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.ventas).toEqual({ monto: 400, unidades: 5, cantidad: 2 });
    // Gastos = compras (250) + egresos de caja (50): el mismo criterio del tablero.
    expect(resultado.data.gastos).toBe(300);
    // Solo la reserva con saldo: V-0007 debe 60 y vence hoy.
    expect(resultado.data.reservas).toEqual({ cantidad: 1, saldo: 60, vencenHoy: 1 });
    expect(resultado.data.paraEnviar).toEqual({ cantidad: 3, salenHoy: 1 });

    // Sucursal y período viajan a las consultas.
    expect(mockSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            expect.objectContaining({ date: expect.anything() }),
            { branchId: 2 },
          ]),
        },
      })
    );
    expect(mockPurchaseAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { totalAmount: true },
        where: expect.objectContaining({ AND: expect.anything() }),
      })
    );
    expect(mockCashGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["type"],
        where: expect.objectContaining({ AND: expect.anything() }),
      })
    );
    expect(mockPedidoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ estado: "RESERVADO" }) })
    );
    expect(mockPedidoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ estado: "PARA_ENVIAR" }) })
    );
  });

  it("la venta sin pedido se atribuye a su sucursal, no a «Mostrador»", async () => {
    const resultado = await getResumenPanel({});
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const porCanal = resultado.data.porCanal;
    expect(porCanal).toEqual(
      expect.arrayContaining([
        { canal: "WhatsApp", monto: 100, porcentaje: 25 },
        { canal: "Punto Rosa", monto: 300, porcentaje: 75 },
      ])
    );
    // Los porcentajes de los canales suman 100.
    const total = porCanal.reduce((suma, fila) => suma + fila.porcentaje, 0);
    expect(total).toBeCloseTo(100, 2);
  });

  it("lista reservas por cobrar (clienta, prenda, vence) y los envíos con su estado", async () => {
    const resultado = await getResumenPanel({});
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.reservasPorCobrar).toEqual([
      {
        id: 7,
        numero: "V-0007",
        cliente: "Ana Paz",
        prenda: "Vestido lino",
        venceEl: expect.any(String),
        saldo: 60,
      },
    ]);
    expect(resultado.data.paraEnviarLista).toEqual([
      {
        id: 9,
        numero: "V-0009",
        cliente: "Caro Gil",
        prenda: "Blazer",
        envioEstado: "FALTA_EMBALAR",
      },
    ]);
  });

  it("trae las últimas 4 ventas con clienta, prenda y sucursal", async () => {
    const resultado = await getResumenPanel({});
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(mockSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 4, orderBy: { date: "desc" } })
    );
    expect(resultado.data.ultimasVentas).toHaveLength(2);
    expect(resultado.data.ultimasVentas[0]).toEqual({
      id: 1,
      fecha: expect.any(String),
      cliente: "Ana Paz",
      prenda: expect.any(String),
      canal: "WhatsApp",
      monto: 100,
    });
  });

  it("rechaza un rango personalizado sin fechas", async () => {
    const resultado = await getResumenPanel({ type: "custom", startDate: "2026-03-01" });
    expect(resultado.success).toBe(false);
    expect(mockSaleFindMany).not.toHaveBeenCalled();
  });
});

describe("getReportes", () => {
  const venta = (fecha: Date, customerId: number | null, customer: unknown) => ({
    date: fecha,
    customerId,
    customer,
  });

  // A: prenda con 2 estilos, B: prenda con 3 estilos, C: producto sin estilo
  // (y sin ficha de prenda: no hay costo).
  const ITEMS = [
    {
      saleId: 1,
      quantity: 2,
      subtotal: 400,
      sale: venta(new Date(2026, 2, 4, 10, 0), 1, { name: "Ana", surname: "Paz" }),
      product: {
        name: "Vestido lino",
        category: { name: "Indumentaria" },
        prenda: {
          costo: 100,
          categoria: { name: "Vestidos" },
          estilos: ESTILOS_DE(["Romántico", "Clásico"]),
        },
        estilosProducto: [],
      },
    },
    {
      saleId: 2,
      quantity: 3,
      subtotal: 300,
      sale: venta(new Date(2026, 2, 10, 16, 0), 2, { name: "Bea", surname: "Ruiz" }),
      product: {
        name: "Top seda",
        category: { name: "Indumentaria" },
        prenda: {
          costo: 50,
          categoria: { name: "Tops" },
          estilos: ESTILOS_DE(["Clásico", "Urbano", "Romántico"]),
        },
        estilosProducto: [],
      },
    },
    {
      saleId: 1,
      quantity: 1,
      subtotal: 100,
      sale: venta(new Date(2026, 2, 4, 10, 0), 1, { name: "Ana", surname: "Paz" }),
      product: {
        name: "Aros plata",
        category: { name: "Accesorios" },
        prenda: null,
        estilosProducto: [],
      },
    },
  ];

  const STOCK = [
    {
      stock: 10,
      product: {
        prenda: { estilos: ESTILOS_DE(["Romántico", "Clásico"]) },
        estilosProducto: [],
      },
    },
    {
      // Producto normal: los estilos viven en ProductEstilo.
      stock: 9,
      product: {
        prenda: null,
        estilosProducto: ESTILOS_DE(["Clásico"]),
      },
    },
    {
      stock: 4,
      product: { prenda: null, estilosProducto: [] },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSaleItemFindMany.mockResolvedValue(ITEMS);
    mockInventoryFindMany.mockResolvedValue(STOCK);
  });

  it("calcula ingresos, costo, ganancia, margen y ticket promedio", async () => {
    const resultado = await getReportes({
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.kpis).toEqual({
      ingresos: 800,
      unidades: 6,
      ventas: 2,
      costo: 350,
      itemsSinCosto: 1,
      ganancia: 450,
      margen: 56.25,
      ticketPromedio: 400,
    });
  });

  it("filtra por sucursal y rango", async () => {
    await getReportes({ branchId: 2, desde: "2026-03-01", hasta: "2026-03-31" });

    expect(mockSaleItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sale: {
            date: {
              gte: new Date("2026-03-01T00:00:00"),
              lte: new Date("2026-03-31T23:59:59.999"),
            },
            branchId: 2,
          },
        },
      })
    );
  });

  it("reparte ventas y unidades entre los estilos de cada producto", async () => {
    const resultado = await getReportes({
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    const estilos = resultado.data.estilos;
    expect(estilos).toEqual(
      expect.arrayContaining([
        { estilo: "Romántico", total: 300, unidades: 2 }, // 400/2 + 300/3
        { estilo: "Clásico", total: 300, unidades: 2 },
        { estilo: "Urbano", total: 100, unidades: 1 }, // 300/3
        { estilo: "Sin estilo", total: 100, unidades: 1 },
      ])
    );
    // La suma de los estilos iguala el total vendido: nada se pierde.
    const totalEstilos = estilos.reduce((suma, fila) => suma + fila.total, 0);
    expect(totalEstilos).toBeCloseTo(resultado.data.kpis.ingresos, 6);
  });

  it("agrupa por semana del rango y por categoría", async () => {
    const resultado = await getReportes({
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    // Semanas que empiezan el lunes: 4/3 cae en la del 2/3; 10/3 en la del 9/3.
    expect(resultado.data.semanas).toEqual([
      { semana: "2026-03-02", total: 500, unidades: 3 },
      { semana: "2026-03-09", total: 300, unidades: 3 },
    ]);
    expect(resultado.data.categorias).toEqual(
      expect.arrayContaining([
        { categoria: "Vestidos", total: 400, unidades: 2 },
        { categoria: "Tops", total: 300, unidades: 3 },
        { categoria: "Accesorios", total: 100, unidades: 1 },
      ])
    );
  });

  it("reparte el monto entre las categorías del producto y la suma cuadra", async () => {
    mockSaleItemFindMany.mockResolvedValue([
      {
        saleId: 1,
        quantity: 2,
        subtotal: 400,
        sale: venta(new Date(2026, 2, 4, 10, 0), null, null),
        product: {
          name: "Set limpieza",
          category: { name: "Limpieza" },
          categorias: [
            { category: { name: "Limpieza" } },
            { category: { name: "Regalos" } },
          ],
          prenda: null,
          estilosProducto: [],
        },
      },
    ]);

    const resultado = await getReportes({ desde: "2026-03-01", hasta: "2026-03-31" });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    // Mismo criterio que los estilos: el ítem aporta su parte a cada categoría.
    expect(resultado.data.categorias).toEqual([
      { categoria: "Limpieza", total: 200, unidades: 1 },
      { categoria: "Regalos", total: 200, unidades: 1 },
    ]);
    const suma = resultado.data.categorias.reduce((total, fila) => total + fila.total, 0);
    expect(suma).toBeCloseTo(resultado.data.kpis.ingresos, 6);
  });

  it("un producto sin ninguna categoría cae en «Sin categoría»", async () => {
    mockSaleItemFindMany.mockResolvedValue([
      {
        saleId: 1,
        quantity: 1,
        subtotal: 100,
        sale: venta(new Date(2026, 2, 4, 10, 0), null, null),
        product: {
          name: "Suelto",
          category: null,
          categorias: [],
          prenda: null,
          estilosProducto: [],
        },
      },
    ]);

    const resultado = await getReportes({ desde: "2026-03-01", hasta: "2026-03-31" });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.categorias).toEqual([
      { categoria: "Sin categoría", total: 100, unidades: 1 },
    ]);
  });

  it("reparte el stock entre los estilos del producto", async () => {
    const resultado = await getReportes({
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.stockPorEstilo).toEqual([
      { estilo: "Clásico", stock: 14 }, // 10/2 + 9
      { estilo: "Romántico", stock: 5 }, // 10/2
      { estilo: "Sin estilo", stock: 4 },
    ]);
  });

  it("rankea las top clientas por total comprado", async () => {
    const resultado = await getReportes({
      desde: "2026-03-01",
      hasta: "2026-03-31",
    });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.topClientas).toEqual([
      { cliente: "Ana Paz", compras: 1, total: 500, ultimaCompra: "2026-03-04" },
      { cliente: "Bea Ruiz", compras: 1, total: 300, ultimaCompra: "2026-03-10" },
    ]);
  });

  it("rechaza un rango invertido o incompleto", async () => {
    const invertido = await getReportes({
      desde: "2026-03-31",
      hasta: "2026-03-01",
    });
    expect(invertido.success).toBe(false);
    if (!invertido.success) expect(invertido.error).toContain("Rango de fechas inválido");

    const incompleto = await getReportes({ desde: "2026-03-01" });
    expect(incompleto.success).toBe(false);
    expect(mockSaleItemFindMany).not.toHaveBeenCalled();
  });
});
