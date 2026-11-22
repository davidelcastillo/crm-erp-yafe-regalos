import Link from "next/link";

import type { VidrieraItem } from "@/app/actions/vidriera";
import { formatPrice } from "@/lib/label-layout";
import { EstadoVidrieraBadge } from "./EstadoVidrieraBadge";

/**
 * Lunares del mockup (`.banner` y `.ph.rosa`): el patrón va por CSS y los dos
 * colores salen de los tokens del tema. Vive acá porque la tarjeta es el primer
 * consumidor y el catálogo lo va a reusar cuando adopte esta card.
 */
export const LUNARES = (base: "rosa" | "crema") => ({
  backgroundImage: `radial-gradient(var(${base === "rosa" ? "--background" : "--accent-soft"}) 14%, transparent 16%)`,
  backgroundSize: "32px 32px",
});

/** `talles` todavía no viene en la lista de `getVidriera`: la card lo usa si está. */
export type ItemVidriera = VidrieraItem & { talles?: string[] };

/** Meta del mockup: el talle manda sobre el código; un producto normal muestra su categoría. */
const meta = ({ talles, categoria }: ItemVidriera) => {
  if (!talles?.length) return categoria;
  return talles.length === 1
    ? `Talle ${talles[0]} · única`
    : `Talles ${talles.join(", ")}`;
};

/**
 * Categorías públicas del ítem: todas las del producto (son equivalentes). Si la
 * lista no viene, queda la principal para no romper los consumidores viejos.
 */
const categoriasDe = (item: ItemVidriera) =>
  item.categorias ?? (item.categoria ? [item.categoria] : []);

/**
 * Tarjeta de producto de la vidriera (`article.prod` de `web/index.html`): foto
 * 4:5 con la categoría arriba y el estado abajo, nombre en Fraunces, meta y
 * precio al final. Vendida se atenúa entera, como el mockup. Sin favoritos ni
 * carrito: la compra se cierra por WhatsApp.
 */
export function ProductoCard({ item, className = "" }: { item: ItemVidriera; className?: string }) {
  const vendida = item.estado === "VENDIDA";
  const dato = meta(item);
  const categorias = categoriasDe(item);

  return (
    <Link
      href={`/polkalinas/${item.id}`}
      className={`flex flex-col gap-2.5 ${vendida ? "opacity-55" : ""} ${className}`}
    >
      <div
        data-testid="prod-foto"
        style={item.portada ? undefined : LUNARES("rosa")}
        className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-accent-soft"
      >
        {item.portada && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.portada} alt={item.name} className="size-full object-cover" />
        )}
        {categorias.length > 0 && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold tracking-[.08em] text-accent uppercase">
            {categorias[0]}
          </span>
        )}
        {/* Las demás categorías del producto, debajo de la primera: todas son
            equivalentes y la card las muestra todas. */}
        {categorias.length > 1 && (
          <span className="absolute top-2.5 left-2.5 mt-7 flex max-w-[calc(100%-1.25rem)] flex-wrap gap-1">
            {categorias.slice(1).map((categoria) => (
              <span
                key={categoria}
                className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold tracking-[.08em] text-accent uppercase"
              >
                {categoria}
              </span>
            ))}
          </span>
        )}
        <span className="absolute inset-x-2.5 bottom-2.5 flex">
          <EstadoVidrieraBadge estado={item.estado} />
        </span>
      </div>
      <p className="font-display text-[15px] leading-tight break-words text-ink md:text-lg">{item.name}</p>
      {dato && <p className="text-[13px] text-ink-muted">{dato}</p>}
      <p className="font-display text-lg italic tabular-nums text-ink">$ {formatPrice(item.price)}</p>
    </Link>
  );
}
