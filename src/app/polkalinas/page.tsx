import Link from "next/link";
import { notFound } from "next/navigation";

import { getVidriera } from "@/app/actions/vidriera";
import { formatPrice } from "@/lib/label-layout";
import { EstadoVidrieraBadge } from "./components/EstadoVidrieraBadge";
import { TiendaFooter, TiendaHeader } from "./components/TiendaHeader";
import { WHATSAPP_VIDRIERA } from "./components/whatsapp";

/**
 * Home de la tienda pública (`web/index.html`): hero con la primera pieza
 * publicada, categorías, «Recién llegado» con sus destacados y las secciones de
 * siempre (cómo comprar y por qué Polkalina's). Como en el mockup, el CTA es
 * WhatsApp: no hay carrito ni favoritas en v1.
 */
export const dynamic = "force-dynamic";

/** Copia del mockup, sin datos que la app todavía no tiene (fecha del drop). */
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

const BTN_PRIMARIO =
  "inline-flex min-h-11 items-center justify-center rounded-full border-2 border-accent bg-accent px-6 text-[15px] font-semibold text-background hover:bg-danger focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-hidden";
const BTN_SECUNDARIO =
  "inline-flex min-h-11 items-center justify-center rounded-full border-2 border-ink px-6 text-[15px] font-semibold text-ink hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden";
const TITULO_SECCION = "font-display text-[30px] leading-tight text-ink md:text-[40px]";

export default async function PolkalinasPage() {
  const resultado = await getVidriera({});
  if (!resultado.success) notFound();

  const { items, categorias } = resultado.data;
  const destacado = items[0];
  const hayProductos = items.some((item) => item.kind === "PRODUCT");

  return (
    <>
      <TiendaHeader />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-10 md:px-10">
        <section className="flex flex-col gap-6 pt-7 pb-4 md:flex-row md:items-stretch md:gap-10 md:pt-[72px]">
          <div className="flex flex-1 flex-col justify-center gap-4 md:gap-5">
            <p className="text-[13px] font-semibold tracking-[.18em] text-accent uppercase">
              Vidriera
            </p>
            <h1 className="font-display text-[40px] leading-none text-ink md:text-[64px]">
              Segundas{" "}
              <span className="text-accent italic">oportunidades</span> para prendas hermosas.
            </h1>
            <p className="max-w-[52ch] text-base text-ink-body md:text-lg">
              Ropa second hand e intervenida, elegida una por una, y cositas cute para tu cuarto y
              tu mochila.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/polkalinas/catalogo" className={BTN_PRIMARIO}>
                Ver catálogo
              </Link>
              <a href="#comprar" className={BTN_SECUNDARIO}>
                Cómo comprar
              </a>
            </div>
          </div>

          <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-3xl bg-surface-strong md:min-h-[520px]">
            {destacado?.portada ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={destacado.portada} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center px-4 text-center text-[13px] text-ink-muted">
                Foto de la vidriera
              </span>
            )}
            {destacado && (
              <Link
                href={`/polkalinas/${destacado.id}`}
                className="absolute bottom-4 left-4 flex w-44 flex-col items-center gap-1 rounded-2xl border border-hairline bg-background px-3.5 py-3 text-center"
              >
                <span className="font-display text-xl leading-none text-ink italic">
                  Pieza única
                </span>
                <span className="text-[13px] text-ink-muted">
                  {destacado.name} · $ {formatPrice(destacado.price)}
                </span>
              </Link>
            )}
          </div>
        </section>

        <section className="pt-11 md:pt-[72px]">
          <h2 className={TITULO_SECCION}>Categorías</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            {categorias.slice(0, 4).map((opcion) => (
              <Link
                key={opcion.id}
                href={`/polkalinas/catalogo?categoria=${opcion.id}`}
                className="flex min-h-[120px] flex-col justify-end rounded-[18px] border border-hairline bg-surface p-4 hover:border-ink"
              >
                <span className="font-display text-xl leading-none text-ink italic md:text-[26px]">
                  {opcion.name}
                </span>
                <span className="mt-1 text-[13px] text-ink-muted">Elegidas una por una</span>
              </Link>
            ))}
            {hayProductos && (
              <Link
                href="/polkalinas/catalogo?tipo=cositas"
                className="flex min-h-[120px] flex-col justify-end rounded-[18px] border border-accent-soft bg-accent-soft p-4 hover:border-ink"
              >
                <span className="font-display text-xl leading-none text-ink italic md:text-[26px]">
                  Cositas
                </span>
                <span className="mt-1 text-[13px] text-ink">
                  Llaveros, peluches, librería y más
                </span>
              </Link>
            )}
          </div>
        </section>

        <section className="pt-11 md:pt-[72px]">
          <div className="flex items-center justify-between gap-3">
            <h2 className={TITULO_SECCION}>
              Recién <span className="italic">llegado</span>
            </h2>
            <Link
              href="/polkalinas/catalogo"
              className="inline-flex min-h-11 shrink-0 items-center text-[15px] font-semibold text-ink hover:text-accent"
            >
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
              {items.slice(0, 8).map((item) => (
                <li key={item.id} className="min-w-0">
                  <Link href={`/polkalinas/${item.id}`} className="flex flex-col gap-2.5">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-strong">
                      {item.portada ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.portada}
                          alt={item.name}
                          className={`size-full object-cover ${
                            item.estado === "VENDIDA" ? "opacity-60" : ""
                          }`}
                        />
                      ) : (
                        <span className="grid size-full place-items-center px-2 text-center text-[13px] text-ink-muted">
                          Sin foto
                        </span>
                      )}
                      {item.categoria && (
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold tracking-[.08em] text-accent uppercase">
                          {item.categoria}
                        </span>
                      )}
                      <span className="absolute inset-x-2.5 bottom-2.5 flex">
                        <EstadoVidrieraBadge estado={item.estado} />
                      </span>
                    </div>
                    <p className="font-display text-base leading-tight text-ink md:text-lg">
                      {item.name}
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      {item.code}
                      {item.categoria ? ` · ${item.categoria}` : ""}
                    </p>
                    <p className="font-display text-lg italic tabular-nums text-ink">
                      $ {formatPrice(item.price)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-11 rounded-[22px] bg-accent-soft px-5 py-8 md:mt-[72px] md:px-10">
          <p className="text-[13px] font-semibold tracking-[.18em] text-accent uppercase">
            Próximo drop
          </p>
          <h2 className={`${TITULO_SECCION} mt-3`}>
            Las prendas únicas <span className="italic">vuelan.</span>
          </h2>
          <p className="mt-3 max-w-[52ch] text-[15px] text-ink">
            Sumate a la lista de difusión y te avisamos por WhatsApp antes que nadie.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_VIDRIERA}`}
            target="_blank"
            rel="noreferrer"
            className={`${BTN_PRIMARIO} mt-4`}
          >
            Avisame del próximo drop
          </a>
        </section>

        <section id="comprar" className="pt-11 md:pt-[72px]">
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
              <div
                key={valor.titulo}
                className="rounded-[18px] border border-hairline bg-surface p-5"
              >
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
      </main>

      <TiendaFooter />
    </>
  );
}
