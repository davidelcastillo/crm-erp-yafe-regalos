/**
 * Logo de la marca (mockup `web/index.html:208`): la frutilla con sus tres
 * lunares, la corona de hojas y el wordmark «Polkalina's». El SVG es
 * decorativo; el nombre accesible lo pone el link que lo envuelve.
 *
 * El color va por clases del tema (nunca por hex): la fruta es el frutilla de
 * siempre, los lunares son la crema del fondo y la corona cambia según dónde
 * se apoye el logo — cacao sobre crema, rosa sobre el footer.
 */
const CORONA = {
  cacao: "fill-ink",
  rosa: "fill-accent-soft",
} as const;

const LUNARES = [
  { cx: 38, cy: 54 },
  { cx: 62, cy: 54 },
  { cx: 50, cy: 74 },
];

export function Marca({
  size = 39,
  corona = "cacao",
}: {
  size?: number;
  corona?: keyof typeof CORONA;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="M50 94 C30 86 14 64 16 46 C18 32 32 28 50 33 C68 28 82 32 84 46 C86 64 70 86 50 94 Z"
          className="fill-accent"
        />
        <path
          d="M50 36 C44 30 34 30 28 33 C34 26 42 24 47 26 C46 20 48 14 50 10 C52 14 54 20 53 26 C58 24 66 26 72 33 C66 30 56 30 50 36 Z"
          className={CORONA[corona]}
        />
        {LUNARES.map((lunar) => (
          <circle key={lunar.cy} cx={lunar.cx} cy={lunar.cy} r="6" className="fill-background" />
        ))}
      </svg>
      {/* El wordmark del mockup mide ~0,77 del SVG (39/30, 44/34, 31/24). */}
      <b className="font-display leading-none italic" style={{ fontSize: Math.round(size * 0.77) }}>
        {"Polkalina's"}
      </b>
    </span>
  );
}
