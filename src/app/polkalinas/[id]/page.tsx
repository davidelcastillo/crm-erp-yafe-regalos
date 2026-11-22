import Link from "next/link";
import { notFound } from "next/navigation";

import { getVidriera, getVidrieraItem } from "@/app/actions/vidriera";
import type { VidrieraFicha, VidrieraItem } from "@/app/actions/vidriera";
import { NOMBRE_GRUPO } from "@/lib/grupos-vidriera";
import { formatPrice } from "@/lib/label-layout";
import { EstadoVidrieraBadge } from "../components/EstadoVidrieraBadge";
import { GaleriaFotos } from "../components/GaleriaFotos";
import { BotonWhatsApp, SelectorTalle } from "../components/SelectorTalle";
import { RELACIONADOS, TePuedeInteresar } from "../components/TePuedeInteresar";
import { TiendaFooter, TiendaHeader } from "../components/TiendaHeader";

/**
 * Ficha pública de la vidriera (`web/producto.html`, T5/S2): migas, galería con
 * miniaturas, título en Fraunces con la última palabra en itálica, precio
 * destacado, «Pieza única» y el estado, el selector de talle que arma el
 * mensaje de WhatsApp, la descripción y, en lugar de la bolsita del mockup, las
 * tres filas de envío, retiro y pago. Cierra con «Te puede interesar».
 *
 * No publicado, borrado o inexistente dan el mismo 404: la action no distingue
 * el motivo. Sin guía de talles ni código: el dueño los sacó.
 */
export const dynamic = "force-dynamic";

/** Las tres filas del mockup: el dato que falta va como TODO en el texto. */
const INFORMACION = [
  {
    titulo: "Envíos a todo el país",
    texto: "Por correo o encomienda. Te pasamos el costo por WhatsApp.",
    icono: "M2 6h12v10H2z M14 10h4l3 3v3h-7 M6 17a2 2 0 1 0 0 .01 M17 17a2 2 0 1 0 0 .01",
  },
  // TODO: el dueño todavía no pasó la dirección ni el horario del punto físico.
  {
    titulo: "Retiro en Salta",
    texto: "En el punto físico: Punto de retiro: Punto Rosa · BALCARCE 39 - GALERIA AUGUSTO - Salta, Argentina · LUNES A VIERNES DE 9.30 A 21.00 HS",
    icono: "M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
  },
  {
    titulo: "Medios de pago",
    texto: "Transferencia, Mercado Pago o efectivo.",
    icono: "M3 6h18v12H3z M3 10h18",
  },
];

const FILA = "flex justify-between gap-3 border-t border-hairline py-2.5 text-[15px] text-ink";

export default async function FichaVidrieraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  const resultado = await getVidrieraItem({ id: productId });
  if (!resultado.success) notFound();

  const item = resultado.data;
  const esPrenda = item.kind === "PRENDA";
  const relacionados = await getVidriera({});
  const otros = relacionados.success ? relacionados.data.items : [];

  return (
    <>
      <TiendaHeader />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-10 md:px-10">
        <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 py-2 text-[13px] text-ink-muted">
          <Link href="/polkalinas" className="hover:text-ink">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          {/* La miga lleva al grupo de la tienda, que es lo que filtra el catálogo. */}
          <Link
            href={item.grupo ? `/polkalinas/${item.grupo}` : "/polkalinas/catalogo"}
            className="hover:text-ink"
          >
            {item.grupo ? NOMBRE_GRUPO[item.grupo] : (item.categoria ?? "Catálogo")}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{item.name}</span>
        </nav>

        <div className="grid gap-6 md:grid-cols-[3fr_2fr] md:gap-12">
          <GaleriaFotos fotos={item.fotos} nombre={item.name} />

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {esPrenda && (
                <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-ink">
                  Pieza única
                </span>
              )}
              <EstadoVidrieraBadge estado={item.estado} />
            </div>

            <h1 className="font-display text-[26px] leading-tight break-words text-ink md:text-[40px]">
              {palabras(item.name)}
            </h1>

            <p className="text-[26px] font-semibold tabular-nums text-ink">
              $ {formatPrice(item.price)}
            </p>

            {/* Una pieza vendida no se puede comprar: en su lugar, el estado ya
              lo comunica el badge. Lo mismo si está agotada. */}
            {item.estado === "VENDIDA" || item.estado === "AGOTADO" ? null : item.talles
                .length > 0 ? (
              <SelectorTalle nombre={item.name} codigo={item.code} talles={item.talles} />
            ) : (
              <BotonWhatsApp nombre={item.name} codigo={item.code} />
            )}

            {/* Variantes del producto, sin stock exacto: las opciones que publica
              la ficha, igual que los talles de una prenda. */}
            {item.variantes && item.variantes.length > 0 && (
              <div role="group" aria-label="Variantes" className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] text-ink">Variantes</span>
                {item.variantes.map((variante) => (
                  <span
                    key={variante.nombre}
                    className="inline-flex min-h-10 items-center rounded-[10px] border-[1.5px] border-hairline-strong bg-surface px-2.5 font-semibold text-ink"
                  >
                    {variante.nombre}
                  </span>
                ))}
              </div>
            )}

            {item.descripcion && (
              <p className="text-[15px] leading-relaxed break-words text-ink-body">{item.descripcion}</p>
            )}

            {/* TODO: `getVidrieraItem` todavía no publica las medidas de la prenda. */}
            {(item.condicion || item.detalleCondicion) && (
              <div className={FILA}>
                <span>Estado</span>
                <b className="text-right font-semibold">
                  {[item.condicion, item.detalleCondicion].filter(Boolean).join(" · ")}
                </b>
              </div>
            )}

            {/* Todas las categorías del producto: son equivalentes, así que se
                listan juntas (la de prenda entra como única). */}
            {item.categorias && item.categorias.length > 0 ? (
              <p className="text-[15px] text-ink-muted">
                {item.categorias.length > 1 ? "Categorías" : "Categoría"}:{" "}
                {item.categorias.join(" · ")}
              </p>
            ) : (
              item.categoria && (
                <p className="text-[15px] text-ink-muted">Categoría: {item.categoria}</p>
              )
            )}

            {item.sucursales && item.sucursales.length > 0 && (
              <p className="text-[15px] text-ink-muted">
                Disponible en: {item.sucursales.map((sucursal) => sucursal.name).join(" · ")}
              </p>
            )}

            <div className="mt-1 flex flex-col">
              {INFORMACION.map((dato) => (
                <div key={dato.titulo} className="flex items-start gap-3 border-t border-hairline py-3">
                  <svg
                    aria-hidden="true"
                    className="size-5.5 shrink-0 text-ink"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={dato.icono} />
                  </svg>
                  <div>
                    <strong className="block text-[15px] text-ink">{dato.titulo}</strong>
                    <span className="text-[14px] text-ink-muted">{dato.texto}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <TePuedeInteresar items={sugeridos(item, otros)} />
      </main>

      <TiendaFooter />
    </>
  );
}

/** El mockup pone la última palabra del título en itálica. */
const palabras = (nombre: string) => {
  const partes = nombre.split(" ");
  if (partes.length < 2) return nombre;
  const cola = partes.pop();
  return (
    <>
      {partes.join(" ")} <span className="italic">{cola}</span>
    </>
  );
};

/** Misma categoría si hay, y si no el resto de lo publicado, sin la propia pieza. */
const sugeridos = (item: VidrieraFicha, otros: VidrieraItem[]) => {
  const resto = otros.filter((otro) => otro.id !== item.id);
  const mismaCategoria = item.categoria
    ? resto.filter((otro) => otro.categoria === item.categoria)
    : [];

  return [...mismaCategoria, ...resto.filter((otro) => !mismaCategoria.includes(otro))].slice(
    0,
    RELACIONADOS
  );
};
