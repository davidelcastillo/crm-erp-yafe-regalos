import { getCustomers } from "../actions/customer";
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
