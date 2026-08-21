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
  { id: 1, name: "Producto A", stock: 10 },
  { id: 2, name: "Producto B", stock: 15 },
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

/** Navega al paso 2: elige sucursal origen y espera a que cargue la tabla. */
async function goToStep2() {
  fireEvent.change(screen.getByLabelText(/sucursal origen/i), {
    target: { value: "1" },
  });
  await waitFor(() => {
    expect(mockGetBranchInventory).toHaveBeenCalledWith({ branchId: 1 });
  });
  await waitFor(() => {
    expect(screen.getByLabelText(/sucursal destino/i)).toBeInTheDocument();
  });
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
  mockGetBranchInventory.mockResolvedValue({ success: true, data: productOptions });
  mockMoveBatch.mockResolvedValue({
    success: true,
    data: {
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

  it("envía el array de items a moveStockBatchBetweenBranches y cierra el modal", async () => {
    const { props } = renderModal();
    await goToStep2();

    fireEvent.change(screen.getByLabelText(/sucursal destino/i), {
      target: { value: "2" },
    });
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
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onConfirm).toHaveBeenCalled();
  });

  it("desmarcar el checkbox deshabilita el input y excluye la fila del sumario y del array", async () => {
    renderModal();
    await goToStep2();

    fireEvent.change(screen.getByLabelText(/sucursal destino/i), {
      target: { value: "2" },
    });
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

    fireEvent.change(screen.getByLabelText(/sucursal destino/i), {
      target: { value: "2" },
    });
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
    expect(screen.getByLabelText(/sucursal destino/i)).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("requiere confirmar el Swal antes de llamar a la action (cancelar no envía)", async () => {
    const { props } = renderModal();
    await goToStep2();

    fireEvent.change(screen.getByLabelText(/sucursal destino/i), {
      target: { value: "2" },
    });
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
});
