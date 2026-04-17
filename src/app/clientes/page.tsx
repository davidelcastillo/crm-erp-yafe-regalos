import { getCustomers, getCustomerById } from "../actions/customer";
import { ClientesList } from "./components/ClientesList";
import { Customer } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const result = await getCustomers();
  const customers: Customer[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-white z-40 px-6 pt-6 pb-4 shadow-sm">
        <h1 className="text-2xl font-bold text-[#222222]">Clientes</h1>
        <p className="text-sm text-[#6a6a6a] mt-1">Gestión y seguimiento de deudas</p>
      </header>

      {/* Clientes List */}
      <main className="px-6">
        <ClientesList initialCustomers={customers} />
      </main>
    </div>
  );
}