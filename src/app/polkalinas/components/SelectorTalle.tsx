"use client";

import { useState } from "react";

import { WHATSAPP_VIDRIERA } from "./whatsapp";

/**
 * Selector de talle y CTA de la ficha (`web/producto.html`): el mensaje de
 * WhatsApp lleva la prenda, su código y el talle elegido. Un producto normal no
 * tiene talles, así que solo se muestra el botón.
 */
const BTN_WHATSAPP =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-accent bg-accent px-5 text-[15px] font-semibold text-background hover:bg-danger focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-hidden";

const BOTON_TALLE =
  "inline-flex min-h-10 min-w-11 items-center justify-center rounded-[10px] border-[1.5px] border-hairline-strong bg-surface px-2.5 font-semibold text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden";

export function BotonWhatsApp({
  nombre,
  codigo,
  talle,
}: {
  nombre: string;
  codigo: string;
  talle?: string | null;
}) {
  const mensaje = `Hola! Quiero ${nombre} (${codigo})${talle ? ` Talle ${talle}` : ""}`;

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
  talles,
}: {
  nombre: string;
  codigo: string;
  talles: string[];
}) {
  const [talle, setTalle] = useState<string | null>(null);

  return (
    <>
      <div role="group" aria-label="Talle" className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] text-ink">Talle</span>
        {talles.map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => setTalle(opcion)}
            aria-pressed={talle === opcion}
            className={BOTON_TALLE}
          >
            {opcion}
          </button>
        ))}
      </div>

      <BotonWhatsApp nombre={nombre} codigo={codigo} talle={talle} />
    </>
  );
}
