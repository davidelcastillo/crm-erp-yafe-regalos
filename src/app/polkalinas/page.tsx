import Link from "next/link";
import { notFound } from "next/navigation";

import { getVidriera } from "@/app/actions/vidriera";
import { formatPrice } from "@/lib/label-layout";
import { HomeCategorias } from "./components/HomeCategorias";
import { LUNARES, ProductoCard } from "./components/ProductoCard";
import { ProximoDrop } from "./components/ProximoDrop";
import { TiendaFooter, TiendaHeader } from "./components/TiendaHeader";

/**
 * Home de la tienda pública (`web/index.html`): hero con la primera pieza
 * publicada en la etiqueta colgante, las cuatro categorías, «Recién llegado»
 * con los últimos 8 publicados (4 en el celu), el banner del próximo drop, cómo
 * comprar, por qué Polkalina's e Instagram. Como en el mockup, el CTA es
 * WhatsApp: no hay carrito ni favoritas en v1. Los huecos sin foto son lunares,
 * nunca un cuadro gris.
 */
export const dynamic = "force-dynamic";

/** Copia del mockup, sin datos que la app todavía no tiene (bolsita). */
const PASOS = [
  { titulo: "Elegí", texto: "Mirá el catálogo y quedate con la prenda que te guste." },
  { titulo: "Escribinos", texto: "Se abre WhatsApp con tu consulta ya escrita." },
  { titulo: "Pagá", texto: "Transferencia, Mercado Pago o efectivo en el local." },
  { titulo: "Recibí", texto: "Retiro en Salta o envío a todo el país." },
];

const VALORES = [
  { titulo: "Prendas con personalidad", texto: "Ropa diferente, con estilos únicos y detalles especiales." },
  { titulo: "Precios accesibles", texto: "Vestirse lindo no debería costar una fortuna." },
  { titulo: "Moda para expresarte", texto: "De lo coquette a lo alternativo, vintage y Y2K." },
  { titulo: "Prendas seleccionadas", texto: "Elegimos cada cosita para que encuentres algo especial." },
  { titulo: "Segundas oportunidades", texto: "Le damos una nueva vida a prendas hermosas." },
  { titulo: "Atención cercana", texto: "Un emprendimiento que crece con esfuerzo y cariño." },
];

/** El mismo perfil que el footer de la tienda; `TiendaHeader` no lo exporta. */
const INSTAGRAM = "https://www.instagram.com/polkalinass_/";

const BTN_FRUTILLA =
  "inline-flex min-h-11 items-center justify-center rounded-full border-2 border-accent bg-accent px-6 text-[15px] font-semibold text-background hover:bg-danger focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-hidden";
const BTN_SECUNDARIO =
  "inline-flex min-h-11 items-center justify-center rounded-full border-2 border-ink px-6 text-[15px] font-semibold text-ink hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden";
const TITULO_SECCION = "font-display text-[30px] leading-tight text-ink md:text-[40px]";
const ENLACE_SECCION =
  "inline-flex min-h-11 shrink-0 items-center gap-1 text-[15px] font-semibold text-ink hover:text-accent";
const RECIEN_LLEGADO = 8;
/** El mockup muestra 4 tarjetas en el celu y las demás recién en escritorio. */
const EN_CELU = 4;

export default async function PolkalinasPage() {
  const resultado = await getVidriera({});
  if (!resultado.success) notFound();

  const { items } = resultado.data;
  // El destacado lo elige el dueño desde la prenda; si no hay ninguno, la
  // portada cae a la primera publicada para no quedar vacía.
  const destacado = items.find((item) => item.destacado) ?? items[0];
  const fotos = items.flatMap((item) => (item.portada ? [item.portada] : []));

  return (
    <>
      <TiendaHeader />

      <main>
        <div className="mx-auto w-full max-w-[1240px] px-4 md:px-10">
          <section className="flex flex-col gap-6 pt-7 pb-4 md:flex-row md:items-stretch md:gap-10 md:pt-[72px]">
            <div className="flex flex-1 flex-col justify-center gap-4 md:gap-5">
              {/* TODO: el dueño no dio la fecha del nuevo drop: sin fecha no va el kicker. */}
              <h1 className="font-display text-[40px] leading-none text-ink md:text-[64px]">
                Segundas{" "}
                <span className="text-accent italic">oportunidades</span> para prendas hermosas.
              </h1>
              <p className="max-w-[52ch] text-base text-ink-body md:text-lg">
                Ropa second hand e intervenida, elegida una por una, y cositas cute para tu cuarto
                y tu mochila.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/polkalinas/catalogo" className={BTN_FRUTILLA}>
                  Ver catálogo
                </Link>
                <Link href="/polkalinas/ayuda/como-comprar" className={BTN_SECUNDARIO}>
                  Cómo comprar
                </Link>
              </div>
            </div>

            <div
              data-testid="hero-foto"
              style={destacado?.portada ? undefined : LUNARES("rosa")}
              className="relative min-h-[380px] flex-1 overflow-hidden rounded-3xl bg-accent-soft md:min-h-[520px]"
            >
              {destacado?.portada && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={destacado.portada} alt="" className="size-full object-cover" />
              )}
              {destacado && (
                <Link
                  href={`/polkalinas/${destacado.id}`}
                  aria-label={`Pieza única: ${destacado.name}, ${destacado.talles?.[0] ?? ""},$ ${formatPrice(destacado.price)}`}
                  className="absolute bottom-[18px] left-[18px] flex w-36 flex-col items-center gap-1.5 rounded-[14px] border border-hairline bg-background px-3.5 py-3 text-center"
                >
                  <span
                    aria-hidden="true"
                    className="size-3.5 rounded-full border-2 border-ink bg-accent-soft"
                  />
                  <strong className="font-display text-xl leading-none font-normal text-ink italic">
                    Pieza única
                  </strong>
                  {/* TODO: falta el talle de la pieza: `getVidriera` todavía no lo manda. */}
                  <small className="text-[13px] text-ink">$ {formatPrice(destacado.price)}</small>
                </Link>
              )}
            </div>
          </section>

          <HomeCategorias />

          <section className="pt-11 md:pt-[72px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className={TITULO_SECCION}>
                Recién <span className="italic">llegado</span>
              </h2>
              <Link href="/polkalinas/catalogo" className={ENLACE_SECCION}>
                Ver todo →
              </Link>
            </div>

            {items.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Todavía no hay prendas ni productos publicados.
              </p>
            ) : (
              <ul
                aria-label="Recién llegado"
                className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6"
              >
                {items.slice(0, RECIEN_LLEGADO).map((item, indice) => (
                  <li
                    key={item.id}
                    className={`min-w-0 ${indice < EN_CELU ? "" : "hidden md:block"}`}
                  >
                    <ProductoCard item={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <ProximoDrop fotos={fotos} />

        <div className="mx-auto w-full max-w-[1240px] px-4 pb-10 md:px-10">
          <section className="pt-11 md:pt-[72px]">
            <h2 className={TITULO_SECCION}>
              Cómo <span className="text-accent italic">comprar</span>
            </h2>
            <ol className="mt-4 grid gap-5 md:grid-cols-4 md:gap-6">
              {PASOS.map((paso, indice) => (
                <li key={paso.titulo} className="flex items-start gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent font-display text-[22px] text-background italic">
                    {indice + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-[17px] text-ink">{paso.titulo}</strong>
                    <p className="mt-1 text-[15px] text-ink-muted">{paso.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="pt-11 md:pt-[72px]">
            <h2 className={TITULO_SECCION}>
              Por qué <span className="text-accent italic">{"Polkalina's"}</span>
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {VALORES.map((valor) => (
                <div key={valor.titulo} className="rounded-[18px] border border-hairline bg-surface p-5">
                  <b aria-hidden="true" className="block text-[22px] text-accent">
                    ♡
                  </b>
                  <h3 className="mt-1.5 font-display text-[21px] leading-tight text-ink">
                    {valor.titulo}
                  </h3>
                  <p className="mt-1.5 text-[15px] text-ink-muted">{valor.texto}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-11 md:pt-[72px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className={TITULO_SECCION}>Seguinos en Instagram</h2>
              <a href={INSTAGRAM} target="_blank" rel="noreferrer" className={ENLACE_SECCION}>
                @polkalinass_ →
              </a>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
              {Array.from({ length: 6 }, (_, indice) =>
                fotos[indice] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={indice}
                    data-testid="ig-cuadro"
                    src={fotos[indice]}
                    alt=""
                    className="aspect-square w-full rounded-[10px] object-cover"
                  />
                ) : (
                  <div
                    key={indice}
                    data-testid="ig-cuadro"
                    aria-hidden="true"
                    style={LUNARES(indice % 2 === 0 ? "rosa" : "crema")}
                    className={`aspect-square w-full rounded-[10px] ${
                      indice % 2 === 0 ? "bg-accent-soft" : "bg-background"
                    }`}
                  />
                )
              )}
            </div>
          </section>
        </div>
      </main>

      <TiendaFooter />
    </>
  );
}
