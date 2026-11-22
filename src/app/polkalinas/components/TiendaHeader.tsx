"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Marca } from "./Marca";
import { Piano } from "./Piano";
import { WHATSAPP_VIDRIERA } from "./whatsapp";

/**
 * Chrome de la tienda pública (mockup `web/index.html`): barra superior cacao,
 * header con la marca y el nav completo, buscador, menú mobile, franja piano y
 * footer de contacto.
 *
 * Es client porque el menú y el buscador se abren y cierran; el HTML sale
 * igual del servidor. El nav son los cuatro grupos del pedido del dueño (Ropa,
 * Peluches, Accesorios, Otros productos), cada uno con su ruta, más la ayuda.
 */
const NAV = [
  { etiqueta: "Ropa", href: "/polkalinas/ropa" },
  { etiqueta: "Peluches", href: "/polkalinas/peluches" },
  { etiqueta: "Accesorios", href: "/polkalinas/accesorios" },
  { etiqueta: "Otros productos", href: "/polkalinas/otros" },
  { etiqueta: "Cómo comprar", href: "/polkalinas/ayuda/como-comprar" },
];

const COMPRAR = NAV.slice(0, 4);

const AYUDA = [
  { etiqueta: "Cómo comprar", href: "/polkalinas/ayuda/como-comprar" },
  { etiqueta: "Envíos y retiros", href: "/polkalinas/ayuda/envios-y-retiros" },
  { etiqueta: "Medios de pago", href: "/polkalinas/ayuda/medios-de-pago" },
];

const INSTAGRAM = "https://www.instagram.com/polkalinass_/";

const DIRECCION_DEL_PUNTO_FISICO = "https://maps.app.goo.gl/m1yT6F6qZHr4PT9N8";
const TIKTOK = "https://www.tiktok.com/@polkalinas?_r=1&_t=ZS-9BbE4SdzB7X";

const ICONO = "size-[22px]";
const BOTON_ICONO =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden";

export function TiendaHeader() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);

  // El drawer cierra con Escape, como cualquier capa modal.
  useEffect(() => {
    if (!menuAbierto) return;
    const escuchar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuAbierto(false);
    };
    document.addEventListener("keydown", escuchar);
    return () => document.removeEventListener("keydown", escuchar);
  }, [menuAbierto]);

  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <>
      {/* Sticky con hairline y sombra fijas: sin listener de scroll. */}
      <div
        data-testid="tienda-navbar"
        className="sticky top-0 z-40 border-b border-hairline bg-background shadow-card"
      >
        <p className="bg-ink px-3 py-2 text-center text-xs font-medium text-background md:text-sm">
          Envíos a todo el país desde Salta · Compras por WhatsApp ♡
        </p>

        <header>
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-2.5 md:px-10 md:py-4">
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto(true)}
              className={`${BOTON_ICONO} md:hidden`}
            >
              <svg
                className={ICONO}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <Link href="/polkalinas" aria-label="Polkalina's, inicio" className="shrink-0 text-ink">
              <Marca size={39} />
            </Link>

            <nav aria-label="Tienda" className="hidden flex-wrap items-center gap-x-[26px] md:flex">
              {NAV.map((opcion) => (
                <Link
                  key={opcion.etiqueta}
                  href={opcion.href}
                  className="inline-flex min-h-11 items-center text-base text-ink hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                >
                  {opcion.etiqueta}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              aria-label="Buscar"
              aria-expanded={buscadorAbierto}
              onClick={() => setBuscadorAbierto((abierto) => !abierto)}
              className={BOTON_ICONO}
            >
              <svg
                className={ICONO}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M20 20l-3.5-3.5" />
              </svg>
            </button>
          </div>

          {buscadorAbierto && (
            <form
              role="search"
              action="/polkalinas/catalogo"
              className="mx-auto flex max-w-[1240px] gap-2 px-4 pb-3 md:px-10"
            >
              <input
                type="search"
                name="q"
                aria-label="Buscar en el catálogo"
                placeholder="Buscar por nombre o código"
                className="min-h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-hairline-strong bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
              />
              <button
                type="submit"
                className="min-h-11 shrink-0 rounded-full border border-ink bg-ink px-5 text-sm font-semibold text-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
              >
                Buscar
              </button>
            </form>
          )}

          {/* En el celu los navegadores son chips, como el mockup. */}
          <nav
            aria-label="Atajos de categorías"
            className="mx-auto flex max-w-[1240px] gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:hidden"
          >
            <Link
              href="/polkalinas/catalogo"
              className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-ink bg-ink px-3 text-[13px] font-semibold text-background"
            >
              Todo
            </Link>
            {COMPRAR.map((opcion) => (
              <Link
                key={opcion.etiqueta}
                href={opcion.href}
                className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-hairline bg-surface px-3 text-[13px] font-semibold whitespace-nowrap text-ink"
              >
                {opcion.etiqueta}
              </Link>
            ))}
          </nav>
        </header>
      </div>

      <Piano />

      {menuAbierto && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={cerrarMenu}
            className="absolute inset-0 bg-scrim"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="absolute inset-y-0 left-0 flex w-[min(86vw,340px)] animate-fade-in-right flex-col gap-1.5 overflow-y-auto bg-background p-5"
          >
            <div className="flex items-center justify-between pb-2.5">
              <Link href="/polkalinas" aria-label="Polkalina's, inicio" className="text-ink">
                <Marca size={31} />
              </Link>
              <button type="button" aria-label="Cerrar" onClick={cerrarMenu} className={BOTON_ICONO}>
                <svg
                  className={ICONO}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {NAV.map((opcion) => (
              <Link
                key={opcion.etiqueta}
                href={opcion.href}
                onClick={cerrarMenu}
                className="flex min-h-12 items-center border-b border-hairline text-lg text-ink"
              >
                {opcion.etiqueta}
              </Link>
            ))}
            <Link
              href="/polkalinas/catalogo"
              onClick={cerrarMenu}
              className="flex min-h-12 items-center border-b border-hairline text-lg text-ink"
            >
              Todo el catálogo
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_VIDRIERA}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center text-lg text-ink"
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}

/** Pie de la tienda: franja «piano» en crema, las cuatro columnas y lo legal. */
export function TiendaFooter() {
  return (
    <footer className="mt-11 bg-ink text-background md:mt-[72px]">
      <Piano crema />

      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-11 md:grid-cols-4 md:px-10">
        <div className="min-w-0">
          <Link href="/polkalinas" className="text-background">
            <Marca size={44} corona="rosa" />
          </Link>
          <p className="mt-2 max-w-[34ch] text-[15px] text-accent-soft">
            Ropa, peluches, accesorios y otros productos. Salta · envíos a todo el país.
          </p>
        </div>

        <div>
          <h3 className="mb-2.5 text-[13px] font-semibold tracking-[.12em] text-accent-soft uppercase">
            Comprar
          </h3>
          {COMPRAR.map((opcion) => (
            <Link
              key={opcion.etiqueta}
              href={opcion.href}
              className="block py-1 text-[15px] text-background hover:text-accent-soft"
            >
              {opcion.etiqueta}
            </Link>
          ))}
        </div>

        <div>
          <h3 className="mb-2.5 text-[13px] font-semibold tracking-[.12em] text-accent-soft uppercase">
            Ayuda
          </h3>
          {AYUDA.map((opcion) => (
            <Link
              key={opcion.etiqueta}
              href={opcion.href}
              className="block py-1 text-[15px] text-background hover:text-accent-soft"
            >
              {opcion.etiqueta}
            </Link>
          ))}
        </div>

        <div>
          <h3 className="mb-2.5 text-[13px] font-semibold tracking-[.12em] text-accent-soft uppercase">
            Contacto
          </h3>
          <a
            href={`https://wa.me/${WHATSAPP_VIDRIERA}`}
            target="_blank"
            rel="noreferrer"
            className="block py-1 text-[15px] text-background hover:text-accent-soft"
          >
            WhatsApp +54 9 387 636 0163
          </a>
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noreferrer"
            className="block py-1 text-[15px] text-background hover:text-accent-soft"
          >
            Instagram @polkalinass_
          </a>
          {/* TODO: el dueño todavía no pasó el usuario de TikTok. */}
          <a
            href={TIKTOK}
            target="_blank"
            rel="noreferrer"
            className="block py-1 text-[15px] text-background hover:text-accent-soft"
          >
            TikTok @polkalinas
          </a>
          {/* TODO: el dueño todavía no pasó la dirección del punto físico. */}
          <a
            href={DIRECCION_DEL_PUNTO_FISICO}
            target="_blank"
            rel="noreferrer"
            className="block py-1 text-[15px] text-background hover:text-accent-soft"
          >
            Punto físico: Punto Rosa · BALCARCE 39 - GALERIA AUGUSTO - Salta, Argentina
          </a>
          {/* TODO: el dueño todavía no pasó los horarios de atención. */}
          <span className="block py-1 text-[15px] text-accent-soft">Horario: LUNES A VIERNES DE 9.30 A 21.00 HS
SABADOS DE 9.30 A 13 Y DE 17 A 21 HS.</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-4 md:px-10">
        <p className="border-t border-background/20 py-4 text-[13px] text-accent-soft">
          {"© Polkalina's · Hecho con cariño en Salta"}
        </p>
      </div>
    </footer>
  );
}
