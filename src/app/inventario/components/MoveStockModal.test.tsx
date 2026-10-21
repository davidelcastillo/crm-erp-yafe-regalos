/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MoveStockModal } from "./MoveStockModal";
import type { MoveStockModalProps } from "./MoveStockModal";

jest.mock("@/app/actions/inventory", () => ({
  moveStockBatchBetweenBranches: jest.fn(),
  getBranchInventory: jest.fn(),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

import {
  moveStockBatchBetweenBranches,
  getBranchInventory,
} from "@/app/actions/inventory";
import Swal from "sweetalert2";

const mockMoveBatch = moveStockBatchBetweenBranches as jest.MockedFunction<
  typeof moveStockBatchBetweenBranches
>;
const mockGetBranchInventory = getBranchInventory as jest.MockedFunction<
  typeof getBranchInventory
>;
const mockSwalFire = Swal.fire as unknown as jest.Mock;

const branches = [
  { id: 1, name: "Principal" },
  { id: 2, name: "Centro" },
];

const productOptions = [
  { id: 1, name: "Producto A", code: "PR-A", stock: 10 },
  { id: 2, name: "Producto B", code: "PR-B", stock: 15 },
];

function renderModal(overrides?: Partial<MoveStockModalProps>) {
  const props: MoveStockModalProps = {
    open: true,
    onClose: jest.fn(),
    productId: 1,
    branches,
    onConfirm: jest.fn(),
    ...overrides,
  };
  const view = render(<MoveStockModal {...props} />);
  return { ...view, props };
}

/**
 * Navega al paso 2: elige la sucursal origen tocando su card (carga la tabla) y
 * confirma con «Siguiente».
 */
async function goToStep2() {
  await waitFor(() => {
    fireEvent.click(screen.getByRole("button", { name: "Principal" }));
    expect(screen.getByRole("button", { name: "Principal" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
  await waitFor(() => {
    expect(mockGetBranchInventory).toHaveBeenCalledWith({ branchId: 1 });
  });
  await waitFor(() => {
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("group", { name: /sucursal destino/i })).toBeInTheDocument();
  });
}

/** Elige la sucursal destino tocando su card. */
function elegirDestino(nombre = "Centro") {
  fireEvent.click(screen.getByRole("button", { name: nombre }));
}

async function selectProduct(name: string) {
  fireEvent.click(screen.getByLabelText(new RegExp(`seleccionar ${name}`, "i")));
}

async function setQuantity(name: string, value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`cantidad ${name}`, "i")), {
    target: { value },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBranchInventory.mockResolvedValue({ success: true, data: productOptions } as never);
  mockMoveBatch.mockResolvedValue({
    success: true,
    data: {
      receipt: { movementType: "TRANSFER", date: "2026-08-06T18:30:00.000Z", branchName: "Centro", branchCode: "CEN", sourceBranchName: "Principal", sourceBranchCode: "PRI", reference: "MOVE-1", rows: [] },
      reference: "MOVE-1",
      sourceBranchId: 1,
      destBranchId: 2,
      items: [],
    },
  });
  mockSwalFire.mockResolvedValue({ isConfirmed: true });
});

describe("MoveStockModal", () => {
  it("habilita los inputs y calcula el sumario al seleccionar varias filas", async () => {
    renderModal();
    await goToStep2();

    const inputA = screen.getByLabelText(/cantidad producto a/i);
    const inputB = screen.getByLabelText(/cantidad producto b/i);
    // Sin selección los inputs están deshabilitados.
    expect(inputA).toBeDisabled();
    expect(inputB).toBeDisabled();

    await selectProduct("Producto A");
    await selectProduct("Producto B");

    // Seleccionar habilita los inputs de cantidad.
    expect(inputA).toBeEnabled();
    expect(inputB).toBeEnabled();
    // El sumario cuenta 2 productos (0 unidades hasta ingresar cantidades).
    expect(screen.getByText(/2 productos · 0 unidades/i)).toBeInTheDocument();
  });

  it("muestra error inline y deshabilita el submit cuando la cantidad supera el stock de la fila", async () => {
    renderModal();
    await goToStep2();

    await selectProduct("Producto A");
    await setQuantity("Producto A", "6"); // stock de A es 10 → 6 es válido en A...

    // Producto B stock 15: usar una cantidad inválida para esa fila.
    await selectProduct("Producto B");
    await setQuantity("Producto B", "16"); // > stock 15

    const submit = screen.getByRole("button", { name: /mover stock/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/supera el stock/i)).toBeInTheDocument();

    // Al corregir la cantidad el error desaparece y el submit se habilita.
    await setQuantity("Producto B", "7");
    expect(submit).toBeEnabled();
    expect(screen.queryByText(/supera el stock/i)).not.toBeInTheDocument();
  });

  it('muestra el sumario "2 productos · 10 unidades" con cantidades 3 y 7', async () => {
    renderModal();
    await goToStep2();

    await selectProduct("Producto A");
    await selectProduct("Producto B");
    await setQuantity("Producto A", "3");
    await setQuantity("Producto B", "7");

    expect(screen.getByText(/2 productos · 10 unidades/i)).toBeInTheDocument();
  });

  it("envía el lote una sola vez y ofrece el comprobante antes de cerrar", async () => {
    const { props } = renderModal();
    await goToStep2();

    elegirDestino();
    await selectProduct("Producto A");
    await selectProduct("Producto B");
    await setQuantity("Producto A", "3");
    await setQuantity("Producto B", "7");

    fireEvent.click(screen.getByRole("button", { name: /mover stock/i }));

    await waitFor(() => {
      expect(mockMoveBatch).toHaveBeenCalledWith({
        sourceBranchId: 1,
        destBranchId: 2,
        performedBy: "admin",
        items: [
          { productId: 1, quantity: 3 },
          { productId: 2, quantity: 7 },
        ],
      });
    });
    // S7: el traslado ofrece dos comprobantes, uno por sucursal; el botón genérico anterior pasó a nombrar su lado.
    expect(await screen.findByRole("button", { name: "Comprobante de la sucursal que recibe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comprobante de la sucursal que envía" })).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /mover stock/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar comprobante" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(mockMoveBatch).toHaveBeenCalledTimes(1);
  });

  it("el buscador filtra por nombre y por código, y avisa cuando no hay coincidencias", async () => {
    renderModal();
    await goToStep2();

    const buscador = screen.getByLabelText(/buscar producto/i);

    fireEvent.change(buscador, { target: { value: "Producto B" } });
    expect(screen.getByLabelText(/seleccionar Producto B/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/seleccionar Producto A/i)).not.toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: "pr-a" } });
    expect(screen.getByLabelText(/seleccionar Producto A/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/seleccionar Producto B/i)).not.toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: "zzz" } });
    expect(screen.queryByLabelText(/seleccionar Producto A/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no encontramos productos/i)).toBeInTheDocument();
  });

  it("desmarcar el checkbox deshabilita el input y excluye la fila del sumario y del array", async () => {
    renderModal();
    await goToStep2();

    elegirDestino();
    await selectProduct("Producto A");
    await selectProduct("Producto B");
    await setQuantity("Producto A", "3");
    await setQuantity("Producto B", "7");

    // Desmarcar B: su input se deshabilita y queda fuera del sumario.
    await selectProduct("Producto B");
    expect(screen.getByLabelText(/cantidad producto b/i)).toBeDisabled();
    expect(screen.getByText(/1 producto · 3 unidades/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mover stock/i }));

    await waitFor(() => {
      expect(mockMoveBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: 1, quantity: 3 }],
        })
      );
    });
  });

  it("ante error del backend muestra el mensaje con el producto y mantiene el modal abierto", async () => {
    const { props } = renderModal();
    await goToStep2();

    elegirDestino();
    await selectProduct("Producto A");
    await setQuantity("Producto A", "3");

    mockMoveBatch.mockResolvedValue({
      success: false,
      error: 'Stock insuficiente en origen para "Producto A". Disponible: 2, Requerido: 3',
    });

    fireEvent.click(screen.getByRole("button", { name: /mover stock/i }));

    await waitFor(() => {
      expect(mockSwalFire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: "error",
          text: expect.stringContaining("Producto A"),
        })
      );
    });

    // El modal permanece abierto (sigue en el paso 2) y no se llama onClose.
    expect(screen.getByRole("group", { name: /sucursal destino/i })).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("requiere confirmar el Swal antes de llamar a la action (cancelar no envía)", async () => {
    const { props } = renderModal();
    await goToStep2();

    elegirDestino();
    await selectProduct("Producto A");
    await setQuantity("Producto A", "3");

    mockSwalFire.mockResolvedValue({ isConfirmed: false });

    fireEvent.click(screen.getByRole("button", { name: /mover stock/i }));

    await waitFor(() => {
      expect(mockSwalFire).toHaveBeenCalledWith(
        expect.objectContaining({ title: "¿Mover stock?" })
      );
    });
    expect(mockMoveBatch).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("si falla la carga de productos no deja avanzar al paso 2 y muestra el error", async () => {
    mockGetBranchInventory.mockResolvedValue({
      success: false,
      error: "Error al cargar productos",
    } as never);
    renderModal();

    // El clic va fuera del waitFor: reintentarlo reiniciaría la carga y borraría el error.
    fireEvent.click(screen.getByRole("button", { name: "Principal" }));

    await waitFor(() => {
      expect(screen.getByText(/error al cargar productos/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.queryByRole("group", { name: /sucursal destino/i })).not.toBeInTheDocument();
  });

  it("«Siguiente» está deshabilitado sin origen y el origen queda deshabilitado como destino", async () => {
    renderModal();

    // Sin origen elegido no se puede avanzar. Las cards listan las sucursales activas.
    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    expect(siguiente).toBeDisabled();
    expect(screen.getByRole("button", { name: "Principal" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Centro" })).toBeEnabled();

    await goToStep2();

    // El origen ya no es elegible como destino y no queda seleccionado destino alguno.
    const origen = screen.getByRole("button", { name: "Principal" });
    expect(origen).toBeDisabled();
    fireEvent.click(origen);
    expect(screen.getByRole("button", { name: "Centro" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("no cierra al tocar el fondo del modal", () => {
    // S2: el click afuera no cierra los modales con datos, para no perder lo cargado.
    const onClose = jest.fn();
    render(
      <MoveStockModal
        open
        onClose={onClose}
        productId={1}
        branches={branches}
        onConfirm={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
