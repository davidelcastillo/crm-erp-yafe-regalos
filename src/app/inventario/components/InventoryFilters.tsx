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
    <div className="space-y-4">
      <div className="relative">
        <svg className="w-5 h-5 text-[#6a6a6a] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full min-h-[44px] pl-12 pr-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#929292] focus:outline-none focus:ring-2 focus:ring-[#ff385c]/20 touch-manipulation"
          aria-label="Buscar producto"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categoría
        </label>
        <select
          value={selectedCategoryId ?? ''}
          onChange={handleCategoryChange}
          className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
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