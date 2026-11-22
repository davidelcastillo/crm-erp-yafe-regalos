import Link from "next/link";

/**
 * Índice de las páginas de ayuda, compartido por todo `/polkalinas/ayuda/…`.
 * Es la misma lista que la columna «Ayuda» del footer.
 */
export const AYUDA = [
  { etiqueta: "Cómo comprar", href: "/polkalinas/ayuda/como-comprar" },
  { etiqueta: "Envíos y retiros", href: "/polkalinas/ayuda/envios-y-retiros" },
  { etiqueta: "Medios de pago", href: "/polkalinas/ayuda/medios-de-pago" },
];

export function IndiceAyuda() {
  return (
    <nav aria-label="Índice de ayuda" className="min-w-0">
      <h2 className="text-[13px] font-semibold tracking-[.12em] text-ink-muted uppercase">Ayuda</h2>
      <ul className="mt-3 flex flex-col gap-1">
        {AYUDA.map((opcion) => (
          <li key={opcion.href}>
            <Link
              href={opcion.href}
              className="inline-flex min-h-11 items-center text-[15px] text-ink hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
            >
              {opcion.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
