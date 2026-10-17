"use client";

import { useMemo, useState } from "react";
import { Customer } from "@prisma/client";
import { ClienteCard } from "./ClienteCard";

interface ClientesListProps {
  initialCustomers: Customer[];
}

export function ClientesList({ initialCustomers }: ClientesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [customers] = useState<Customer[]>(initialCustomers);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.surname.toLowerCase().includes(term)
    );
  }, [customers, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = customers.length;
    const withDebt = customers.filter((c) => Number(c.totalBalance) > 0).length;
    const totalDebt = customers.reduce(
      (sum, c) => sum + Number(c.totalBalance),
      0
    );
    return { total, withDebt, totalDebt };
  }, [customers]);

  return (
    <div className="flex flex-col gap-4">
      {/* Buscador: mismo patrón que los filtros de inventario. */}
      <div className="glass rounded-2xl border border-black/5 p-4">
        <input
          type="text"
          placeholder="Buscar por nombre o apellido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          /* 16px de fuente: por debajo de eso iOS hace zoom al enfocar el input. */
          className="w-full min-h-[44px] px-4 py-2.5 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#929292] focus:outline-none focus:ring-2 focus:ring-[#ec4899]/30 touch-manipulation"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          <div className="text-xl font-bold text-[#222222]">{stats.total}</div>
          <div className="text-xs text-[#6a6a6a]">Clientes</div>
        </div>
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          <div className="text-xl font-bold text-[#b45309]">{stats.withDebt}</div>
          <div className="text-xs text-[#6a6a6a]">Con deuda</div>
        </div>
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          <div className="text-xl font-bold text-[#b91c1c]">
            ${stats.totalDebt.toFixed(0)}
          </div>
          <div className="text-xs text-[#6a6a6a]">Total</div>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredCustomers.length === 0 ? (
          <div className="glass rounded-2xl border border-black/5 text-center py-8 text-[#6a6a6a]">
            {searchTerm
              ? "No se encontraron clientes"
              : "No hay clientes aún. Toca + para agregar uno."}
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <ClienteCard key={customer.id} customer={customer} />
          ))
        )}
      </div>
    </div>
  );
}