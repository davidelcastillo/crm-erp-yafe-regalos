import type { ChangeEvent } from 'react';

export interface InventoryFiltersProps {
  categories: Array<{ id: number; name: string }>;
  selectedCategoryId: number | null;
  onFilterChange: (categoryId: number | null) => void;
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
  sortBy,
  onSortChange,
}: InventoryFiltersProps) => {
  const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFilterChange(val === '' ? null : Number(val));
  };

  return (
    <div className="space-y-3">
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
