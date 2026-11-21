/**
 * Franja «piano» del kit de marca (mockup `web/catalogo.html`): 14 teclas
 * blancas y 10 negras superpuestas, hechas con divs en vez de un asset. Es
 * decorativa: no lleva información, foco ni nombre accesible.
 */
const NEGRAS = [5, 12.2, 26.5, 33.6, 40.8, 55, 62.2, 76.5, 83.6, 90.8];
const BLANCAS = 14;

export function Piano({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="franja-piano"
      className={`relative flex h-6 border-y-[1.5px] border-ink bg-background md:h-[34px] ${className}`}
    >
      {Array.from({ length: BLANCAS }, (_, tecla) => (
        <span
          key={tecla}
          className={`flex-1 ${
            tecla < BLANCAS - 1 ? "border-r-[1.5px] border-ink" : ""
          }`}
        />
      ))}
      {NEGRAS.map((izquierda) => (
        <i
          key={izquierda}
          style={{ left: `${izquierda}%` }}
          className="absolute top-0 h-[60%] w-[4.2%] bg-ink"
        />
      ))}
    </div>
  );
}
