"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Galería de la ficha (mockup `web/producto.html`): foto grande y miniaturas.
 * Es lo único interactivo de la vidriera junto del selector; el resto son
 * páginas del servidor.
 *
 * La ficha es un server component, así que la foto elegida en el selector de
 * talle/variante viaja por contexto: este provider envuelve la galería y el
 * selector, que son hermanos en el layout.
 */
type FotoSeleccionada = { foto: string | null; elegirFoto: (foto: string | null) => void };

const ContextoFoto = createContext<FotoSeleccionada | null>(null);

/** Envuelve el layout de la ficha (el grid de la galería y la columna de
 * compra) porque las dos necesitan el mismo estado. */
export function FotoSeleccionadaProvider({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [foto, setFoto] = useState<string | null>(null);

  return (
    <ContextoFoto.Provider value={{ foto, elegirFoto: setFoto }}>
      <div className={className}>{children}</div>
    </ContextoFoto.Provider>
  );
}

/** `null` fuera de la ficha: la galería funciona igual, con las miniaturas. */
export const useFotoSeleccionada = () => useContext(ContextoFoto);

export function GaleriaFotos({
  fotos,
  nombre,
}: {
  fotos: { url: string; alt: string }[];
  nombre: string;
}) {
  // Miniatura tocada a mano; la combinación elegida manda mientras esté visible.
  const [manual, setManual] = useState(0);
  const elegir = useFotoSeleccionada();
  const seleccionada = elegir?.foto ?? null;

  if (fotos.length === 0) {
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-2xl bg-surface-strong text-sm text-ink-muted">
        Sin fotos
      </div>
    );
  }

  const deLaCombinacion = seleccionada
    ? fotos.findIndex((foto) => foto.url === seleccionada)
    : -1;
  const activa = deLaCombinacion >= 0 ? deLaCombinacion : manual;
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
              onClick={() => {
                // Tocar una miniatura suelta la foto de la combinación elegida.
                setManual(indice);
                elegir?.elegirFoto(null);
              }}
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
