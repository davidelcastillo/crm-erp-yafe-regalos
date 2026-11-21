import Link from "next/link";
import { notFound } from "next/navigation";

import { getVidrieraItem } from "@/app/actions/vidriera";
import { formatPrice } from "@/lib/label-layout";
import { EstadoVidrieraBadge } from "../components/EstadoVidrieraBadge";
import { GaleriaFotos } from "../components/GaleriaFotos";
import { linkConsulta } from "../components/whatsapp";

/**
 * Ficha pública de la vidriera (T5, S2): galería, datos públicos, estado y el
 * botón de consulta por WhatsApp (L4). No publicado, borrado o inexistente dan
 * el mismo 404: la action no distingue el motivo.
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
    <main className="min-h-screen bg-background pb-10">
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Link
          href="/polkalinas"
          className="inline-flex min-h-11 items-center rounded-full border border-hairline bg-surface px-4 text-sm font-semibold text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
        >
          ← Volver
        </Link>
        <p className="font-display text-xl leading-none text-ink">{"Polkalina's"}</p>
      </header>

      <div className="grid gap-6 px-4 md:grid-cols-2 md:gap-10">
        <GaleriaFotos fotos={item.fotos} nombre={item.name} />

        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-display text-[26px] leading-tight text-ink md:text-[34px]">
            {item.name}
          </h1>
          <p className="text-[13px] tabular-nums text-ink-muted">{item.code}</p>
          <p className="font-display text-2xl italic tabular-nums text-ink">
            $ {formatPrice(item.price)}
          </p>
          <EstadoVidrieraBadge estado={item.estado} className="max-w-48" />

          {detalles.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1 text-[15px] text-ink-muted">
              {detalles.map((detalle) => (
                <li key={detalle}>{detalle}</li>
              ))}
            </ul>
          )}

          <a
            href={linkConsulta(item.name, item.code)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border-2 border-accent bg-accent px-5 text-[15px] font-semibold text-background hover:bg-danger focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-hidden"
          >
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
