// src/components/ui/CategoriasPicker.tsx
"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { createCategory } from "@/app/actions/category";
import type { CategoryOption } from "./CategorySelector";

export interface CategoriasPickerProps {
  /** Lista compartida de categorías: el padre es la fuente de verdad. */
  options: CategoryOption[];
  /** Avisa la lista actualizada cuando este picker crea una categoría. */
  onOptionsChange: (options: CategoryOption[]) => void;
  /** Ids elegidos por el dueño del picker (varias, todas equivalentes). */
  selected: number[];
  onToggle: (id: number) => void;
  /** Se llama con el id recién creado para que el dueño lo marque. */
  onCreated: (id: number) => void;
  /** Pills más ajustadas: una card del lote. */
  compact?: boolean;
  disabled?: boolean;
  /** Id del grupo: el padre lo enfoca cuando el campo tiene error. */
  id?: string;
  /** Texto que nombra el grupo (`aria-labelledby`). */
  labelledBy?: string;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * CategoriasPicker
 *
 * Las categorías del producto como pills múltiples (pedido del dueño: un
 * producto puede tener varias y todas son equivalentes), con «＋ Nueva
 * categoría» al lado: mismo diálogo y misma action (`createCategory`) que
 * `CategorySelector`, sin su selección única. La lista la inyecta el padre, así
 * el alta individual y cada fila del lote comparten una sola carga y el padre
 * decide a quién seleccionar la recién creada.
 */
export function CategoriasPicker({
  options,
  onOptionsChange,
  selected,
  onToggle,
  onCreated,
  compact = false,
  disabled = false,
  id,
  labelledBy,
  invalid = false,
  describedBy,
}: CategoriasPickerProps) {
  const [creando, setCreando] = useState(false);

  const crearCategoria = async () => {
    setCreando(true);
    const modal = await Swal.fire({
      title: "Nueva categoría",
      input: "text",
      inputLabel: "Nombre",
      inputPlaceholder: "Ej: Limpieza, Alimentos…",
      inputAttributes: { maxlength: "100", autocapitalize: "on" },
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "var(--palette-brand-action)",
      cancelButtonColor: "var(--palette-secondary-gray)",
      inputValidator: (value) => {
        if (!value || !value.trim()) return "El nombre es requerido";
        if (value.length > 100) return "Máximo 100 caracteres";
        return null;
      },
    });

    if (!modal.isConfirmed) {
      setCreando(false);
      return;
    }

    try {
      const resultado = await createCategory({ name: String(modal.value ?? "").trim() });
      if (!resultado.success || !resultado.data) {
        await Swal.fire({
          title: "Error",
          text: resultado.error ?? "No se pudo crear la categoría",
          icon: "error",
          confirmButtonColor: "var(--danger)",
          confirmButtonText: "Aceptar",
        });
        return;
      }

      const nueva = resultado.data;
      onOptionsChange([...options, nueva].sort((a, b) => a.name.localeCompare(b.name)));
      onCreated(nueva.id);
    } catch (error) {
      console.error("Error creating category:", error);
      await Swal.fire({
        title: "Error",
        text: "No se pudo crear la categoría",
        icon: "error",
        confirmButtonColor: "var(--danger)",
        confirmButtonText: "Aceptar",
      });
    } finally {
      setCreando(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="block text-sm font-medium text-ink">Categorías</span>
        <button
          type="button"
          onClick={crearCategoria}
          disabled={disabled || creando}
          aria-label="Crear nueva categoría"
          className="btn btn-ghost whitespace-nowrap"
        >
          ＋ Nueva categoría
        </button>
      </div>
      {/* El grupo es el campo: la fila anuncia su error desde acá (el foco del
          «Ir a la primera» también cae en este contenedor). */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <div
        id={id}
        role="group"
        aria-labelledby={labelledBy}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={describedBy}
        tabIndex={-1}
        className="flex flex-wrap gap-2 outline-none"
      >
        {options.map((categoria) => {
          const elegida = selected.includes(categoria.id);
          return (
            <button
              key={categoria.id}
              type="button"
              aria-pressed={elegida}
              onClick={() => onToggle(categoria.id)}
              disabled={disabled}
              className={`min-h-[44px] rounded-full border ${
                compact ? "px-3" : "px-4 transition-colors"
              } py-2 text-sm touch-manipulation ${
                elegida
                  ? "border-accent bg-accent/10 font-medium text-brand-rosa-texto"
                  : "border-hairline bg-surface text-ink"
              }`}
            >
              {categoria.name}
            </button>
          );
        })}
        {options.length === 0 && (
          <p className="text-xs text-ink-muted">No hay categorías cargadas</p>
        )}
      </div>
    </div>
  );
}
