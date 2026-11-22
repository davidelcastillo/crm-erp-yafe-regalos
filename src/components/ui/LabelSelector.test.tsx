/**
 * @jest-environment jsdom
 *
 * LabelSelector es el wizard de etiquetas de precio: paso 1 sucursal, paso 2
 * productos activos con stock > 0 en esa sucursal (buscador, «Todos», cantidad
 * por producto y resumen en vivo de etiquetas y hojas A4).
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LabelSelector } from "./LabelSelector";

jest.mock("@/app/actions/inventory", () => ({
  getBranchProductsForExport: jest.fn(),
}));

jest.mock("@/actions/label-print", () => ({
  generateProductLabels: jest.fn(),
  detectPrendaProducts: jest.fn(),
}));

import { getBranchProductsForExport } from "@/app/actions/inventory";
import { detectPrendaProducts, generateProductLabels } from "@/actions/label-print";

const mockGetBranchProductsForExport =
  getBranchProductsForExport as jest.MockedFunction<typeof getBranchProductsForExport>;
const mockGenerateProductLabels = generateProductLabels as jest.MockedFunction<
  typeof generateProductLabels
>;
const mockDetectPrendaProducts = detectPrendaProducts as jest.MockedFunction<
  typeof detectPrendaProducts
>;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

const rows = [
  { id: 11, code: "AAA001", name: "Jabón de Avena", stock: 5, price: 1250 },
  { id: 12, code: "BBB888", name: "Shampoo Solido", stock: 2, price: 99.5 },
];

let descarga: string | null = null;

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: jest.fn(() => "blob:etiquetas"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: jest.fn(),
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  // El orden elegido se recuerda en el navegador: cada caso arranca limpio.
  window.localStorage.clear();
  descarga = null;
  mockGetBranchProductsForExport.mockResolvedValue({
    success: true,
    data: rows,
  } as never);
  mockGenerateProductLabels.mockResolvedValue({
    success: true,
    data: { pdfBase64: "JVBERi0xLjQ=", filename: "etiquetas-PR001-20260101.pdf" },
  } as never);
  // Por defecto la selección no trae prendas: el wizard no suma pasos.
  mockDetectPrendaProducts.mockResolvedValue({
    success: true,
    data: { prendaIds: [] },
  } as never);
  jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      descarga = this.download;
    });
});

const renderWizard = () => render(<LabelSelector isOpen branches={branches} onClose={jest.fn()} />);

/** Paso 1 → 2 eligiendo la sucursal y esperando los productos. */
async function irAlPaso2() {
  renderWizard();
  fireEvent.click(screen.getByRole("button", { name: "Principal" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => {
    expect(mockGetBranchProductsForExport).toHaveBeenCalledWith({ branchId: 1 });
  });
  await screen.findByText("Jabón de Avena");
}

const checkboxesDeProductos = () =>
  within(screen.getByRole("group", { name: /productos con stock/i })).getAllByRole("checkbox");

describe("LabelSelector — paso 1: sucursal", () => {
  it("no deja avanzar sin sucursal", () => {
    renderWizard();

    expect(screen.getByText(/paso 1 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(mockGetBranchProductsForExport).not.toHaveBeenCalled();
  });

  it("al elegir sucursal carga los productos de esa sucursal y avanza al paso 2", async () => {
    await irAlPaso2();

    expect(screen.getByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(screen.getByText("Jabón de Avena")).toBeInTheDocument();
    expect(screen.getByText("Shampoo Solido")).toBeInTheDocument();
  });
});

describe("LabelSelector — paso 2: productos y cantidades", () => {
  it("«Todos» toma la cantidad del stock de cada producto", async () => {
    await irAlPaso2();

    expect(screen.getByText(/0 etiquetas en 0 hojas A4/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Todos" }));

    for (const checkbox of checkboxesDeProductos()) {
      expect(checkbox).toBeChecked();
    }
    expect(screen.getByRole("checkbox", { name: "Todos" })).toBeChecked();
    // El stock manda: 5 + 2 = 7 etiquetas, no una por producto.
    expect(screen.getByLabelText("Cantidad Jabón de Avena")).toHaveValue(5);
    expect(screen.getByLabelText("Cantidad Shampoo Solido")).toHaveValue(2);
    expect(screen.getByText(/7 etiquetas en 1 hoja A4/i)).toBeInTheDocument();
  });

  it("al tildar un producto la cantidad arranca en su stock y se puede corregir", async () => {
    await irAlPaso2();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    expect(screen.getByLabelText("Cantidad Jabón de Avena")).toHaveValue(5);
    expect(screen.getByText(/5 etiquetas en 1 hoja A4/i)).toBeInTheDocument();

    // Lo que escribe el usuario manda sobre el stock.
    fireEvent.change(screen.getByLabelText("Cantidad Jabón de Avena"), {
      target: { value: "3" },
    });
    expect(screen.getByText(/3 etiquetas en 1 hoja A4/i)).toBeInTheDocument();

    // Destildar y volver a tildar no pierde lo escrito.
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    expect(screen.getByLabelText("Cantidad Jabón de Avena")).toHaveValue(3);
  });

  it("suma la cantidad por producto y recalcula las hojas", async () => {
    await irAlPaso2();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    fireEvent.change(screen.getByLabelText("Cantidad Jabón de Avena"), {
      target: { value: "5" },
    });

    expect(screen.getByText(/5 etiquetas en 1 hoja A4/i)).toBeInTheDocument();

    // 73 etiquetas ya piden dos hojas.
    fireEvent.change(screen.getByLabelText("Cantidad Jabón de Avena"), {
      target: { value: "73" },
    });
    expect(screen.getByText(/73 etiquetas en 2 hojas A4/i)).toBeInTheDocument();
  });

  it("el buscador filtra por nombre o código", async () => {
    await irAlPaso2();

    fireEvent.change(screen.getByLabelText("Buscar producto"), {
      target: { value: "bbb8" },
    });

    expect(screen.getByText("Shampoo Solido")).toBeInTheDocument();
    expect(screen.queryByText("Jabón de Avena")).not.toBeInTheDocument();
  });

  it("sin etiquetas el botón de descargar queda deshabilitado", async () => {
    await irAlPaso2();

    expect(screen.getByRole("button", { name: /descargar pdf/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Todos" }));
    expect(screen.getByRole("button", { name: /descargar pdf/i })).toBeEnabled();
  });

  it("genera el PDF con las selecciones y descarga el archivo", async () => {
    await irAlPaso2();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    fireEvent.change(screen.getByLabelText("Cantidad Jabón de Avena"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Shampoo Solido" }));

    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));
    // Todo producto normal pasa por el paso de peluches antes de imprimir.
    await screen.findByText(/¿lleva peluches\?/i);
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(mockGenerateProductLabels).toHaveBeenCalledWith({
        branchId: 1,
        selections: [
          // Lo escrito a mano (3) manda; el otro va con su stock (2).
          { productId: 11, quantity: 3 },
          { productId: 12, quantity: 2 },
        ],
      });
    });
    await waitFor(() => {
      expect(descarga).toBe("etiquetas-PR001-20260101.pdf");
    });
  });

  it("ordena por código y cambia a última modificación desde el control de orden", async () => {
    mockGetBranchProductsForExport.mockResolvedValue({
      success: true,
      data: [
        { id: 21, code: "AAA001", name: "Viejo", stock: 1, price: 10, updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: 22, code: "ZZZ999", name: "Nuevo", stock: 1, price: 10, updatedAt: "2026-05-01T00:00:00.000Z" },
      ],
    } as never);

    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("checkbox", { name: "Seleccionar Viejo" });

    const nombres = () =>
      screen
        .getAllByRole("checkbox", { name: /^Seleccionar / })
        .map((checkbox) => checkbox.getAttribute("aria-label"));

    // Arranca por código: AAA001 antes que ZZZ999.
    expect(nombres()).toEqual(["Seleccionar Viejo", "Seleccionar Nuevo"]);
    expect(screen.getByRole("group", { name: "Ordenar por" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Última modificación" }));

    // La modificación más nueva primero.
    expect(nombres()).toEqual(["Seleccionar Nuevo", "Seleccionar Viejo"]);
  });

  it("muestra el error de la acción sin perder la selección", async () => {
    mockGenerateProductLabels.mockResolvedValueOnce({
      success: false,
      error: "Hay productos inactivos o sin stock en la sucursal seleccionada",
    } as never);

    await irAlPaso2();
    fireEvent.click(screen.getByRole("checkbox", { name: "Todos" }));
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));
    await screen.findByText(/¿lleva peluches\?/i);
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    expect(
      await screen.findByText(/hay productos inactivos o sin stock/i)
    ).toBeInTheDocument();
    expect(descarga).toBeNull();
    // Volver al paso 2 no pierde la selección.
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.getByRole("checkbox", { name: "Todos" })).toBeChecked();
  });
});

describe("LabelSelector — pasos extra cuando hay prendas", () => {
  const rowsConPrenda = [
    { id: 11, code: "AAA001", name: "Jabón de Avena", stock: 5, price: 1250 },
    { id: 31, code: "RPH014", name: "Body Rosa", stock: 3, price: 24000 },
  ];

  const irAlPaso2ConPrenda = async () => {
    mockGetBranchProductsForExport.mockResolvedValue({ success: true, data: rowsConPrenda } as never);
    mockDetectPrendaProducts.mockResolvedValue({ success: true, data: { prendaIds: [31] } } as never);

    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Body Rosa");
  };

  it("con una prenda seleccionada pregunta el tamaño y después los peluches", async () => {
    await irAlPaso2ConPrenda();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Body Rosa" }));
    fireEvent.change(screen.getByLabelText("Cantidad Body Rosa"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));

    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    // Detecta la prenda antes de imprimir y frena en el paso del tamaño.
    await waitFor(() => {
      expect(mockDetectPrendaProducts).toHaveBeenCalledWith({ productIds: [11, 31] });
    });
    expect(await screen.findByText(/tamaño de la etiqueta de prenda/i)).toBeInTheDocument();
    expect(screen.getByText(/paso 3 de 4/i)).toBeInTheDocument();
    expect(mockGenerateProductLabels).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /mediana 35 × 58 mm/i }));
    fireEvent.click(screen.getByRole("button", { name: /^siguiente$/i }));

    // Paso de los peluches: solo los productos que no son prenda.
    expect(await screen.findByText(/¿lleva peluches\?/i)).toBeInTheDocument();
    expect(screen.getByText(/paso 4 de 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /jabón de avena.*peluche/i }));

    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(mockGenerateProductLabels).toHaveBeenCalledWith({
        branchId: 1,
        selections: [
          { productId: 11, quantity: 5 },
          { productId: 31, quantity: 2 },
        ],
        prendaTamano: "mediana",
        pelucheIds: [11],
      });
    });
    await waitFor(() => expect(descarga).toBe("etiquetas-PR001-20260101.pdf"));
  });

  it("solo prendas: el tamaño va derecho al PDF, sin paso de peluches", async () => {
    await irAlPaso2ConPrenda();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Body Rosa" }));
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));
    await screen.findByText(/tamaño de la etiqueta de prenda/i);
    // Sin productos normales no hay nada que marcar como peluche.
    expect(screen.getByText(/paso 3 de 3/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /grande 50 × 80 mm/i }));
    fireEvent.click(screen.getByRole("button", { name: /^siguiente$/i }));

    await waitFor(() => {
      expect(mockGenerateProductLabels).toHaveBeenCalledWith({
        branchId: 1,
        selections: [{ productId: 31, quantity: 3 }],
        prendaTamano: "grande",
      });
    });
    expect(screen.queryByText(/¿lleva peluches\?/i)).toBeNull();
  });

  it("cancelar el paso del tamaño cancela la impresión, sin error y sin generar", async () => {
    await irAlPaso2ConPrenda();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Body Rosa" }));
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));
    await screen.findByText(/tamaño de la etiqueta de prenda/i);

    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(mockGenerateProductLabels).not.toHaveBeenCalled();
    expect(descarga).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // Vuelve al paso 1, lista para empezar de nuevo.
    expect(screen.getByText(/paso 1 de 2/i)).toBeInTheDocument();
  });

  it("una selección de solo peluches muestra el paso y los marca", async () => {
    await irAlPaso2();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Jabón de Avena" }));
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(mockDetectPrendaProducts).toHaveBeenCalledWith({ productIds: [11] });
    });
    // Sin prendas el paso de peluches es el último y no hay paso de tamaño.
    expect(await screen.findByText(/¿lleva peluches\?/i)).toBeInTheDocument();
    expect(screen.getByText(/paso 3 de 3/i)).toBeInTheDocument();
    expect(screen.queryByText(/tamaño de la etiqueta de prenda/i)).toBeNull();
    expect(mockGenerateProductLabels).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /jabón de avena.*peluche/i }));
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(mockGenerateProductLabels).toHaveBeenCalledWith({
        branchId: 1,
        selections: [{ productId: 11, quantity: 5 }],
        pelucheIds: [11],
      });
    });
    await waitFor(() => expect(descarga).toBe("etiquetas-PR001-20260101.pdf"));
  });

  it("una selección vacía no abre ningún paso extra", async () => {
    await irAlPaso2();

    expect(screen.getByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /descargar pdf/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    expect(mockDetectPrendaProducts).not.toHaveBeenCalled();
    expect(screen.queryByText(/¿lleva peluches\?/i)).toBeNull();
    expect(screen.queryByText(/tamaño de la etiqueta de prenda/i)).toBeNull();
  });

  it("si la detección falla lo avisa y no imprime", async () => {
    mockGetBranchProductsForExport.mockResolvedValue({ success: true, data: rowsConPrenda } as never);
    mockDetectPrendaProducts.mockResolvedValue({
      success: false,
      error: "Error al detectar las prendas",
    } as never);

    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Body Rosa");

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Body Rosa" }));
    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    expect(await screen.findByText("Error al detectar las prendas")).toBeInTheDocument();
    expect(mockGenerateProductLabels).not.toHaveBeenCalled();
  });
});
