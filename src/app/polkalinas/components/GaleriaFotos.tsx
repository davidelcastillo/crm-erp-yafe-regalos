"use client";

import { useState } from "react";

/**
 * Galería de la ficha (mockup `web/producto.html`): foto grande y miniaturas.
 * Es lo único interactivo de la vidriera; el resto son páginas del servidor.
 */
export function GaleriaFotos({
  fotos,
  nombre,
}: {
  fotos: { url: string; alt: string }[];
  nombre: string;
}) {
  const [activa, setActiva] = useState(0);

  if (fotos.length === 0) {
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-2xl bg-surface-strong text-sm text-ink-muted">
        Sin fotos
      </div>
    );
  }

  const foto = fotos[activa];

  return (
    <div className="flex flex-col gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.url}
        alt={foto.alt}
        className="aspect-[4/5] w-full rounded-2xl bg-surface-strong object-cover"
      />
      {fotos.length > 1 && (
        <div className="grid grid-cols-4 gap-2.5">
          {fotos.map((miniatura, indice) => (
            <button
              key={miniatura.url}
              type="button"
              onClick={() => setActiva(indice)}
              aria-label={`Ver foto ${indice + 1}`}
              aria-current={indice === activa ? "true" : undefined}
              className="aspect-[4/5] min-h-11 overflow-hidden rounded-[10px] border border-hairline bg-surface-strong aria-[current=true]:border-2 aria-[current=true]:border-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={miniatura.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="text-[13px] text-ink-muted">
        {nombre}: foto {activa + 1} de {fotos.length}
      </p>
    </div>
  );
}
