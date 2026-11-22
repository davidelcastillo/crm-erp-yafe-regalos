import { LinkWhatsApp, PaginaAyuda, Seccion } from "../../components/ayuda/PaginaAyuda";

/**
 * Cómo comprar: los mismos cuatro pasos de la home (`web/index.html#comprar`),
 * sin fecha de drop ni stock inventado. Se coordina todo por WhatsApp.
 */
const PASOS = [
  { titulo: "Elegí", texto: "Mirá el catálogo y quedate con la prenda o el producto que más te guste." },
  { titulo: "Escribinos", texto: "Se abre WhatsApp con tu consulta ya escrita." },
  { titulo: "Pagá", texto: "Transferencia o efectivo en el local." },
  { titulo: "Recibí", texto: "Retiro en Salta o envío a todo el país." },
];

export default function ComoComprarPage() {
  return (
    <PaginaAyuda titulo="Cómo comprar">
      <p>
        Comprar en {"Polkalina's"} es simple: elegís, nos escribís por WhatsApp y coordinamos el
        pago y la entrega. Cada prenda es única, así que si te gusta algo, escribinos.
      </p>

      <Seccion titulo="Los pasos">
        <ol className="flex flex-col gap-3">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo} className="flex items-start gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-display text-lg text-background italic">
                {indice + 1}
              </span>
              <span className="min-w-0">
                <strong className="block text-ink">{paso.titulo}</strong>
                {paso.texto}
              </span>
            </li>
          ))}
        </ol>
      </Seccion>

      <Seccion titulo="¿Dudas antes de comprar?">
        <p>
          Escribinos y te contamos todo: medidas, detalles de la prenda, cuánto sale el envío a tu
          ciudad o cómo reservarla.
        </p>
        {/* TODO: el dueño todavía no pasó el horario de atención por WhatsApp. */}
        <p className="text-ink-muted">Respondemos dentro del horario de atención comercial.</p>
        <LinkWhatsApp />
      </Seccion>
    </PaginaAyuda>
  );
}
