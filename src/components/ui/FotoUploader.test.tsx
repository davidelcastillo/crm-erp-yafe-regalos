/**
 * @jest-environment jsdom
 *
 * Fotos del producto (S1, T2 de `odd/tasks/fotos-vidriera-polkalinas.md`).
 *
 * Lo que se fija acá: el tipo se rechaza en el cliente ANTES de firmar, un
 * original grande se comprime hasta entrar en 2 MB (bajando la calidad, no el
 * lado), el orden firmar → subir `lg` → subir `sm` → confirmar con los bytes
 * reales, el path con `productId` para que dos productos con la misma imagen no
 * compartan objeto, el error del PUT con su status, el tope de 4, la portada
 * marcada (posición 0), el borrado de una foto guardada y que en el alta las
 * fotos queden pendientes sin firmar nada.
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

const MB = 1024 * 1024;

/** jsdom no dibuja: cada test arranca con el `toBlob` simulado (1 byte). */
const toBlobStub = function (callback: BlobCallback) {
  callback(new Blob(["x"], { type: "image/webp" }));
} as HTMLCanvasElement["toBlob"];

const archivo = (name = "foto.jpg", type = "image/jpeg", size = 1000) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const elegirArchivos = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
};

/** El bitmap simulado de jsdom: 1600×900, que es lo que dibuja el canvas. */
const bitmapStub = jest.fn(async () => ({ width: 1600, height: 900, close: jest.fn() }));

beforeAll(() => {
  // El navegador de los tests no dibuja: Canvas + bitmap + hash se simulan.
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    drawImage: jest.fn(),
  })) as unknown as HTMLCanvasElement["getContext"];
  HTMLCanvasElement.prototype.toBlob = toBlobStub;
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = bitmapStub;
  // El fallback `<img>.decode()` no existe en jsdom: se simula que carga.
  HTMLImageElement.prototype.decode = jest.fn(async function (this: HTMLImageElement) {
    Object.defineProperty(this, "naturalWidth", { value: 1600, configurable: true });
    Object.defineProperty(this, "naturalHeight", { value: 900, configurable: true });
  }) as unknown as HTMLImageElement["decode"];
  // El `objectURL` de jsdom no identifica el archivo: acá lleva su nombre.
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: jest.fn((blob: Blob) => `blob:${(blob as File).name}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { subtle: { digest: jest.fn(async () => new Uint8Array(32).fill(7).buffer) } },
  });
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: true }));
});

beforeEach(() => {
  jest.clearAllMocks();
  HTMLCanvasElement.prototype.toBlob = toBlobStub;
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = bitmapStub;
  HTMLImageElement.prototype.decode = jest.fn(async function (this: HTMLImageElement) {
    Object.defineProperty(this, "naturalWidth", { value: 1600, configurable: true });
    Object.defineProperty(this, "naturalHeight", { value: 900, configurable: true });
  }) as unknown as HTMLImageElement["decode"];
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: true }));
  mockFirmar.mockResolvedValue({
    success: true,
    data: {
      subidas: {
        lg: { path: `7/${HASH}_lg.webp`, token: "t-lg", signedUrl: "https://storage.test/lg" },
        sm: { path: `7/${HASH}_sm.webp`, token: "t-sm", signedUrl: "https://storage.test/sm" },
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

  it("rechaza un original de más de 25 MB sin firmar nada", async () => {
    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;

    elegirArchivos(input, [archivo("enorme.jpg", "image/jpeg", 30 * MB)]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/25 MB/i);
    expect(mockFirmar).not.toHaveBeenCalled();
  });

  it("acepta un original de 5 MB y lo comprime bajando la calidad", async () => {
    // 0.85 y 0.78 dan más de 2 MB; recién en 0.71 entra (5 MB entra en 3 pasos).
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, _tipo, calidad) {
      const bytes = calidad !== undefined && calidad > 0.75 ? 3 * MB : 500 * 1000;
      callback(new Blob([new Uint8Array(bytes)], { type: "image/webp" }));
    } as HTMLCanvasElement["toBlob"];

    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;

    elegirArchivos(input, [archivo("celular.jpg", "image/jpeg", 5 * MB)]);

    await waitFor(() => expect(mockConfirmar).toHaveBeenCalled());
    const cuerpos = (fetch as jest.Mock).mock.calls.map(
      ([, opciones]: [string, { body: Blob }]) => opciones.body.size
    );
    expect(cuerpos).toHaveLength(2);
    for (const bytes of cuerpos) expect(bytes).toBeLessThanOrEqual(2 * MB);
  });

  it("rechaza con un mensaje útil si ni en calidad mínima entra en 2 MB", async () => {
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
      callback(new Blob([new Uint8Array(3 * MB)], { type: "image/webp" }));
    } as HTMLCanvasElement["toBlob"];

    const resultado = await subirFoto(7, archivo("pesada.jpg", "image/jpeg", 6 * MB));

    expect(resultado).toMatchObject({ success: false });
    expect(resultado.success === false && resultado.error).toMatch(/pesada\.jpg.*2 MB/i);
    expect(mockFirmar).not.toHaveBeenCalled();
  });
});

describe("FotoUploader: subida", () => {
  it("firma, sube los dos tamaños y confirma con los bytes del lg", async () => {
    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;

    elegirArchivos(input, [archivo()]);

    await waitFor(() => expect(mockConfirmar).toHaveBeenCalled());
    expect(mockFirmar).toHaveBeenCalledWith({ productId: 7, hash: HASH, bytes: 1 });
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
      urlFoto(7, "hash-portada")
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
  it("urlFoto deriva el path con producto y la miniatura del hash guardado", () => {
    expect(urlFoto(7, "abc")).toMatch(/\/product-images\/7\/abc_sm\.webp$/);
    expect(urlFoto(7, "abc", "lg")).toMatch(/\/product-images\/7\/abc_lg\.webp$/);
  });

  it("hashDe devuelve el SHA-256 en hex", async () => {
    await expect(hashDe(new Blob(["x"]))).resolves.toBe(HASH);
  });

  it("subirFoto corta si el PUT falla y no confirma", async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: false, status: 413 }));

    const resultado = await subirFoto(7, archivo());

    expect(resultado.success).toBe(false);
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it("el error del PUT incluye el status HTTP", async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: false, status: 413 }));

    const resultado = await subirFoto(7, archivo());

    expect(resultado.success === false && resultado.error).toMatch(/HTTP 413/);
  });

  it("distingue la URL de subida vencida y sugiere reintentar", async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: false, status: 403 }));

    const resultado = await subirFoto(7, archivo());

    expect(resultado.success === false && resultado.error).toMatch(/venci[oó].*reintent/i);
  });
});

describe("FotoUploader: formato no soportado", () => {
  it("rechaza un HEIC antes de decodificar y nombra el formato", async () => {
    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;

    elegirArchivos(input, [archivo("IMG_0042.HEIC", "image/heic")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /IMG_0042\.HEIC.*HEIC.*JPG o PNG/i
    );
    expect((globalThis as unknown as { createImageBitmap: jest.Mock }).createImageBitmap).not.toHaveBeenCalled();
    expect(mockFirmar).not.toHaveBeenCalled();
  });

  it("usa el fallback <img> cuando createImageBitmap falla y la sube igual", async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = jest.fn(async () => {
      throw new Error("The source image could not be decoded.");
    });
    const decode = jest.fn(async function (this: HTMLImageElement) {
      Object.defineProperty(this, "naturalWidth", { value: 1600, configurable: true });
      Object.defineProperty(this, "naturalHeight", { value: 900, configurable: true });
    });
    HTMLImageElement.prototype.decode = decode as unknown as HTMLImageElement["decode"];

    const resultado = await subirFoto(7, archivo("fallback.jpg"));

    expect(decode).toHaveBeenCalled();
    expect(resultado).toEqual({ success: true });
    expect(mockConfirmar).toHaveBeenCalled();
  });

  it("si el bitmap y el <img> fallan, avisa por archivo y no corta las demás", async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = jest.fn(async () => {
      throw new Error("The source image could not be decoded.");
    });
    HTMLImageElement.prototype.decode = jest.fn(async function (this: HTMLImageElement) {
      if (this.src.includes("rota")) throw new Error("The source image could not be decoded.");
      Object.defineProperty(this, "naturalWidth", { value: 1600, configurable: true });
      Object.defineProperty(this, "naturalHeight", { value: 900, configurable: true });
    }) as unknown as HTMLImageElement["decode"];

    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;
    elegirArchivos(input, [archivo("rota.jpg"), archivo("buena.jpg")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /rota\.jpg.*formato no soportado.*JPG o PNG/i
    );
    expect(mockFirmar).toHaveBeenCalledTimes(1);
    expect(mockConfirmar).toHaveBeenCalledTimes(1);
  });
});

describe("FotoUploader: errores accionables y progreso", () => {
  it("el error del PUT nombra el archivo y el status HTTP", async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ ok: false, status: 500 }));

    const resultado = await subirFoto(7, archivo("pesada.jpg"));

    expect(resultado.success === false && resultado.error).toMatch(/pesada\.jpg.*HTTP 500/);
  });

  it("sube en serie y el contador «X de N» avanza en orden", async () => {
    const pendientes: Array<() => void> = [];
    mockFirmar.mockImplementation(
      () =>
        new Promise((resolver) =>
          pendientes.push(() =>
            resolver({
              success: true,
              data: {
                subidas: {
                  lg: { path: `7/${HASH}_lg.webp`, token: "t-lg", signedUrl: "https://storage.test/lg" },
                  sm: { path: `7/${HASH}_sm.webp`, token: "t-sm", signedUrl: "https://storage.test/sm" },
                },
              },
            } as never)
          )
        )
    );

    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;
    elegirArchivos(input, [archivo("uno.jpg"), archivo("dos.jpg")]);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/subiendo 1 de 2/i);
      // En serie: la segunda no arranca hasta que termina la primera.
      expect(pendientes).toHaveLength(1);
    });

    pendientes.shift()?.();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/subiendo 2 de 2/i);
      expect(pendientes).toHaveLength(1);
    });

    pendientes.shift()?.();
    await waitFor(() => expect(mockConfirmar).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("el mensaje final cuenta las subidas y lista la fallida con su motivo", async () => {
    mockFirmar
      .mockResolvedValueOnce({ success: false, error: "No se pudo firmar la subida de la foto" } as never)
      .mockResolvedValue({
        success: true,
        data: {
          subidas: {
            lg: { path: `7/${HASH}_lg.webp`, token: "t-lg", signedUrl: "https://storage.test/lg" },
            sm: { path: `7/${HASH}_sm.webp`, token: "t-sm", signedUrl: "https://storage.test/sm" },
          },
        },
      } as never);

    render(<FotoUploader productId={7} />);
    const input = screen.getByLabelText(/agregar fotos/i) as HTMLInputElement;
    elegirArchivos(input, [archivo("uno.jpg"), archivo("dos.jpg")]);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/se subieron 1 de 2 fotos/i);
    expect(alerta).toHaveTextContent(/uno\.jpg.*no se pudo firmar/i);
  });

  it("distingue el fallo de red del PUT del rechazo del servidor", async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const resultado = await subirFoto(7, archivo("sinred.jpg"));

    expect(resultado.success === false && resultado.error).toMatch(/sinred\.jpg.*red/i);
  });
});
