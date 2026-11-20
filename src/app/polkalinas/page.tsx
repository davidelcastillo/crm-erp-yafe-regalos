import Link from "next/link";
import { notFound } from "next/navigation";

import { getVidriera } from "@/app/actions/vidriera";
import { formatPrice } from "@/lib/label-layout";
import { EstadoVidrieraBadge } from "./components/EstadoVidrieraBadge";

/**
 * Catálogo público de la vidriera (T4, S2/S4): prendas y productos publicados en
 * el canal «Web», sin login y de solo lectura. Chips de categoría de prenda y
 * tarjetas con portada, nombre, precio y estado, como `web/catalogo.html`.
 */
export const dynamic = "force-dynamic";

const chip = (activo: boolean) =>
  `inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
    activo
      ? "border-ink bg-ink text-background"
      : "border-hairline bg-surface text-ink hover:border-ink"
  }`;

export default async function PolkalinasPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string }>;
}) {
  const { categoria, q } = await searchParams;
  const categoriaId = Number(categoria);

  const resultado = await getVidriera({
    categoriaId: Number.isInteger(categoriaId) && categoriaId > 0 ? categoriaId : undefined,
    q: q || undefined,
  });
  if (!resultado.success) notFound();

  const { items, categorias } = resultado.data;

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="px-4 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-ink-muted">
          Vidriera
        </p>
        <h1 className="font-display text-[26px] leading-tight text-ink md:text-[34px]">
          {"Polkalina's"}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Prendas y productos publicados. Consultá por WhatsApp desde cada ficha.
        </p>
      </header>

      <nav
        aria-label="Categorías"
        className="mt-4 flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none]"
      >
        <Link href="/polkalinas" className={chip(!categoriaId)}>
          Todas
        </Link>
        {categorias.map((opcion) => (
          <Link
            key={opcion.id}
            href={`/polkalinas?categoria=${opcion.id}`}
            className={chip(opcion.id === categoriaId)}
          >
            {opcion.name}
          </Link>
        ))}
      </nav>

      <form role="search" action="/polkalinas" className="flex gap-2 px-4 pb-5">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          aria-label="Buscar prendas y productos"
          placeholder="Buscar por nombre o código"
          className="min-h-11 min-w-0 flex-1 rounded-2xl border-[1.5px] border-hairline-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
        />
        {categoriaId > 0 && <input type="hidden" name="categoria" value={categoriaId} />}
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-full border border-ink bg-ink px-4 text-sm font-semibold text-background"
        >
          Buscar
        </button>
      </form>

      {items.length === 0 ? (
        <p className="px-4 text-sm text-ink-muted">
          Todavía no hay prendas ni productos publicados.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 px-4 md:grid-cols-4 md:gap-5">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <Link href={`/polkalinas/${item.id}`} className="flex flex-col gap-2.5">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-strong">
                  {item.portada ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.portada}
                      alt={item.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center px-2 text-center text-[13px] text-ink-muted">
                      Sin foto
                    </span>
                  )}
                  <span className="absolute inset-x-2.5 bottom-2.5">
                    <EstadoVidrieraBadge estado={item.estado} />
                  </span>
                </div>
                <p className="font-display text-base leading-tight text-ink">{item.name}</p>
                <p className="text-[13px] tabular-nums text-ink-muted">
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
  );
}
