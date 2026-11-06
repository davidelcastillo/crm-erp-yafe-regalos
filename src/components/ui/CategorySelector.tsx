// src/components/ui/CategorySelector.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  getCategoryOptions,
  createCategory,
} from "@/app/actions/category";

export interface CategoryOption {
  id: number;
  name: string;
}

export interface CategorySelectorProps {
  /** Currently selected category id. null/undefined = none. */
  selectedId?: number | null;
  /** Called whenever the selection changes. Receives null when cleared. */
  onValueChange?: (id: number | null) => void;
  /** Optional label rendered above the dropdown. */
  label?: string;
  /** Disable the whole control. */
  disabled?: boolean;
  /**
   * Legacy alias for `onValueChange`. Kept for backward compatibility with
   * any caller still using the old prop name.
   */
  onChange?: (id: number | null) => void;
  /**
   * Lista de categorías inyectada por el padre. Si viene, el componente NO pide
   * la lista (`getCategoryOptions` no se llama) y el padre queda como única
   * fuente de verdad: sirve para poner una instancia por fila sin multiplicar
   * los viajes. Sin esta prop el comportamiento es el de siempre.
   */
  options?: CategoryOption[];
  /** Avisa la lista actualizada cuando este selector crea una categoría. */
  onOptionsChange?: (options: CategoryOption[]) => void;
  /** Id del disparador, para que el `<label htmlFor>` del padre lo apunte. */
  id?: string;
  /** Marca el disparador como inválido (`aria-invalid`). */
  invalid?: boolean;
  /** Ids de los mensajes de error del campo dueño (`aria-describedby`). */
  describedBy?: string;
}

/**
 * CategorySelector
 *
 * Reusable category dropdown with a "+ Nueva categoría" affordance that opens
 * a nested bottom-sheet modal and calls `createCategory`. After creation the new
 * category is auto-selected.
 *
 * Con `options` inyectadas no pide la lista y avisa la lista nueva con
 * `onOptionsChange`, así que N instancias (una por fila) comparten una sola
 * carga y el padre sigue siendo la fuente de verdad.
 *
 * Design tokens (Airbnb-inspired, see STYLE.md):
 *  - White canvas, ink (#222222) text, muted (#6a6a6a) helper.
 *  - Acento de marca (#ec4899) en la píldora «+ Nueva» y en la fila elegida (texto
 *    con el rosa de texto `text-brand-rosa-texto`, AA).
 *  - 44px minimum tap targets, full-width select on mobile.
 *  - Bottom-sheet (`rounded-t-3xl`) modal for creating a new category.
 */
export function CategorySelector({
  selectedId = null,
  label,
  disabled = false,
  onChange,
  onValueChange,
  options: opcionesInyectadas,
  onOptionsChange,
  id: triggerId,
  invalid = false,
  describedBy,
}: CategorySelectorProps) {
  const inyectadas = opcionesInyectadas !== undefined;
  const [cargadas, setCargadas] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(!inyectadas);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load category options once on mount (salvo que el padre inyecte la lista)
  useEffect(() => {
    if (inyectadas) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await getCategoryOptions();
        if (!cancelled && result.success && result.data) {
          setCargadas(result.data as CategoryOption[]);
        }
      } catch (err) {
        console.error("Error loading category options:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inyectadas]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const options = inyectadas ? opcionesInyectadas : cargadas;
  const selected = options.find((o) => o.id === selectedId) ?? null;
  const handleClick = (id: number | null) => {
    onChange?.(id);
    onValueChange?.(id);
    setOpen(false);
  };

  const handleCreateNew = async () => {
    setCreating(true);
    const modal = await Swal.fire({
      title: "Nueva categoría",
      input: "text",
      inputLabel: "Nombre",
      inputPlaceholder: "Ej: Limpieza, Alimentos…",
      inputAttributes: { maxlength: "100", autocapitalize: "on" },
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#6d28d9",
      cancelButtonColor: "#6a6a6a",
      inputValidator: (value) => {
        if (!value || !value.trim()) return "El nombre es requerido";
        if (value.length > 100) return "Máximo 100 caracteres";
        return null;
      },
    });

    if (!modal.isConfirmed) {
      setCreating(false);
      return;
    }

    const name = modal.value.trim();
    try {
      const result = await createCategory({ name });
      if (result.success && result.data) {
        const created = result.data as CategoryOption;
        const actualizadas = [...options, created].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        // Con la lista inyectada, el padre es la fuente de verdad (T10).
        if (inyectadas) onOptionsChange?.(actualizadas);
        else setCargadas(actualizadas);
        handleClick(created.id);
        await Swal.fire({
          title: "Categoría creada",
          text: `Se creó "${created.name}"`,
          icon: "success" as const,
          confirmButtonColor: "#6d28d9",
          confirmButtonText: "Aceptar",
        });
      } else {
        await Swal.fire({
          title: "Error",
          text: result.error ?? "No se pudo crear la categoría",
          icon: "error" as const,
          confirmButtonColor: "#dc2626",
          confirmButtonText: "Aceptar",
        });
      }
    } catch (err) {
      console.error("Error creating category from selector:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <span className="text-xs text-ink-muted font-medium">{label}</span>
      )}
      <div className="flex items-stretch gap-2 w-full">
        {/* El error del campo dueño se anuncia desde el disparador (T10); el rol
            del control sigue siendo `button` para no romper a sus consumidores. */}
        {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
        <button
          type="button"
          id={triggerId}
          disabled={disabled || loading}
          onClick={() => setOpen(!open)}
          className="flex-1 min-w-0 inline-flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] bg-surface-soft rounded-xl text-sm text-ink hover:bg-surface-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={describedBy}
        >
          <span className="truncate">
            {loading
              ? "Cargando…"
              : selected
                ? selected.name
                : "Seleccionar categoría"}
          </span>
          <svg
            className={`w-4 h-4 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          type="button"
          disabled={disabled || creating}
          onClick={handleCreateNew}
          className="btn btn-primary whitespace-nowrap shrink-0"
          aria-label="Crear nueva categoría"
        >
          {creating ? "Creando…" : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nueva categoría</span>
              <span className="sm:hidden">Nueva</span>
            </>
          )}
        </button>
      </div>

      {open && !loading && (
        <div
          className="absolute z-50 mt-1 bg-surface border border-hairline-soft rounded-xl shadow-lg max-h-60 overflow-y-auto min-w-[200px]"
          role="listbox"
        >
          <button
            type="button"
            onClick={() => handleClick(null)}
            className={`w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-surface-soft transition-colors ${
              selectedId === null ? "bg-accent/10 text-brand-rosa-texto font-medium" : "text-ink"
            }`}
            role="option"
            aria-selected={selectedId === null}
          >
            Sin categoría
          </button>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => handleClick(o.id)}
              className={`w-full text-left px-4 py-3 min-h-[44px] text-sm hover:bg-surface-soft transition-colors ${
                o.id === selectedId ? "bg-accent/10 text-brand-rosa-texto font-medium" : "text-ink"
              }`}
              role="option"
              aria-selected={o.id === selectedId}
            >
              {o.name}
            </button>
          ))}
          {options.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-muted">
              No hay categorías. Toca “Nueva categoría” para crear una.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CategorySelector;
