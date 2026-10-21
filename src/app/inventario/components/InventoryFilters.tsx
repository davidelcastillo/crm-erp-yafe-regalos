import type { ChangeEvent } from 'react';

export interface InventoryFiltersProps {
  categories: Array<{ id: number; name: string }>;
  selectedCategoryId: number | null;
  onFilterChange: (categoryId: number | null) => void;
  search: string;
  onSearchChange: (search: string) => void;
  sortBy: InventorySortOption;
  onSortChange: (sortBy: InventorySortOption) => void;
}

/**
 * Opciones de orden de las listas de inventario. Nombres y valores en un solo
 * lugar: el `<select>` de la página y el ordenamiento de `InventarioList` no
 * pueden desincronizarse.
 */
export const INVENTORY_SORT_OPTIONS = [
  { value: 'code', label: 'Código' },
  { value: 'updated', label: 'Última modificación' },
  { value: 'name', label: 'Por nombre' },
  { value: 'stock-asc', label: 'Stock: menor a mayor' },
  { value: 'stock-desc', label: 'Stock: mayor a menor' },
] as const;

export type InventorySortOption = (typeof INVENTORY_SORT_OPTIONS)[number]['value'];

export const InventoryFilters = ({
  categories,
  selectedCategoryId,
  onFilterChange,
  search,
  onSearchChange,
  sortBy,
  onSortChange,
}: InventoryFiltersProps) => {
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
      {/* Categoría y orden comparten contenedor y control (`.field-select`): en
          celular van apilados a lo ancho y desde `sm` en dos columnas iguales. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="inventario-categoria" className="field-label">
            Categoría
          </label>
          <select
            id="inventario-categoria"
            value={selectedCategoryId ?? ''}
            onChange={handleCategoryChange}
            className="field-select"
          >
            <option value="">Todas las categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="inventario-orden" className="field-label">
            Ordenar por
          </label>
          <select
            id="inventario-orden"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as InventorySortOption)}
            className="field-select"
          >
            {INVENTORY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
