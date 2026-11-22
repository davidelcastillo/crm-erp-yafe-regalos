// src/components/ui/EstilosPicker.tsx
"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { createEstiloPrenda } from "@/app/actions/prendaTaxonomy";
import type { TaxonomyOption } from "@/lib/validations/prendaTaxonomy";

export interface EstilosPickerProps {
  /** Lista compartida de estilos activos: el padre es la fuente de verdad. */
  options: TaxonomyOption[];
  /** Avisa la lista actualizada cuando este picker crea un estilo. */
  onOptionsChange: (options: TaxonomyOption[]) => void;
  /** Ids elegidos por el dueño del picker. */
  selected: number[];
  onToggle: (id: number) => void;
  /** Se llama con el id recién creado para que el dueño lo marque. */
  onCreated: (id: number) => void;
  /** Pills más ajustadas: una card del lote. */
  compact?: boolean;
  disabled?: boolean;
}

/**
 * EstilosPicker
 *
 * Las pills de estilos de la prenda, con «＋ Nuevo estilo» al lado: mismo
 * diálogo y misma action (`createEstiloPrenda`) que `PrendaForm`, extraídos acá
 * para no repetir el patrón en el alta individual y en el lote.
 *
 * La lista la inyecta el padre (una sola carga para todas las filas); el estilo
 * nuevo se suma a esa lista y el padre decide a quién seleccionarlo. Un error
 * del servidor se muestra con Swal y deja la selección intacta.
 */
export function EstilosPicker({
  options,
  onOptionsChange,
  selected,
  onToggle,
  onCreated,
  compact = false,
  disabled = false,
}: EstilosPickerProps) {
  const [creando, setCreando] = useState(false);

  const crearEstilo = async () => {
    setCreando(true);
    try {
      const modal = await Swal.fire({
        title: "Nuevo estilo",
        input: "text",
        inputLabel: "Nombre",
        inputAttributes: { maxlength: "100" },
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
      if (!modal.isConfirmed) return;

      const name = String(modal.value ?? "").trim();
      const resultado = await createEstiloPrenda({ name });
      if (!resultado.success) {
        await Swal.fire({
          title: "Error",
          text: resultado.error || "No se pudo crear el estilo",
          icon: "error",
          confirmButtonColor: "var(--danger)",
          confirmButtonText: "Aceptar",
        });
        return;
      }

      const nuevo = resultado.data;
      onOptionsChange(
        [...options, nuevo].sort((a, b) => a.name.localeCompare(b.name))
      );
      onCreated(nuevo.id);
    } catch (error) {
      console.error("Error creating style:", error);
      await Swal.fire({
        title: "Error",
        text: "No se pudo crear el estilo",
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
      <div className="flex items-center justify-between gap-2">
        <span className="block text-sm font-medium text-ink">Estilos</span>
        <button
          type="button"
          onClick={crearEstilo}
          disabled={disabled || creando}
          className="btn btn-ghost whitespace-nowrap"
        >
          ＋ Nuevo estilo
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((estilo) => {
          const elegido = selected.includes(estilo.id);
          return (
            <button
              key={estilo.id}
              type="button"
              aria-pressed={elegido}
              onClick={() => onToggle(estilo.id)}
              disabled={disabled}
              className={`min-h-[44px] rounded-full border ${
                compact ? "px-3" : "px-4 transition-colors"
              } py-2 text-sm touch-manipulation ${
                elegido
                  ? "border-accent bg-accent/10 font-medium text-brand-rosa-texto"
                  : "border-hairline bg-surface text-ink"
              }`}
            >
              {estilo.name}
            </button>
          );
        })}
        {options.length === 0 && (
          <p className="text-xs text-ink-muted">No hay estilos cargados</p>
        )}
      </div>
    </div>
  );
}
