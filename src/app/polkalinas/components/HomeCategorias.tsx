import Link from "next/link";

import { Marca } from "./Marca";

/**
 * Las cuatro tarjetas de categoría de la home (`grid-cat` de `web/index.html`):
 * crema, cacao, rosa y crema, con la frutilla de la marca y el copy del mockup.
 * Links fijos por slug, igual que el nav del header; «Accesorios» no existe en
 * la tienda, así que la cuarta tarjeta es «Nuevo». No dependen de la base.
 */
const CATEGORIAS = [
  {
    nombre: "Second hand",
    texto: "Prendas elegidas una por una",
    slug: "second-hand",
    clases: "border-hairline bg-surface text-ink",
    corona: "cacao",
  },
  {
    nombre: "Intervenido",
    texto: "Detalles hechos a mano",
    slug: "intervenido",
    clases: "border-ink bg-ink text-background",
    corona: "rosa",
  },
  {
    nombre: "Cositas",
    texto: "Llaveros, peluches y librería",
    slug: "cositas",
    clases: "border-accent-soft bg-accent-soft text-ink",
    corona: "cacao",
  },
  {
    nombre: "Nuevo",
    texto: "Lo último que llegó",
    slug: "nuevo",
    clases: "border-hairline bg-surface text-ink",
    corona: "cacao",
  },
] as const;

export function HomeCategorias() {
  return (
    <section className="pt-6 md:pt-[72px]">
      <h2 className="font-display text-[30px] leading-tight text-ink md:text-[40px]">Categorías</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        {CATEGORIAS.map((categoria) => (
          <li key={categoria.slug} className="min-w-0">
            <Link
              href={`/polkalinas/catalogo?categoria=${categoria.slug}`}
              className={`flex min-h-[160px] flex-col justify-between gap-3 rounded-[18px] border p-5 ${categoria.clases}`}
            >
              <Marca size={40} corona={categoria.corona} wordmark={false} />
              <span>
                <strong className="block font-display text-[22px] leading-none font-normal italic md:text-[26px]">
                  {categoria.nombre}
                </strong>
                <small className="mt-1 block text-[13px] opacity-85">{categoria.texto}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
