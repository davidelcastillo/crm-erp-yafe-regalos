"use client";

import { useMemo, useState } from "react";
import { Customer } from "@prisma/client";
import { ClienteCard } from "./ClienteCard";
import { Reveal } from "@/components/ui/Reveal";

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
      {/* Buscador con su propia tarjeta de vidrio, antes de las cards: el estado
          de la búsqueda vive acá porque /clientes es un Server Component, así que
          no se puede subir a la banda sin volverlo cliente (S16). */}
      <div className="mb-4 rounded-2xl glass-strong px-4 py-3">
        <div className="relative w-full">
          <svg
            className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o apellido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            /* 16px de fuente: por debajo de eso iOS hace zoom al enfocar el input. */
            className="w-full min-h-[44px] pl-12 pr-4 py-3 bg-surface-soft rounded-xl text-base text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-[#ec4899]/30 touch-manipulation"
            aria-label="Buscar por nombre o apellido"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          <div className="text-xl font-bold text-ink">{stats.total}</div>
          <div className="text-xs text-ink-muted">Clientes</div>
        </div>
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          <div className="text-xl font-bold text-[#b45309]">{stats.withDebt}</div>
          <div className="text-xs text-ink-muted">Con deuda</div>
        </div>
        <div className="glass rounded-xl border border-black/5 p-3 text-center">
          <div className="text-xl font-bold text-[#b91c1c]">
            ${stats.totalDebt.toFixed(0)}
          </div>
          <div className="text-xs text-ink-muted">Total</div>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredCustomers.length === 0 ? (
          <div className="glass rounded-2xl border border-black/5 text-center py-8 text-ink-muted">
            {searchTerm
              ? "No se encontraron clientes"
              : "No hay clientes aún. Toca + para agregar uno."}
          </div>
        ) : (
          filteredCustomers.map((customer, index) => (
            <Reveal key={customer.id} index={index}>
              <ClienteCard customer={customer} />
            </Reveal>
          ))
        )}
      </div>
    </div>
  );
}