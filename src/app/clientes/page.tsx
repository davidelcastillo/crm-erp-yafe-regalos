import { getCustomers, getCustomerById } from "../actions/customer";
import { ClientesList } from "./components/ClientesList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Customer } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const result = await getCustomers();
  const customers: Customer[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-white pb-20">
      <main>
        <div className="pb-16 brand-gradient">
          <PageHeader title="Clientes" />
        </div>

        <div className="glass border-t border-white/80 rounded-t-[2.5rem] -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <ClientesList initialCustomers={customers} />
        </div>
      </main>
    </div>
  );
}
