"use client";

import { FilterSelect } from '@/components/ui/FilterSelect';

export interface InventoryFiltersProps {
  categories: Array<{ id: number; name: string }>;
  selectedCategoryId: number | null;
  onFilterChange: (categoryId: number | null) => void;
  /** Tipo de ítem: las prendas se catalogan aparte de los productos. */
  itemKind?: InventoryItemKind;
  onItemKindChange?: (itemKind: InventoryItemKind) => void;
  sortBy: InventorySortOption;
  onSortChange: (sortBy: InventorySortOption) => void;
}

/** Opciones del filtro de tipo; el valor es `Product.kind` salvo «todos». */
export const INVENTORY_KIND_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'prenda', label: 'Prendas' },
  { value: 'product', label: 'Productos' },
] as const;

export type InventoryItemKind = (typeof INVENTORY_KIND_OPTIONS)[number]['value'];

/**
 * Opciones de orden de las listas de inventario. Nombres y valores en un solo
 * lugar: el filtro de la página y el ordenamiento de `InventarioList` no
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

/** Valor del filtro de categoría que significa «sin filtrar». */
const TODAS = '';

export const InventoryFilters = ({
  categories,
  selectedCategoryId,
  onFilterChange,
  itemKind = 'all',
  onItemKindChange = () => {},
  sortBy,
  onSortChange,
}: InventoryFiltersProps) => {
  // Sin categorías de prenda no hay nada que elegir: se oculta el selector.
  const hideCategory = itemKind === 'prenda' && categories.length === 0;

  return (
    <div className="space-y-3">
      {/* Tipo, categoría y orden comparten contenedor y control (`FilterSelect`):
          en celular van apilados a lo ancho y desde `sm` en dos columnas. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="field-label">Tipo</span>
          <FilterSelect
            label="Tipo"
            value={itemKind}
            options={[...INVENTORY_KIND_OPTIONS]}
            onChange={(value) => onItemKindChange(value as InventoryItemKind)}
          />
        </div>
        {!hideCategory && (
          <div>
            <span className="field-label">Categoría</span>
            <FilterSelect
              label="Categoría"
              value={selectedCategoryId === null ? TODAS : String(selectedCategoryId)}
              options={[
                { value: TODAS, label: 'Todas las categorías' },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
              onChange={(value) => onFilterChange(value === TODAS ? null : Number(value))}
            />
          </div>
        )}
        <div>
          <span className="field-label">Ordenar por</span>
          <FilterSelect
            label="Ordenar por"
            value={sortBy}
            options={[...INVENTORY_SORT_OPTIONS]}
            onChange={(value) => onSortChange(value as InventorySortOption)}
          />
        </div>
      </div>
    </div>
  );
};
