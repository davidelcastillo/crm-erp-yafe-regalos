import Link from "next/link";

import { Piano } from "./Piano";
import { WHATSAPP_VIDRIERA } from "./whatsapp";

/**
 * Cabecera y pie de la tienda pública (mockup `web/catalogo.html`: `.topbar`,
 * `.site-header` y `.footer` con la franja «piano»). Se comparten entre el
 * catálogo y la ficha; son server components, sin estado.
 */
export function TiendaHeader() {
  return (
    <>
      <p className="bg-ink px-3 py-2 text-center text-xs font-medium text-background md:text-sm">
        Envíos a todo el país desde Salta · Compras por WhatsApp ♡
      </p>
      <header className="border-b border-hairline bg-background">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-2.5 md:px-10 md:py-4">
          <Link
            href="/polkalinas"
            aria-label="Polkalina's, inicio"
            className="inline-flex min-h-11 items-center font-display text-2xl leading-none text-ink italic md:text-[30px]"
          >
            {"Polkalina's"}
          </Link>
          <nav aria-label="Tienda" className="flex items-center">
            <Link
              href="/polkalinas/catalogo"
              className="inline-flex min-h-11 items-center rounded-full border border-hairline bg-surface px-4 text-sm font-semibold text-ink hover:border-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
            >
              Catálogo
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}

/** Pie de la tienda: franja «piano», marca, contacto y la línea legal. */
export function TiendaFooter() {
  return (
    <footer className="mt-11 bg-ink text-background md:mt-[72px]">
      <Piano />
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-10">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none italic md:text-[34px]">
            {"Polkalina's"}
          </p>
          <p className="mt-2 max-w-[38ch] text-sm text-accent-soft">
            Ropa second hand e intervenida y cositas cute. Salta · envíos a todo el país.
          </p>
        </div>
        <a
          href={`https://wa.me/${WHATSAPP_VIDRIERA}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border-2 border-accent-soft px-5 text-sm font-semibold text-accent-soft hover:border-background hover:text-background focus-visible:ring-2 focus-visible:ring-background focus-visible:outline-hidden"
        >
          Escribinos por WhatsApp
        </a>
      </div>
      <p className="border-t border-background/20 px-4 py-4 text-center text-[13px] text-accent-soft md:px-10">
        {"© Polkalina's · Hecho con cariño en Salta"}
      </p>
    </footer>
  );
}
