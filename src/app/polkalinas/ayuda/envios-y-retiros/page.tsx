import { LinkWhatsApp, PaginaAyuda, Seccion } from "../../components/ayuda/PaginaAyuda";

/**
 * Envíos y retiros: lo que ya sabemos (Salta, envíos a todo el país) y los
 * datos que el dueño completará después, marcados con TODO.
 */
export default function EnviosYRetirosPage() {
  return (
    <PaginaAyuda titulo="Envíos y retiros">
      <p>Enviamos a todo el país desde Salta. El retiro en el local se coordina por WhatsApp.</p>

      <Seccion titulo="Retiro en Salta">
        <p>
          Coordinamos día y horario por WhatsApp y pasás a buscar tu pedido. Si es un regalo, no
          hace falta que avisemos qué es.
        </p>
        {/* TODO: el dueño todavía no pasó la dirección del punto físico. */}
        <p className="text-ink-muted">Punto de retiro: [DIRECCIÓN]</p>
        {/* TODO: el dueño todavía no pasó los horarios del local. */}
        <p className="text-ink-muted">Horario: [HORARIO]</p>
      </Seccion>

      <Seccion titulo="Envíos al resto del país">
        <p>
          Despachamos por correo o transporte una vez acreditado el pago. Te pasamos el seguimiento
          y el comprobante del envío.
        </p>
        {/* TODO: el dueño todavía no pasó el medio de envío, el costo ni la demora. */}
        <p className="text-ink-muted">Medio de envío: [CORREO O TRANSPORTE]</p>
        <p className="text-ink-muted">Costo: [COSTO DE ENVÍO] · Demora: [DEMORA]</p>
        <p>
          El costo del envío depende de la ciudad y del peso del paquete, así que lo confirmamos
          antes de que pagues.
        </p>
      </Seccion>

      <LinkWhatsApp>Consultar el envío a mi ciudad</LinkWhatsApp>
    </PaginaAyuda>
  );
}
