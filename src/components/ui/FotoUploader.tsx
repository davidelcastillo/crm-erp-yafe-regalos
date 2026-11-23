"use client";

import { useEffect, useRef, useState } from "react";
import {
  confirmarFoto,
  firmarSubidaFoto,
  getFotosProducto,
  quitarFoto,
} from "@/app/actions/foto";
import {
  MAX_BYTES_FOTO,
  MAX_BYTES_ORIGEN,
  MAX_FOTOS,
  PRODUCT_IMAGES_BUCKET,
  nombreFoto,
  type TamanoFoto,
} from "@/lib/storage";

/**
 * Fotos del producto (S1 de `odd/tasks/fotos-vidriera-polkalinas.md`): hasta 4,
 * la posición 0 es la portada. El archivo se redimensiona acá en el navegador
 * (máx. ~1200px para la ficha y ~400px para la miniatura, WebP) y se sube
 * directo al bucket con una URL firmada; la fila la escribe `confirmarFoto`.
 * El original puede ser grande (hasta `MAX_BYTES_ORIGEN`): lo que se mide
 * contra `MAX_BYTES_FOTO` es el WebP resultante, no el archivo de entrada.
 *
 * En el alta la prenda/producto todavía no existe: las fotos quedan pendientes
 * y el formulario las sube con `subirFotos` cuando la creación devuelve el id.
 */

const LADO_LG = 1200;
const LADO_SM = 400;
const CALIDAD_WEBP = 0.85;
const CALIDAD_MINIMA = 0.5;
const PASO_CALIDAD = 0.07;

/** Foto ya guardada, tal como la devuelve `getFotosProducto`. */
export type FotoGuardada = { position: number; path: string; alt: string | null };

export type SubidaFoto = { success: true } | { success: false; error: string };

export interface FotoUploaderProps {
  /** `null` en el alta: las fotos quedan pendientes hasta que exista el producto. */
  productId: number | null;
  /** El formulario recibe las fotos pendientes para subirlas al crear. */
  onPendientesChange?: (archivos: File[]) => void;
}

/** URL pública y estable de un tamaño de la foto (bucket público, ADR-08). */
export const urlFoto = (productId: number, path: string, tamano: TamanoFoto = "sm") =>
  `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${nombreFoto(productId, path, tamano)}`;

/** Rechaza antes de firmar: el tipo y el peso del ORIGINAL se validan acá. */
const validarArchivo = (archivo: File): string | null => {
  if (!archivo.type.startsWith("image/")) return `«${archivo.name}» no es una imagen`;
  // HEIC/HEIF de iPhone: ni el canvas ni el `<img>` los decodifican fuera de Safari.
  if (/^image\/hei[cf]/i.test(archivo.type) || /\.hei[cf]$/i.test(archivo.name)) {
    return `«${archivo.name}»: formato HEIC/HEIF no soportado, probá con JPG o PNG`;
  }
  if (archivo.size > MAX_BYTES_ORIGEN) return `«${archivo.name}»: supera el tope de 25 MB`;
  return null;
};

/** Marca un archivo que el navegador no pudo decodificar (corrupto, formato raro). */
class ErrorFormato extends Error {}

/** Algo dibujable en el canvas, con su tamaño y cómo soltar sus recursos. */
type Fuente = { imagen: CanvasImageSource; ancho: number; alto: number; liberar: () => void };

/**
 * Decodifica el archivo con fallback: `createImageBitmap` primero (rápido), y si
 * el navegador o el formato no pueden, un `<img>` desde un objectURL. Es el
 * fallo que en producción se veía como «error de decode» con fotos de iPhone.
 */
async function decodificar(archivo: File): Promise<Fuente> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(archivo);
      return {
        imagen: bitmap,
        ancho: bitmap.width,
        alto: bitmap.height,
        liberar: () => bitmap.close?.(),
      };
    } catch {
      // Se prueba la vía del `<img>` antes de darse por vencido.
    }
  }

  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.src = url;
  try {
    if (typeof img.decode === "function") {
      await img.decode();
    } else {
      // Navegadores viejos sin `decode()`: se espera el evento de carga.
      await new Promise<void>((resolver, rechazar) => {
        img.onload = () => resolver();
        img.onerror = () => rechazar(new Error("no se pudo leer el archivo"));
      });
    }
  } catch {
    URL.revokeObjectURL(url);
    throw new ErrorFormato(`«${archivo.name}» no se pudo decodificar`);
  }
  return {
    imagen: img,
    ancho: img.naturalWidth,
    alto: img.naturalHeight,
    liberar: () => URL.revokeObjectURL(url),
  };
}

const aWebp = (lienzo: HTMLCanvasElement, calidad: number) =>
  new Promise<Blob>((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo convertir la imagen"))),
      "image/webp",
      calidad
    )
  );

/**
 * Redimensiona sin ampliar (el lado mayor queda en `lado`) y baja la calidad
 * de a `PASO_CALIDAD` hasta que el WebP entre en `MAX_BYTES_FOTO`. Las
 * dimensiones no se tocan: un celular de 8 MB entra igual.
 */
export async function redimensionar(archivo: File, lado: number): Promise<Blob> {
  const fuente = await decodificar(archivo);
  const mayor = Math.max(fuente.ancho, fuente.alto);
  if (!(mayor > 0)) {
    fuente.liberar();
    throw new ErrorFormato(`«${archivo.name}» no se pudo decodificar`);
  }
  const escala = Math.min(1, lado / mayor);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(fuente.ancho * escala));
  lienzo.height = Math.max(1, Math.round(fuente.alto * escala));
  const contexto = lienzo.getContext("2d");
  if (!contexto) {
    fuente.liberar();
    throw new Error("El navegador no pudo procesar la imagen");
  }
  contexto.drawImage(fuente.imagen, 0, 0, lienzo.width, lienzo.height);
  fuente.liberar();

  for (let calidad = CALIDAD_WEBP; calidad >= CALIDAD_MINIMA - 1e-9; calidad -= PASO_CALIDAD) {
    const blob = await aWebp(lienzo, calidad);
    if (blob.size <= MAX_BYTES_FOTO) return blob;
  }

  throw new Error(`«${archivo.name}» no se pudo comprimir por debajo de 2 MB`);
}

/** SHA-256 en hex del `lg`: es el prefijo que guarda `ProductImage.path`. */
export async function hashDe(blob: Blob): Promise<string> {
  // `FileReader` en vez de `blob.arrayBuffer()`: el segundo no existe en todos
  // los navegadores viejos que todavía entran al panel.
  const bytes = await new Promise<ArrayBuffer>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result as ArrayBuffer);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsArrayBuffer(blob);
  });
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Los tres pasos de una foto (ADR-08): firma, sube los dos tamaños y confirma
 * la fila con los bytes reales del `lg`.
 */
export async function subirFoto(
  productId: number,
  archivo: File,
  alt?: string
): Promise<SubidaFoto> {
  const invalido = validarArchivo(archivo);
  if (invalido) return { success: false, error: invalido };
  const nombre = `«${archivo.name}»`;

  try {
    const lg = await redimensionar(archivo, LADO_LG);
    const sm = await redimensionar(archivo, LADO_SM);
    const hash = await hashDe(lg);

    const firmada = await firmarSubidaFoto({ productId, hash, bytes: lg.size });
    if (!firmada.success) return { success: false, error: `${nombre}: ${firmada.error}` };

    for (const [tamano, blob] of [
      ["lg", lg],
      ["sm", sm],
    ] as const) {
      let subida: Response;
      try {
        subida = await fetch(firmada.data.subidas[tamano].signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: blob,
        });
      } catch {
        return { success: false, error: `${nombre}: fallo de red al subir la foto, revisá la conexión` };
      }
      if (!subida.ok) {
        // 400/403 = la URL firmada ya no sirve (vence a las 2 h).
        const vencida = subida.status === 400 || subida.status === 403;
        return {
          success: false,
          error: vencida
            ? `${nombre}: no se pudo subir (HTTP ${subida.status}): el enlace de subida venció, reintentá`
            : `${nombre}: no se pudo subir (HTTP ${subida.status})`,
        };
      }
    }

    const confirmada = await confirmarFoto({ productId, hash, alt, bytes: lg.size });
    return confirmada.success
      ? { success: true }
      : { success: false, error: `${nombre}: ${confirmada.error ?? "no se pudo confirmar la foto"}` };
  } catch (error) {
    console.error("Error al subir la foto:", error);
    if (error instanceof ErrorFormato) {
      return { success: false, error: `${nombre}: formato no soportado (probá con JPG o PNG)` };
    }
    // Los errores de compresión ya traen un mensaje útil para el usuario.
    const mensaje = error instanceof Error && error.message ? error.message : null;
    return { success: false, error: mensaje ?? `${nombre}: no se pudo procesar la foto` };
  }
}

/**
 * Sube las fotos pendientes del alta, de a una para no saturar memoria en el
 * celular. Devuelve el resumen con el detalle de las que fallaron (o `null`):
 * una foto que falla no bloquea a las demás.
 */
export async function subirFotos(
  productId: number,
  archivos: File[]
): Promise<string | null> {
  const fallas: string[] = [];
  for (const archivo of archivos) {
    const resultado = await subirFoto(productId, archivo);
    if (!resultado.success) fallas.push(resultado.error);
  }
  if (fallas.length === 0) return null;
  return `Se subieron ${archivos.length - fallas.length} de ${archivos.length} fotos: ${fallas.join(" · ")}`;
}

export function FotoUploader({ productId, onPendientesChange }: FotoUploaderProps) {
  const [fotos, setFotos] = useState<FotoGuardada[]>([]);
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Las fotos guardadas solo existen con producto (en el alta la lista está vacía).
  const idProducto = productId ?? 0;

  const total = fotos.length + pendientes.length;

  useEffect(() => {
    onPendientesChange?.(pendientes);
  }, [pendientes, onPendientesChange]);

  /** Recarga las fotos del producto (la llama el efecto del montaje y las
   * acciones de quitar/subir, nunca el render). */
  const recargar = async () => {
    if (productId === null) return;
    const resultado = await getFotosProducto({ productId });
    if (resultado.success) setFotos(resultado.data);
  };

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (productId === null) return;
      const resultado = await getFotosProducto({ productId });
      if (cancelado) return;
      if (resultado.success) setFotos(resultado.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [productId]);

  const agregar = async (archivos: File[]) => {
    setError(null);
    const libres = MAX_FOTOS - total;
    if (libres <= 0) {
      setError(`El máximo es ${MAX_FOTOS} fotos: quitá una para agregar otra`);
      return;
    }
    if (archivos.length > libres) {
      setError(`El máximo es ${MAX_FOTOS} fotos: elegí ${libres} o menos`);
      return;
    }

    if (productId === null) {
      // Alta: se valida acá y la subida espera al producto creado.
      const fallas = archivos.flatMap((archivo) => validarArchivo(archivo) ?? []);
      setPendientes((prev) => [...prev, ...archivos.filter((archivo) => !validarArchivo(archivo))]);
      if (fallas.length > 0) setError(fallas.join(", "));
      return;
    }

    setSubiendo(true);
    setProgreso({ hecho: 0, total: archivos.length });
    const fallas: string[] = [];
    for (const [indice, archivo] of archivos.entries()) {
      setProgreso({ hecho: indice, total: archivos.length });
      const resultado = await subirFoto(productId, archivo);
      if (!resultado.success) fallas.push(resultado.error);
    }
    setProgreso(null);
    setSubiendo(false);
    setError(
      fallas.length > 0
        ? `Se subieron ${archivos.length - fallas.length} de ${archivos.length} fotos. ${fallas.join(" · ")}`
        : null
    );
    await recargar();
  };

  const quitar = async (foto: FotoGuardada) => {
    if (productId === null) return;
    setError(null);
    setSubiendo(true);
    const resultado = await quitarFoto({ productId, position: foto.position });
    setSubiendo(false);
    if (!resultado.success) {
      setError(resultado.error);
      return;
    }
    await recargar();
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(evento) => evento.preventDefault()}
        onDrop={(evento) => {
          evento.preventDefault();
          if (subiendo) return;
          void agregar(Array.from(evento.dataTransfer.files));
        }}
        className="rounded-xl border border-dashed border-hairline-strong bg-surface-soft p-3 text-center"
      >
        <input
          ref={inputRef}
          id="fotos-archivo"
          type="file"
          accept="image/*"
          multiple
          disabled={subiendo || total >= MAX_FOTOS}
          onChange={(evento) => {
            const archivos = Array.from(evento.target.files ?? []);
            evento.target.value = "";
            void agregar(archivos);
          }}
          className="sr-only"
        />
        <label
          htmlFor="fotos-archivo"
          className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl border border-hairline bg-surface px-4 text-sm font-medium text-ink touch-manipulation"
        >
          ＋ Agregar fotos
        </label>
        <p className="mt-2 text-xs text-ink-muted">
          En el celular, tocá para elegir; en la compu podés arrastrarlas. Hasta {MAX_FOTOS} fotos:
          las achicamos y comprimimos solas.
        </p>
      </div>

      {subiendo && (
        <p role="status" className="text-sm text-ink-muted">
          {progreso ? `Subiendo ${progreso.hecho + 1} de ${progreso.total}…` : "Procesando fotos…"}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-error bg-error-surface p-3 text-sm text-error-ink">
          {error}
        </p>
      )}

      {(fotos.length > 0 || pendientes.length > 0) && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fotos.map((foto, indice) => (
            <li key={foto.position} className="relative overflow-hidden rounded-xl border border-hairline">
              {/* Bucket público con URL estable: la miniatura va sin optimizador. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlFoto(idProducto, foto.path)}
                alt={foto.alt ?? `Foto ${indice + 1}`}
                className="aspect-square w-full object-cover"
              />
              {foto.position === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-surface">
                  Portada
                </span>
              )}
              <button
                type="button"
                onClick={() => void quitar(foto)}
                disabled={subiendo}
                aria-label={`Quitar foto ${indice + 1}`}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-surface"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
          {pendientes.map((archivo, indice) => (
            <li
              key={`${archivo.name}-${indice}`}
              className="relative rounded-xl border border-hairline bg-surface-soft p-2 text-xs text-ink-muted"
            >
              <p className="break-words">{archivo.name}</p>
              {fotos.length === 0 && indice === 0 && (
                <span className="mt-1 inline-block rounded-full bg-ink px-2 py-0.5 text-surface">
                  Portada
                </span>
              )}
              <button
                type="button"
                onClick={() => setPendientes((prev) => prev.filter((_, i) => i !== indice))}
                aria-label={`Quitar foto ${fotos.length + indice + 1}`}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-surface"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
