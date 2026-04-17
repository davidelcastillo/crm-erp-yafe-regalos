"use client";

import { useState, useMemo } from "react";
import { Customer } from "@prisma/client";
import { createCustomer } from "@/app/actions/customer";
import { ClienteCard } from "./ClienteCard";
import { AddClienteButton } from "./AddClienteButton";

interface ClientesListProps {
  initialCustomers: Customer[];
}

export function ClientesList({ initialCustomers }: ClientesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

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

  const refreshCustomers = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por nombre o apellido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-[#222222]">{stats.total}</div>
          <div className="text-xs text-[#6a6a6a]">Clientes</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-[#f59e0b]">{stats.withDebt}</div>
          <div className="text-xs text-[#6a6a6a]">Con deuda</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-[#ef4444]">
            ${stats.totalDebt.toFixed(0)}
          </div>
          <div className="text-xs text-[#6a6a6a]">Total</div>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-[#6a6a6a]">
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

      {/* FAB */}
      <AddClienteButton onAdd={refreshCustomers} />
    </div>
  );
}