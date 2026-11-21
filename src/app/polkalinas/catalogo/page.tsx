import Link from "next/link";
import { notFound } from "next/navigation";

import { getVidriera } from "@/app/actions/vidriera";
import { formatPrice } from "@/lib/label-layout";
import { EstadoVidrieraBadge } from "../components/EstadoVidrieraBadge";
import { TiendaFooter, TiendaHeader } from "../components/TiendaHeader";

/**
 * Catálogo público (`web/catalogo.html`, T4/S2/S4): prendas y productos
 * publicados en el canal «Web», sin login y de solo lectura. Chips de categoría
 * en cacao, grilla de tarjetas con la foto 4:5 y, debajo, nombre, meta y precio.
 *
 * «Cositas» son los productos normales (`kind === "PRODUCT"`): el filtro se hace
 * acá, sobre lo que ya devuelve `getVidriera`.
 */
export const dynamic = "force-dynamic";

const chip = (activo: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
    activo
      ? "border-ink bg-ink text-background"
      : "border-hairline bg-surface text-ink hover:border-ink"
  }`;

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; tipo?: string }>;
}) {
  const { categoria, q, tipo } = await searchParams;
  const categoriaId = Number(categoria);
  const cositas = tipo === "cositas";

  const resultado = await getVidriera({
    categoriaId: Number.isInteger(categoriaId) && categoriaId > 0 ? categoriaId : undefined,
    q: q || undefined,
  });
  if (!resultado.success) notFound();

  const { categorias } = resultado.data;
  const items = cositas
    ? resultado.data.items.filter((item) => item.kind === "PRODUCT")
    : resultado.data.items;

  return (
    <>
      <TiendaHeader />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-10 md:px-10">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-6 pb-4">
          <h1 className="font-display text-[30px] leading-tight text-ink italic md:text-[40px]">
            Catálogo
          </h1>
          <p className="text-sm text-ink-muted">
            {items.length === 1 ? "1 publicado" : `${items.length} publicados`}
          </p>
        </div>

        <nav
          aria-label="Categorías"
          className="flex gap-2 overflow-x-auto pb-4 [scrollbar-width:none]"
        >
          <Link
            href="/polkalinas/catalogo"
            className={chip(!categoriaId && !cositas)}
            aria-current={!categoriaId && !cositas ? "page" : undefined}
          >
            Todas
          </Link>
          {categorias.map((opcion) => (
            <Link
              key={opcion.id}
              href={`/polkalinas/catalogo?categoria=${opcion.id}`}
              className={chip(opcion.id === categoriaId)}
              aria-current={opcion.id === categoriaId ? "page" : undefined}
            >
              {opcion.name}
            </Link>
          ))}
          <Link
            href="/polkalinas/catalogo?tipo=cositas"
            className={chip(cositas)}
            aria-current={cositas ? "page" : undefined}
          >
            Cositas
          </Link>
        </nav>

        <form role="search" action="/polkalinas/catalogo" className="flex gap-2 pb-5">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            aria-label="Buscar prendas y productos"
            placeholder="Buscar por nombre o código"
            className="min-h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-hairline-strong bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
          />
          {categoriaId > 0 && <input type="hidden" name="categoria" value={categoriaId} />}
          {cositas && <input type="hidden" name="tipo" value="cositas" />}
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-full border border-ink bg-ink px-5 text-sm font-semibold text-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
          >
            Buscar
          </button>
        </form>

        {items.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Todavía no hay prendas ni productos publicados.
          </p>
        ) : (
          <ul aria-label="Prendas y productos" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            {items.map((item) => (
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
      </main>

      <TiendaFooter />
    </>
  );
}
