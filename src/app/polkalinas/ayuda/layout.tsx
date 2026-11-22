import type { ReactNode } from "react";

import { IndiceAyuda } from "../components/ayuda/IndiceAyuda";
import { TiendaFooter, TiendaHeader } from "../components/TiendaHeader";

/**
 * Chrome de las páginas de ayuda (`/polkalinas/ayuda/…`): el header y el footer
 * de la tienda y, al costado, el índice compartido.
 */
export default function AyudaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TiendaHeader />
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 py-8 md:grid-cols-[220px_1fr] md:px-10 md:py-12">
        <IndiceAyuda />
        <main className="min-w-0">{children}</main>
      </div>
      <TiendaFooter />
    </>
  );
}
