/**
 * @jest-environment jsdom
 *
 * Alta y edición de prenda desde `/inventario` (U3).
 *
 * Lo que se fija acá: los campos obligatorios frenan el envío, `esUnica` se
 * precarga desde la categoría y esconde la cantidad, el payload del alta tiene
 * la forma que espera `createPrenda`, el comprobante del ingreso aparece antes
 * de cerrar y el modo edición se llena con la prenda existente sin pedir
 * cantidad (el stock no se edita: S20).
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Product } from "@prisma/client";
import { PrendaForm } from "./PrendaForm";

jest.mock("@/app/actions/prenda", () => ({
  createPrenda: jest.fn(),
  updatePrenda: jest.fn(),
  getPrenda: jest.fn(),
  destacarPrenda: jest.fn(),
}));

jest.mock("@/app/actions/prendaTaxonomy", () => ({
  getCategoriaPrendaOptions: jest.fn(),
  createCategoriaPrenda: jest.fn(),
  getCondicionPrendaOptions: jest.fn(),
  createCondicionPrenda: jest.fn(),
  getEstiloPrendaOptions: jest.fn(),
  createEstiloPrenda: jest.fn(),
  getMedidaTipoOptions: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
}));

// Etiquetas de prenda: la acción arma el PDF en el servidor (pdf-lib).
jest.mock("@/actions/label-print", () => ({
  generatePrendaLabels: jest.fn(),
}));

// Fotos de la prenda (T2): el componente real queda, se observa el helper que
// dispara la subida y se responde la carga de las fotos existentes.
jest.mock("@/components/ui/FotoUploader", () => ({
  ...jest.requireActual("@/components/ui/FotoUploader"),
  subirFotos: jest.fn(async () => null),
}));

jest.mock("@/app/actions/foto", () => ({
  firmarSubidaFoto: jest.fn(),
  confirmarFoto: jest.fn(),
  quitarFoto: jest.fn(),
  getFotosProducto: jest.fn(async () => ({ success: true, data: [] })),
}));

import { createPrenda, destacarPrenda, getPrenda, updatePrenda } from "@/app/actions/prenda";
import { generatePrendaLabels } from "@/actions/label-print";
import {
  createCategoriaPrenda,
  getCategoriaPrendaOptions,
  getCondicionPrendaOptions,
  getEstiloPrendaOptions,
  getMedidaTipoOptions,
} from "@/app/actions/prendaTaxonomy";
import Swal from "sweetalert2";
import { subirFotos } from "@/components/ui/FotoUploader";
import { getFotosProducto } from "@/app/actions/foto";

const mockSubirFotos = subirFotos as jest.MockedFunction<typeof subirFotos>;
const mockGetFotos = getFotosProducto as jest.MockedFunction<typeof getFotosProducto>;

const mockCreate = createPrenda as jest.MockedFunction<typeof createPrenda>;
const mockUpdate = updatePrenda as jest.MockedFunction<typeof updatePrenda>;
const mockGet = getPrenda as jest.MockedFunction<typeof getPrenda>;
const mockDestacar = destacarPrenda as jest.MockedFunction<typeof destacarPrenda>;
const mockCrearCategoria = createCategoriaPrenda as jest.MockedFunction<
  typeof createCategoriaPrenda
>;
const mockSwal = Swal.fire as unknown as jest.Mock;
const mockGeneratePrendaLabels = generatePrendaLabels as jest.MockedFunction<
  typeof generatePrendaLabels
>;

const branches = [{ id: 1, name: "Depósito" }];

const receipt = {
  movementType: "ENTRY" as const,
  branchId: 1,
  branchName: "Depósito",
  branchCode: "DE",
  reference: "ALTA DE PRENDA",
  date: "2026-11-20T10:00:00.000Z",
  rows: [
    { productId: 9, code: "PK000", name: "Campera de jean", price: 12000, quantity: 1, stock: 1 },
  ],
};

const producto = {
  id: 9,
  name: "Campera de jean",
  code: "PK000",
  kind: "PRENDA",
  price: 12000,
  description: "-",
  active: true,
  codePrefix: "PK",
  createdAt: new Date(),
  updatedAt: new Date(),
  inventory: [],
} as unknown as Product;

const prenda = {
  id: 9,
  code: "PK000",
  nombre: "Campera de jean",
  descripcion: "Segunda mano",
  precio: 12000,
  categoriaPrendaId: 1,
  condicionId: 2,
  talles: [{ talle: "M", cantidad: 1 }],
  detalleCondicion: "",
  detalleIntervencion: "",
  costo: 4000,
  esUnica: true,
  estilos: [4],
  medidas: [],
  publicadaEn: ["Web"],
  destacado: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCategoriaPrendaOptions as jest.Mock).mockResolvedValue({
    success: true,
    data: [
      { id: 1, name: "Única", esUnicaPorDefecto: true },
      { id: 2, name: "Nueva con stock", esUnicaPorDefecto: false },
    ],
  });
  (getCondicionPrendaOptions as jest.Mock).mockResolvedValue({
    success: true,
    data: [{ id: 2, name: "Muy bueno" }],
  });
  (getEstiloPrendaOptions as jest.Mock).mockResolvedValue({
    success: true,
    data: [
      { id: 4, name: "Vintage" },
      { id: 5, name: "Minimal" },
    ],
  });
  (getMedidaTipoOptions as jest.Mock).mockResolvedValue({
    success: true,
    data: [{ id: 6, name: "Axila" }],
  });
  mockGet.mockResolvedValue({ success: true, data: prenda } as never);
  mockGetFotos.mockResolvedValue({ success: true, data: [] } as never);
  mockDestacar.mockResolvedValue({
    success: true,
    data: { productId: 9, destacado: true },
  } as never);
  mockSwal.mockResolvedValue({ isConfirmed: false });
});

const renderAlta = () =>
  render(<PrendaForm branches={branches} onClose={jest.fn()} onSuccess={jest.fn()} />);

/** Espera a que las taxonomías estén cargadas (se piden al abrir el modal). */
async function esperarOpciones() {
  await waitFor(() => expect(getCategoriaPrendaOptions).toHaveBeenCalled());
}

/** Espera a que la ficha del paso 2 esté en pantalla (select de categoría con opciones). */
async function esperarFicha() {
  await screen.findByRole("option", { name: "Única" });
}

/** Paso 1 del wizard: elige la sucursal y continúa a la ficha. */
function elegirSucursal() {
  fireEvent.click(screen.getByRole("button", { name: /depósito/i }));
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
}

async function completarMinimos() {
  elegirSucursal();
  await esperarFicha();
  fireEvent.change(screen.getByLabelText(/^nombre/i), {
    target: { value: "Campera de jean" },
  });
  fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "12000" } });
  fireEvent.change(screen.getByLabelText(/^costo/i), { target: { value: "4000" } });
  fireEvent.change(screen.getByLabelText(/^talle/i), { target: { value: "M" } });
  fireEvent.change(screen.getByLabelText(/categoría de prenda/i), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/^condición/i), { target: { value: "2" } });
}

describe("PrendaForm: alta", () => {
  it("es un wizard: primero la sucursal, después la ficha", async () => {
    renderAlta();
    await esperarOpciones();

    // Paso 1: solo la sucursal, sin el botón de crear.
    expect(screen.getByText(/paso 1 de 2/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear prenda/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /depósito/i }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(screen.getByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear prenda/i })).toBeInTheDocument();

    // Se puede volver a cambiar la sucursal desde el encabezado.
    fireEvent.click(screen.getByRole("button", { name: /cambiar sucursal/i }));
    expect(screen.getByText(/paso 1 de 2/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear prenda/i })).not.toBeInTheDocument();
  });

  it("no envía sin los campos obligatorios y avisa qué falta", async () => {
    renderAlta();
    await esperarOpciones();
    elegirSucursal();

    fireEvent.click(screen.getByRole("button", { name: /crear prenda/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El nombre es requerido");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("precarga «prenda única» desde la categoría y esconde la cantidad", async () => {
    renderAlta();
    await esperarOpciones();
    elegirSucursal();
    await esperarFicha();

    // La categoría con stock habilita la cantidad y apaga la marca.
    fireEvent.change(screen.getByLabelText(/categoría de prenda/i), { target: { value: "2" } });
    expect(screen.getByLabelText(/prenda única/i)).not.toBeChecked();
    expect(screen.getByLabelText(/^cantidad/i)).toBeInTheDocument();

    // La categoría única la vuelve a prender y esconde la cantidad.
    fireEvent.change(screen.getByLabelText(/categoría de prenda/i), { target: { value: "1" } });
    expect(screen.getByLabelText(/prenda única/i)).toBeChecked();
    expect(screen.queryByLabelText(/^cantidad/i)).not.toBeInTheDocument();
  });

  it("muestra la ganancia estimada (precio − costo)", async () => {
    renderAlta();
    await esperarOpciones();
    elegirSucursal();
    await esperarFicha();

    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "12000" } });
    fireEvent.change(screen.getByLabelText(/^costo/i), { target: { value: "4000" } });

    expect(screen.getByRole("status")).toHaveTextContent("8.000");
  });

  it("manda el payload del alta con la forma que espera la acción", async () => {
    mockCreate.mockResolvedValue({
      success: true,
      data: { product: { id: 9, code: "PK000", name: "Campera", price: 12000 } },
    } as never);
    renderAlta();
    await esperarOpciones();

    await completarMinimos();
    fireEvent.click(screen.getByRole("button", { name: "Vintage" }));
    fireEvent.click(screen.getByLabelText("Web"));
    fireEvent.click(screen.getByRole("button", { name: /crear prenda/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        nombre: "Campera de jean",
        descripcion: undefined,
        precio: 12000,
        costo: 4000,
        categoriaPrendaId: 1,
        talles: [{ talle: "M", cantidad: 1 }],
        condicionId: 2,
        detalleCondicion: undefined,
        detalleIntervencion: undefined,
        estilos: [4],
        medidas: [],
        esUnica: true,
        branchId: 1,
        publicadaEn: ["Web"],
      })
    );
  });

  it("muestra el comprobante del ingreso antes de cerrar", async () => {
    mockCreate.mockResolvedValue({ success: true, data: { product: {}, receipt } } as never);
    renderAlta();
    await esperarOpciones();

    await completarMinimos();
    fireEvent.click(screen.getByRole("button", { name: /crear prenda/i }));

    expect(await screen.findByText("Ingreso registrado")).toBeInTheDocument();
    expect(screen.getByText("Depósito")).toBeInTheDocument();
  });

  it("ofrece crear la categoría cuando todavía no hay ninguna", async () => {
    (getCategoriaPrendaOptions as jest.Mock).mockResolvedValue({ success: true, data: [] });
    mockSwal
      .mockResolvedValueOnce({ isConfirmed: true, value: "Intervenida" })
      .mockResolvedValueOnce({ isConfirmed: true, value: "RPI" });
    mockCrearCategoria.mockResolvedValue({
      success: true,
      data: { id: 7, name: "Intervenida", esUnicaPorDefecto: true, codePrefix: "RPI" },
    } as never);

    renderAlta();
    await esperarOpciones();
    elegirSucursal();
    await waitFor(() => expect(screen.getByText(/no hay categorías de prenda/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /nueva categoría/i }));

    await waitFor(() =>
      expect(mockCrearCategoria).toHaveBeenCalledWith({ name: "Intervenida", codePrefix: "RPI" })
    );
    // La categoría recién creada queda elegida.
    await waitFor(() =>
      expect(screen.getByLabelText(/categoría de prenda/i)).toHaveValue("7")
    );
  });
});

describe("PrendaForm: edición", () => {
  it("se llena con la prenda existente, muestra el código y no pide cantidad", async () => {
    render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(await screen.findByDisplayValue("Campera de jean")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(9);

    const codigo = screen.getByLabelText(/código/i);
    expect(codigo).toHaveValue("PK000");
    expect(codigo).toHaveAttribute("readonly");

    // El stock solo cambia por movimientos auditables (S20).
    expect(screen.queryByLabelText(/^cantidad/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /sucursal/i })).not.toBeInTheDocument();

    mockUpdate.mockResolvedValue({ success: true, data: { id: 9 } } as never);
    fireEvent.click(screen.getByRole("button", { name: /guardar prenda/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 9,
          nombre: "Campera de jean",
          categoriaPrendaId: 1,
          condicionId: 2,
          esUnica: true,
        })
      )
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("PrendaForm: filas de talle (S1)", () => {
  it("agrega filas de talle con cantidad y deriva el total", async () => {
    mockCreate.mockResolvedValue({ success: true, data: { product: {}, receipt: null } } as never);
    renderAlta();
    await esperarOpciones();
    elegirSucursal();
    await esperarFicha();

    // La categoría con stock apaga «prenda única» y habilita las filas.
    fireEvent.change(screen.getByLabelText(/categoría de prenda/i), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/^talle/i), { target: { value: "S" } });
    fireEvent.change(screen.getByLabelText(/cantidad del talle 1/i), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: /agregar talle/i }));
    fireEvent.change(screen.getByLabelText("Talle 2"), { target: { value: "M" } });
    fireEvent.change(screen.getByLabelText("Cantidad del talle 2"), { target: { value: "3" } });

    // El total se deriva de las filas, nunca se escribe a mano.
    expect(screen.getByTestId("prenda-cantidad-total")).toHaveTextContent("5 unidades");

    // Quitar una fila la saca del total y del payload.
    fireEvent.click(screen.getByRole("button", { name: /quitar talle 2/i }));
    expect(screen.getByTestId("prenda-cantidad-total")).toHaveTextContent("2 unidades");

    // Se completa el resto y se envía.
    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: "Campera" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/^costo/i), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText(/^condición/i), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /crear prenda/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          talles: [{ talle: "S", cantidad: 2 }],
        })
      )
    );
  });
});

describe("PrendaForm: filas de medidas", () => {
  it("agrega una medida con su tipo y sus centímetros", async () => {
    mockCreate.mockResolvedValue({ success: true, data: { product: {}, receipt: null } } as never);
    renderAlta();
    await esperarOpciones();
    elegirSucursal();
    await esperarFicha();

    fireEvent.click(screen.getByRole("button", { name: /agregar medida/i }));
    fireEvent.change(screen.getByLabelText(/tipo de medida/i), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText(/^centímetros/i), { target: { value: "48.5" } });

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: "Campera" } });
    fireEvent.change(screen.getByLabelText(/precio de venta/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/^costo/i), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText(/^talle/i), { target: { value: "S" } });
    fireEvent.change(screen.getByLabelText(/categoría de prenda/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^condición/i), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /crear prenda/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ medidas: [{ medidaTipoId: 6, valorCm: 48.5 }] })
      )
    );
    expect(within(screen.getByRole("dialog")).getByText("Medidas")).toBeInTheDocument();
  });
});

/**
 * T2 de `odd/tasks/fotos-vidriera-polkalinas.md`: la prenda gana la sección de
 * fotos. En el alta las fotos se suben recién con la prenda creada (para tener
 * el id); en la edición se cargan y se administran las existentes.
 */
describe("PrendaForm: fotos (T2)", () => {
  it("muestra la sección de fotos en la ficha del alta", async () => {
    renderAlta();
    await esperarOpciones();
    elegirSucursal();
    await esperarFicha();

    expect(screen.getByText("Fotos")).toBeInTheDocument();
    expect(screen.getByLabelText(/agregar fotos/i)).toBeInTheDocument();
  });

  it("en el alta sube las fotos pendientes cuando la prenda ya existe", async () => {
    mockCreate.mockResolvedValue({
      success: true,
      data: { product: { id: 9, code: "PK000", name: "Campera", price: 12000 } },
    } as never);

    renderAlta();
    await esperarOpciones();
    await completarMinimos();

    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "foto.jpg", { type: "image/jpeg" })],
      configurable: true,
    });
    fireEvent.change(input);

    fireEvent.click(screen.getByRole("button", { name: /crear prenda/i }));

    await waitFor(() => expect(mockSubirFotos).toHaveBeenCalledWith(9, [expect.any(File)]));
  });

  it("en la edición carga las fotos existentes y marca la portada", async () => {
    mockGetFotos.mockResolvedValue({
      success: true,
      data: [
        { position: 0, path: "hash-portada", alt: null, bytes: 10 },
        { position: 1, path: "hash-segunda", alt: null, bytes: 10 },
      ],
    } as never);

    render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(await screen.findByText("Portada")).toBeInTheDocument();
    expect(mockGetFotos).toHaveBeenCalledWith({ productId: 9 });
    expect(screen.getByRole("button", { name: /quitar foto 2/i })).toBeInTheDocument();
  });
});

/**
 * Destacado de la portada (pedido del dueño): solo se puede elegir en una
 * prenda ya publicada en Web y se guarda aparte del formulario.
 */
describe("PrendaForm: destacado de la portada", () => {
  it("en el alta el control está deshabilitado: se elige después de publicar", async () => {
    renderAlta();
    await esperarOpciones();
    elegirSucursal();
    await esperarFicha();

    const control = screen.getByLabelText(/destacar en la portada/i);
    expect(control).toBeDisabled();
    expect(control).not.toBeChecked();
    expect(screen.getByText(/se elige después de publicar/i)).toBeInTheDocument();
  });

  it("en la edición de una prenda sin Web está deshabilitado y avisa", async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { ...prenda, publicadaEn: ["Instagram"] },
    } as never);

    render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);

    const control = await screen.findByLabelText(/destacar en la portada/i);
    expect(control).toBeDisabled();
    expect(screen.getByText(/publicá en web para destacarla/i)).toBeInTheDocument();
  });

  it("en la edición de una prenda publicada se habilita y guarda el cambio", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: { id: 9 } } as never);

    render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);

    const control = await screen.findByLabelText(/destacar en la portada/i);
    expect(control).toBeEnabled();
    expect(control).not.toBeChecked();

    fireEvent.click(control);
    expect(control).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /guardar prenda/i }));

    await waitFor(() =>
      expect(mockDestacar).toHaveBeenCalledWith({ productId: 9, destacado: true })
    );
    // El guardado normal sigue ocurriendo: el destacado va aparte.
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("sin cambios en el destacado no llama la acción", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: { id: 9 } } as never);

    render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await screen.findByLabelText(/destacar en la portada/i);

    fireEvent.click(screen.getByRole("button", { name: /guardar prenda/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockDestacar).not.toHaveBeenCalled();
  });

  it("si el destacado falla, la prenda ya quedó guardada y se muestra el error", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: { id: 9 } } as never);
    mockDestacar.mockResolvedValue({
      success: false,
      error: "Solo se puede destacar una prenda activa y publicada en Web",
    } as never);
    const onClose = jest.fn();

    render(<PrendaForm prenda={producto} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(await screen.findByLabelText(/destacar en la portada/i));
    fireEvent.click(screen.getByRole("button", { name: /guardar prenda/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo destacar/i);
    expect(mockUpdate).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * Etiquetas de prenda (pedido del dueño): el botón de la edición pregunta el
 * tamaño y descarga una etiqueta por unidad de cada talle de la prenda.
 */
describe("PrendaForm: etiquetas de prenda", () => {
  it("pregunta el tamaño y llama la acción con el elegido y los talles de la prenda", async () => {
    URL.createObjectURL = jest.fn(() => "blob:test");
    URL.revokeObjectURL = jest.fn();
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = jest.fn();

    try {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          ...prenda,
          esUnica: false,
          talles: [
            { talle: "S", cantidad: 2 },
            { talle: "M", cantidad: 1 },
          ],
        },
      } as never);
      mockSwal.mockResolvedValueOnce({ isConfirmed: true, value: "mediana" });
      mockGeneratePrendaLabels.mockResolvedValue({
        success: true,
        data: { pdfBase64: "JVBERi0xLjQ=", filename: "etiquetas-prenda-RPH014-mediana.pdf" },
      } as never);

      render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);
      await screen.findByDisplayValue("Campera de jean");

      fireEvent.click(screen.getByRole("button", { name: /imprimir etiquetas/i }));

      await waitFor(() =>
        expect(mockSwal).toHaveBeenCalledWith(
          expect.objectContaining({
            input: "radio",
            confirmButtonColor: "var(--palette-brand-action)",
          })
        )
      );
      await waitFor(() =>
        expect(mockGeneratePrendaLabels).toHaveBeenCalledWith({
          tamano: "mediana",
          selections: [
            { productId: 9, talle: "S", quantity: 2 },
            { productId: 9, talle: "M", quantity: 1 },
          ],
        })
      );
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  it("si se cancela el tamaño no genera nada", async () => {
    mockSwal.mockResolvedValueOnce({ isConfirmed: false });

    render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await screen.findByDisplayValue("Campera de jean");

    fireEvent.click(screen.getByRole("button", { name: /imprimir etiquetas/i }));

    await waitFor(() => expect(mockSwal).toHaveBeenCalled());
    expect(mockGeneratePrendaLabels).not.toHaveBeenCalled();
  });

  it("si la generación falla, el error queda visible y la prenda se puede seguir guardando", async () => {
    mockSwal.mockResolvedValueOnce({ isConfirmed: true, value: "grande" });
    mockGeneratePrendaLabels.mockResolvedValue({
      success: false,
      error: "El talle «XL» no pertenece a la prenda RPH014",
    } as never);

    render(<PrendaForm prenda={producto} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await screen.findByDisplayValue("Campera de jean");

    fireEvent.click(screen.getByRole("button", { name: /imprimir etiquetas/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pertenece a la prenda/i);
    expect(screen.getByRole("button", { name: /guardar prenda/i })).toBeEnabled();
  });
});
