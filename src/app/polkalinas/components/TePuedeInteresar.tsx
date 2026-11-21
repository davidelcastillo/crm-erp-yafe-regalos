import Link from "next/link";

import type { VidrieraItem } from "@/app/actions/vidriera";
import { ProductoCard } from "./ProductoCard";

/** «Te puede interesar» de `web/producto.html`: cuatro piezas al final. */
export const RELACIONADOS = 4;

export function TePuedeInteresar({ items }: { items: VidrieraItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="pt-11 md:pt-[72px]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[30px] leading-tight text-ink md:text-[40px]">
          Te puede <span className="italic">interesar</span>
        </h2>
        <Link
          href="/polkalinas/catalogo"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[15px] font-semibold text-ink hover:text-accent"
        >
          Ver catálogo →
        </Link>
      </div>

      <ul
        aria-label="Te puede interesar"
        className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6"
      >
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <ProductoCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
