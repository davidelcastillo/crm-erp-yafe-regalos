import { LinkWhatsApp, PaginaAyuda, Seccion } from "../../components/ayuda/PaginaAyuda";

/**
 * Guía de talles: cada prenda es única, así que el talle de la ficha manda. No
 * inventamos medidas: el dueño las completa (TODO).
 */
const MEDIDAS = [
  { titulo: "Pecho", texto: "De axila a axila, con la prenda apoyada y sin estirar." },
  { titulo: "Cintura", texto: "En la parte más angosta, de costura a costura." },
  { titulo: "Cadera", texto: "En la parte más ancha, unos 20 cm debajo de la cintura." },
  { titulo: "Largo total", texto: "Desde el hombro hasta el ruedo." },
];

export default function GuiaDeTallesPage() {
  return (
    <PaginaAyuda titulo="Guía de talles">
      <p>
        Cada prenda es única: el talle que ves en la ficha es el que tiene esa prenda. El talle de
        la etiqueta no siempre coincide con el talle real, así que ante la duda pedinos las medidas
        y las tomamos a mano.
      </p>

      <Seccion titulo="Cómo tomamos las medidas">
        <ul className="flex flex-col gap-2">
          {MEDIDAS.map((medida) => (
            <li key={medida.titulo}>
              <strong className="text-ink">{medida.titulo}</strong> · {medida.texto}
            </li>
          ))}
          <li>Allí donde diga «elástico» o «suelto», lo aclaramos en la ficha.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Equivalencias de talles">
        <p>
          Las prendas vienen de marcas y épocas distintas, por eso no publicamos una tabla fija:
          preferimos pasarte las medidas reales de la prenda que te gusta.
        </p>
        {/* TODO: si el dueño quiere, acá va su tabla de equivalencias S/M/L y 36/38/40. */}
        <p className="text-ink-muted">Tabla de equivalencias: [TABLA DE TALLES]</p>
      </Seccion>

      <LinkWhatsApp>Pedir las medidas de una prenda</LinkWhatsApp>
    </PaginaAyuda>
  );
}
