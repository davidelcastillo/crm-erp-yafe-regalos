/**
 * @jest-environment jsdom
 *
 * Fotos del producto (S1, T2 de `odd/tasks/fotos-vidriera-polkalinas.md`).
 *
 * Lo que se fija acá: el tipo y el peso se rechazan en el cliente ANTES de
 * firmar, el orden firmar → subir `lg` → subir `sm` → confirmar con los bytes
 * reales, el tope de 4, la portada marcada (posición 0), el borrado de una foto
 * guardada y que en el alta las fotos queden pendientes sin firmar nada.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FotoUploader, hashDe, subirFoto, urlFoto } from "./FotoUploader";

jest.mock("@/app/actions/foto", () => ({
  firmarSubidaFoto: jest.fn(),
  confirmarFoto: jest.fn(),
  quitarFoto: jest.fn(),
  getFotosProducto: jest.fn(),
}));

import { confirmarFoto, firmarSubidaFoto, getFotosProducto, quitarFoto } from "@/app/actions/foto";

const mockFirmar = firmarSubidaFoto as jest.MockedFunction<typeof firmarSubidaFoto>;
const mockConfirmar = confirmarFoto as jest.MockedFunction<typeof confirmarFoto>;
const mockQuitar = quitarFoto as jest.MockedFunction<typeof quitarFoto>;
const mockGetFotos = getFotosProducto as jest.MockedFunction<typeof getFotosProducto>;

/** SHA-256 simulado: 32 bytes en 7 → hash hex "07" repetido 64 veces. */
const HASH = "07".repeat(32);

const archivo = (name = "foto.jpg", type = "image/jpeg", size = 1000) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const elegirArchivos = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
};

beforeAll(() => {
  // El navegador de los tests no dibuja: Canvas + bitmap + hash se simulan.
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    drawImage: jest.fn(),
  })) as unknown as HTMLCanvasElement["getContext"];
  HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
    callback(new Blob(["x"], { type: "image/webp" }));
  } as HTMLCanvasElement["toBlob"];
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = jest.fn(
    async () => ({ width: 1600, height: 900, close: jest.fn() })
  );
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { subtle: { digest: jest.fn(async () => new Uint8Array(32).fill(7).buffer) } },
  });
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: true }));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFirmar.mockResolvedValue({
    success: true,
    data: {
      subidas: {
        lg: { path: `${HASH}_lg.webp`, token: "t-lg", signedUrl: "https://storage.test/lg" },
        sm: { path: `${HASH}_sm.webp`, token: "t-sm", signedUrl: "https://storage.test/sm" },
      },
    },
  } as never);
  mockConfirmar.mockResolvedValue({ success: true, data: { position: 0 } } as never);
  mockQuitar.mockResolvedValue({ success: true, data: { position: 0 } } as never);
  mockGetFotos.mockResolvedValue({ success: true, data: [] } as never);
});

describe("FotoUploader: validación en el cliente", () => {
  it("rechaza un archivo que no es imagen sin firmar nada", async () => {
    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;

    elegirArchivos(input, [archivo("notas.pdf", "application/pdf")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no es una imagen/i);
    expect(mockFirmar).not.toHaveBeenCalled();
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it("rechaza un archivo de más de 2 MB sin firmar nada", async () => {
    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;

    elegirArchivos(input, [archivo("grande.jpg", "image/jpeg", 3 * 1024 * 1024)]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/2 MB/i);
    expect(mockFirmar).not.toHaveBeenCalled();
  });
});

describe("FotoUploader: subida", () => {
  it("firma, sube los dos tamaños y confirma con los bytes del lg", async () => {
    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;

    elegirArchivos(input, [archivo()]);

    await waitFor(() => expect(mockConfirmar).toHaveBeenCalled());
    expect(mockFirmar).toHaveBeenCalledWith({ hash: HASH, bytes: 1 });
    // Un PUT por tamaño, en el orden en que se firmaron.
    expect((fetch as jest.Mock).mock.calls).toEqual([
      ["https://storage.test/lg", expect.objectContaining({ method: "PUT" })],
      ["https://storage.test/sm", expect.objectContaining({ method: "PUT" })],
    ]);
    expect(mockConfirmar).toHaveBeenCalledWith({ productId: 7, hash: HASH, bytes: 1 });
  });

  it("respeta el tope de 4 fotos contando las que ya existen", async () => {
    mockGetFotos.mockResolvedValue({
      success: true,
      data: [
        { position: 0, path: "a", alt: null, bytes: 1 },
        { position: 1, path: "b", alt: null, bytes: 1 },
        { position: 2, path: "c", alt: null, bytes: 1 },
        { position: 3, path: "d", alt: null, bytes: 1 },
      ],
    } as never);

    render(<FotoUploader productId={7} />);
    await screen.findByText("Portada");

    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;
    elegirArchivos(input, [archivo()]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/máximo es 4 fotos/i);
    expect(mockFirmar).not.toHaveBeenCalled();
  });

  it("no firma en el alta: deja las fotos pendientes", async () => {
    const onPendientesChange = jest.fn();
    render(<FotoUploader productId={null} onPendientesChange={onPendientesChange} />);

    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;
    elegirArchivos(input, [archivo("alta.jpg")]);

    await waitFor(() =>
      expect(onPendientesChange).toHaveBeenLastCalledWith([expect.any(File)])
    );
    expect(mockFirmar).not.toHaveBeenCalled();
    expect(screen.getByText("alta.jpg")).toBeInTheDocument();
  });
});

describe("FotoUploader: fotos existentes", () => {
  it("lista las guardadas y marca la portada (posición 0)", async () => {
    mockGetFotos.mockResolvedValue({
      success: true,
      data: [
        { position: 0, path: "hash-portada", alt: null, bytes: 10 },
        { position: 1, path: "hash-segunda", alt: null, bytes: 10 },
      ],
    } as never);

    render(<FotoUploader productId={7} />);

    expect(await screen.findByText("Portada")).toBeInTheDocument();
    expect(mockGetFotos).toHaveBeenCalledWith({ productId: 7 });
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("img", { name: /foto 1/i })).toHaveAttribute(
      "src",
      urlFoto("hash-portada")
    );
  });

  it("quitar borra la foto y recarga las existentes", async () => {
    mockGetFotos.mockResolvedValue({
      success: true,
      data: [{ position: 0, path: "hash-portada", alt: null, bytes: 10 }],
    } as never);

    render(<FotoUploader productId={7} />);
    await screen.findByText("Portada");

    fireEvent.click(screen.getByRole("button", { name: /quitar foto 1/i }));

    await waitFor(() =>
      expect(mockQuitar).toHaveBeenCalledWith({ productId: 7, position: 0 })
    );
    await waitFor(() => expect(mockGetFotos).toHaveBeenCalledTimes(2));
  });
});

describe("FotoUploader: helpers de subida", () => {
  it("urlFoto deriva la miniatura del path guardado", () => {
    expect(urlFoto("abc")).toMatch(/\/product-images\/abc_sm\.webp$/);
    expect(urlFoto("abc", "lg")).toMatch(/\/product-images\/abc_lg\.webp$/);
  });

  it("hashDe devuelve el SHA-256 en hex", async () => {
    await expect(hashDe(new Blob(["x"]))).resolves.toBe(HASH);
  });

  it("subirFoto corta si el PUT falla y no confirma", async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: false }));

    const resultado = await subirFoto(7, archivo());

    expect(resultado.success).toBe(false);
    expect(mockConfirmar).not.toHaveBeenCalled();
  });
});
