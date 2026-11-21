import { WHATSAPP_VIDRIERA } from "../whatsapp";
import type { ReactNode } from "react";

/**
 * Envoltorio de las páginas de ayuda: el título en Fraunces y la prosa corta de
 * la marca. El header, el footer y el índice los pone el layout de la carpeta.
 */
export function PaginaAyuda({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <article className="max-w-[68ch]">
      <h1 className="font-display text-[30px] leading-tight text-ink italic md:text-[40px]">
        {titulo}
      </h1>
      <div className="mt-4 flex flex-col gap-3 text-[15px] text-ink-body md:text-base">
        {children}
      </div>
    </article>
  );
}

/** Una sección de la página: subtítulo en Fraunces y su contenido. */
export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="font-display text-xl leading-tight text-ink md:text-2xl">{titulo}</h2>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** El CTA de siempre: WhatsApp del dueño, abierto en otra pestaña. */
export function LinkWhatsApp({ children = "Escribinos por WhatsApp" }: { children?: ReactNode }) {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_VIDRIERA}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center justify-center self-start rounded-full border-2 border-ink px-5 text-[15px] font-semibold text-ink hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
    >
      {children}
    </a>
  );
}
