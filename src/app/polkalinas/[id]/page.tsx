import Link from "next/link";
import { notFound } from "next/navigation";

import { getVidrieraItem } from "@/app/actions/vidriera";
import { formatPrice } from "@/lib/label-layout";
import { EstadoVidrieraBadge } from "../components/EstadoVidrieraBadge";
import { GaleriaFotos } from "../components/GaleriaFotos";
import { TiendaFooter, TiendaHeader } from "../components/TiendaHeader";
import { linkConsulta } from "../components/whatsapp";

/**
 * Ficha pública de la vidriera (T5, S2), como `web/producto.html`: galería con
 * miniaturas, título en Fraunces, precio destacado, detalles públicos, aviso de
 * estado y el CTA de WhatsApp (L4). No publicado, borrado o inexistente dan el
 * mismo 404: la action no distingue el motivo.
 */
export const dynamic = "force-dynamic";

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
  const detalles = [
    item.categoria ? `Categoría: ${item.categoria}` : null,
    item.condicion,
    item.detalleCondicion,
    item.talles.length > 0 ? `Talles: ${item.talles.join(", ")}` : null,
  ].filter((detalle): detalle is string => Boolean(detalle));

  return (
    <>
      <TiendaHeader />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-10 md:px-10">
        <nav aria-label="Ruta" className="py-2 text-[13px] text-ink-muted">
          <Link
            href="/polkalinas/catalogo"
            className="inline-flex min-h-11 items-center text-ink-muted hover:text-ink"
          >
            ← Volver al catálogo
          </Link>
        </nav>

        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <GaleriaFotos fotos={item.fotos} nombre={item.name} />

          <div className="flex min-w-0 flex-col gap-4">
            <h1 className="font-display text-[26px] leading-tight text-ink md:text-[40px]">
              {item.name}
            </h1>
            <p className="text-[13px] tabular-nums text-ink-muted">{item.code}</p>
            <p className="font-display text-2xl italic tabular-nums text-ink">
              $ {formatPrice(item.price)}
            </p>
            <EstadoVidrieraBadge estado={item.estado} className="max-w-48" />

            {detalles.length > 0 && (
              <ul className="flex flex-col text-[15px] text-ink-muted">
                {detalles.map((detalle) => (
                  <li key={detalle} className="border-t border-hairline py-2.5">
                    {detalle}
                  </li>
                ))}
              </ul>
            )}

            <a
              href={linkConsulta(item.name, item.code)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-accent bg-accent px-5 text-[15px] font-semibold text-background hover:bg-danger focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-hidden md:w-auto"
            >
              <svg
                aria-hidden="true"
                className="size-4.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 5h16v11H9l-5 4V5z" />
              </svg>
              Consultar por WhatsApp
            </a>
          </div>
        </div>
      </main>

      <TiendaFooter />
    </>
  );
}
