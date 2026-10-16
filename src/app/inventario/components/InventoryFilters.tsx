import type { ChangeEvent } from 'react';

export interface InventoryFiltersProps {
  categories: Array<{ id: number; name: string }>;
  selectedCategoryId: number | null;
  onFilterChange: (categoryId: number | null) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export const InventoryFilters = ({ categories, selectedCategoryId, onFilterChange, search, onSearchChange }: InventoryFiltersProps) => {
  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFilterChange(val === '' ? null : Number(val));
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg className="w-5 h-5 text-[#6a6a6a] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          /* 16px de fuente: por debajo de eso iOS hace zoom al enfocar el input. */
          className="w-full min-h-[44px] pl-11 pr-4 py-2.5 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#929292] focus:outline-none focus:ring-2 focus:ring-[#ec4899]/30 touch-manipulation"
          aria-label="Buscar producto"
          autoComplete="off"
        />
      </div>
      <div>
        {/* En celular la etiqueta no aporta y suma altura; el select se nombra por aria-label. */}
        <label htmlFor="inventario-categoria" className="hidden text-sm font-medium text-gray-700 mb-1 sm:block">
          Categoría
        </label>
        <select
          id="inventario-categoria"
          value={selectedCategoryId ?? ''}
          onChange={handleCategoryChange}
          aria-label="Categoría"
          className="block w-full min-h-[44px] rounded-xl border-0 bg-[#f8f8f8] py-2.5 pl-3 pr-10 text-base text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#ec4899]/30 sm:text-sm"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};