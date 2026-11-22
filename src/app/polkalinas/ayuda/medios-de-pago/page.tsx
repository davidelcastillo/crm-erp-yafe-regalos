import { LinkWhatsApp, PaginaAyuda, Seccion } from "../../components/ayuda/PaginaAyuda";

/**
 * Medios de pago: transferencia, Mercado Pago y efectivo en el local, los tres
 * del mockup. El alias y la seña los completa el dueño (TODO).
 */
export default function MediosDePagoPage() {
  return (
    <PaginaAyuda titulo="Medios de pago">
      <p>
        Se paga al confirmar el pedido. Estos son los medios que aceptamos, y si te queda alguna
        duda lo hablamos por WhatsApp.
      </p>

      <Seccion titulo="Transferencia bancaria">
        <p>Te pasamos los datos por WhatsApp cuando confirmás qué querés llevar.</p>
        {/* TODO: el dueño todavía no pasó el alias o CBU de la cuenta. */}
        <p className="text-ink-muted">Alias / CBU: Consultar por Whatsapp</p>
        <p>El pedido queda reservado cuando la transferencia aparece acreditada.</p>
      </Seccion>

      <Seccion titulo="Mercado Pago">
        <p>
          Transferencia o Generamos un link de pago y lo pagás desde la app o la web, con tarjeta o con el saldo de
          tu cuenta.
        </p>
      </Seccion>

      <Seccion titulo="Efectivo en el local">
        <p>
          Si retirás en Salta, podés pagar en efectivo al buscar el pedido en Punto Rosa. Coordinamos antes el día
          y el horario.
        </p>
      </Seccion>

      <Seccion titulo="Seña para reservar">
        {/* TODO: el dueño todavía no definió si pide seña ni de cuánto. */}
        <p className="text-ink-muted">Seña: Es del 50% a menos que sean ofertas! Las ofertas se pagan completamente.</p>
        <p>
          Las prendas son únicas y se reservan con la seña acordada, que se descuenta del total.
        </p>
      </Seccion>

      <LinkWhatsApp />
    </PaginaAyuda>
  );
}
