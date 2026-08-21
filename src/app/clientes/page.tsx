import { getCustomers, getCustomerById } from "../actions/customer";
import { ClientesList } from "./components/ClientesList";
import { Customer } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const result = await getCustomers();
  const customers: Customer[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-[#ffffff] pb-20">
      {/* Clientes List */}
      <main className="px-6">
        <ClientesList initialCustomers={customers} />
      </main>
    </div>
  );
}