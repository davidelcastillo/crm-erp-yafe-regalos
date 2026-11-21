import { LinkWhatsApp, PaginaAyuda, Seccion } from "../../components/ayuda/PaginaAyuda";

/**
 * Cambios: la política concreta la define el dueño (plazo y condiciones), por
 * eso queda marcada con TODO en lugar de inventada.
 */
export default function CambiosPage() {
  return (
    <PaginaAyuda titulo="Cambios">
      <p>
        Queremos que te quede bien. Si algo no era lo que esperabas, escribinos por WhatsApp y lo
        resolvemos.
      </p>

      <Seccion titulo="Plazo">
        {/* TODO: el dueño todavía no definió el plazo para pedir un cambio. */}
        <p className="text-ink-muted">Plazo para pedir un cambio: [PLAZO]</p>
        <p>Contamos el plazo desde el día en que recibís el pedido.</p>
      </Seccion>

      <Seccion titulo="Condiciones">
        {/* TODO: el dueño todavía no confirmó las condiciones (por falla, por talle, etc.). */}
        <p className="text-ink-muted">Condiciones: [CONDICIONES DE CAMBIO]</p>
        <p>
          La prenda tiene que estar sin uso, sin lavar y como te la enviamos. Como es única, el
          cambio suele ser por otra prenda del mismo valor o por el saldo a favor.
        </p>
      </Seccion>

      <Seccion titulo="Cómo lo coordinamos">
        <p>
          Escribinos con el código de la prenda y una foto. Coordinamos el retiro en Salta o el
          envío, y el costo del envío del cambio lo confirmamos en ese momento.
        </p>
      </Seccion>

      <LinkWhatsApp>Pedir un cambio</LinkWhatsApp>
    </PaginaAyuda>
  );
}
