import { getCustomers } from "../actions/customer";
import Link from "next/link";
import { ClientesList } from "./components/ClientesList";
import { AddClienteButton } from "./components/AddClienteButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandBand } from "@/components/ui/BrandBand";
import { Customer } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const result = await getCustomers();
  const customers: Customer[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-surface pb-20">
      <main>
        {/* La página es un Server Component: la banda de movimiento vive en
            `BrandBand`, que es el único trozo cliente (S10/S11). */}
        <BrandBand header={<PageHeader title="Clientes" />} />

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {/* Vuelta a la lista de sucursales a la vista, con el mismo patrón que
              «Volver al inventario» de /inventario/control (S18, U3). */}
          <Link
            href="/sucursales"
            className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong touch-manipulation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a sucursal
          </Link>

          <ClientesList initialCustomers={customers} />
        </div>
      </main>

      {/* El FAB va fuera de la hoja de vidrio: `backdrop-filter` convierte a la hoja
          en el contenedor de los elementos `fixed`, y adentro quedaba a otra altura
          que en el resto de las páginas. */}
      <AddClienteButton />
    </div>
  );
}
