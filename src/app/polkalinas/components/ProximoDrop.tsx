import { LUNARES } from "./ProductoCard";
import { WHATSAPP_VIDRIERA } from "./whatsapp";

/**
 * Banner del próximo drop (`section.banner` de `web/index.html`): franja rosa
 * con lunares a todo el ancho, la tarjeta crema con la invitación a la lista de
 * difusión por WhatsApp y tres fotos publicadas a la derecha (lunares si no hay).
 *
 * TODO: el dueño todavía no pasó el día y la hora del drop; el kicker los espera.
 */
export function ProximoDrop({ fotos }: { fotos: string[] }) {
  return (
    <section
      className="mt-11 bg-accent-soft md:mt-[72px]"
      style={LUNARES("rosa")}
      aria-labelledby="proximo-drop"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-stretch gap-6 px-4 py-12 md:flex-row md:items-center md:px-10">
        <div className="flex flex-1 flex-col items-start gap-3.5 rounded-[22px] bg-background p-7">
          <p className="text-[13px] font-semibold tracking-[.18em] text-accent uppercase">
            Próximo drop
          </p>
          <h2
            id="proximo-drop"
            className="font-display text-[30px] leading-tight text-ink md:text-[40px]"
          >
            Las prendas únicas <span className="italic">vuelan.</span>
          </h2>
          <p className="max-w-[46ch] text-[15px] text-ink">
            Sumate a la lista de difusión y te avisamos por WhatsApp antes que nadie.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_VIDRIERA}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-ink bg-ink px-6 text-[15px] font-semibold text-background hover:bg-accent hover:border-accent focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-hidden"
          >
            Avisame del próximo drop
          </a>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2.5 self-stretch">
          {[0, 1, 2].map((indice) =>
            fotos[indice] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={indice}
                src={fotos[indice]}
                alt=""
                className="aspect-[3/4] w-full rounded-[14px] object-cover"
              />
            ) : (
              <div
                key={indice}
                aria-hidden="true"
                style={LUNARES("crema")}
                className="aspect-[3/4] w-full rounded-[14px] bg-background"
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}
