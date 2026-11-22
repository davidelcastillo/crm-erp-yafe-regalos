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
          Coordinamos día y horario por WhatsApp y pasás a buscar tu pedido en PUNTO ROSA. Si es un regalo, no
          hace falta que avisemos qué es.
        </p>
        {/* TODO: el dueño todavía no pasó la dirección del punto físico. */}
        <p className="text-ink-muted">Punto de retiro: Punto Rosa · BALCARCE 39 - GALERIA AUGUSTO - Salta, Argentina</p>
         <p className="text-ink-muted">Horario: LUNES A VIERNES DE 9.30 A 21.00 HS
SABADOS DE 9.30 A 13 Y DE 17 A 21 HS</p>
        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d739.7929004250219!2d-65.41286406097475!3d-24.78913647728497!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x941bc3bb3b179b31%3A0xe5c0e3a24208f2e1!2sGaler%C3%ADa%20Augusto!5e0!3m2!1ses-419!2sar!4v1795291301029!5m2!1ses-419!2sar" title="Ubicación del punto de retiro en el mapa" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-[300px] w-full rounded-xl border-0 md:h-[450px]" />
        {/* TODO: el dueño todavía no pasó los horarios del local. */}
       
      </Seccion>

      <Seccion titulo="Envíos al resto del país">
        <p>
          Despachamos por Andreani una vez acreditado el pago. Te pasamos el seguimiento
          y el comprobante del envío.
        </p>
        {/* TODO: el dueño todavía no pasó el medio de envío, el costo ni la demora. */}
        <p className="text-ink-muted">Medio de envío: Andreani</p>
        <p className="text-ink-muted">Costo: $3.500 + envío - Compras de más de $50.000 solo se cobra el envío</p>
        <p>
          El costo del envío depende de la ciudad y del peso del paquete, así que lo confirmamos
          antes de que pagues.
        </p>
        <p className="text-ink-muted">Despacho: El despacho se realiza a comienzo de mes.</p>
      </Seccion>

      <LinkWhatsApp>Consultar el envío a mi ciudad</LinkWhatsApp>
    </PaginaAyuda>
  );
}
