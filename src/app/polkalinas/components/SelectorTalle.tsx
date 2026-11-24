"use client";

import { useState } from "react";

import { useFotoSeleccionada } from "./GaleriaFotos";
import { WHATSAPP_VIDRIERA } from "./whatsapp";

/**
 * Selector de talle + variante y CTA de la ficha (`web/producto.html`): el
 * mensaje de WhatsApp lleva la prenda, su código y lo elegido. Al elegir una
 * combinación con foto, la galería grande pasa a esa foto.
 *
 * Una prenda sin variantes se comporta como antes (solo talles); un producto
 * sin talles muestra solo sus variantes. Sin nada que elegir queda el botón.
 */
const BTN_WHATSAPP =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-accent bg-accent px-5 text-[15px] font-semibold text-background hover:bg-danger focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-hidden";

const BOTON_TALLE =
  "inline-flex min-h-10 min-w-11 items-center justify-center rounded-[10px] border-[1.5px] border-hairline-strong bg-surface px-2.5 font-semibold text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden";

export function BotonWhatsApp({ mensaje }: { mensaje: string }) {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_VIDRIERA}?text=${encodeURIComponent(mensaje)}`}
      target="_blank"
      rel="noreferrer"
      className={BTN_WHATSAPP}
    >
      <svg
        aria-hidden="true"
        className="size-4.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 5h16v11H9l-5 4V5z" />
      </svg>
      Lo quiero por WhatsApp
    </a>
  );
}

export function SelectorTalle({
  nombre,
  codigo,
  talles = [],
  combinaciones = [],
  variantes = [],
}: {
  nombre: string;
  codigo: string;
  talles?: string[];
  combinaciones?: { talle: string; variante: string; foto: string | null }[];
  variantes?: { nombre: string; foto: string | null }[];
}) {
  const [talle, setTalle] = useState<string | null>(null);
  const [variante, setVariante] = useState<string | null>(null);
  const { elegirFoto } = useFotoSeleccionada() ?? {};

  // Variantes de una prenda: salen de sus combinaciones; las de un producto ya vienen.
  const opcionesVariante =
    variantes.length > 0
      ? variantes.map((opcion) => opcion.nombre)
      : [...new Set(combinaciones.map((c) => c.variante).filter(Boolean))];

  const elegirTalle = (opcion: string) => {
    setTalle(opcion);
    const foto = combinaciones.find(
      (c) => c.talle === opcion && c.variante === (variante ?? "")
    )?.foto;
    if (foto) elegirFoto?.(foto);
  };

  const elegirVariante = (opcion: string) => {
    setVariante(opcion);
    const foto =
      variantes.length > 0
        ? (variantes.find((v) => v.nombre === opcion)?.foto ?? null)
        : (combinaciones.find((c) => c.talle === talle && c.variante === opcion)?.foto ?? null);
    if (foto) elegirFoto?.(foto);
  };

  const elegido = [talle ? `Talle ${talle}` : "", variante ?? ""]
    .filter(Boolean)
    .join(", ");
  const mensaje = `Hola! Quiero ${nombre} (${codigo})${elegido ? ` ${elegido}` : ""}`;

  return (
    <>
      {talles.length > 0 && (
        <div role="group" aria-label="Talle" className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] text-ink">Talle</span>
          {talles.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => elegirTalle(opcion)}
              aria-pressed={talle === opcion}
              className={BOTON_TALLE}
            >
              {opcion}
            </button>
          ))}
        </div>
      )}

      {opcionesVariante.length > 0 && (
        <div role="group" aria-label="Variante" className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] text-ink">Variante</span>
          {opcionesVariante.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => elegirVariante(opcion)}
              aria-pressed={variante === opcion}
              className={BOTON_TALLE}
            >
              {opcion}
            </button>
          ))}
        </div>
      )}

      <BotonWhatsApp mensaje={mensaje} />
    </>
  );
}
