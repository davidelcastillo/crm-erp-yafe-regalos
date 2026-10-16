"use client";

import { useState } from "react";
import { Product } from "@prisma/client";
import { ProductForm } from "./ProductForm";

interface AddProductButtonProps {
  /** Callback ejecutado tras crear un producto (refetch en la página). */
  onSuccess?: (product: Product) => void;
  /** Modo controlado: la página posee el estado de apertura. */
  open?: boolean;
  /** Modo controlado: notifica a la página el cambio de apertura. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * AddProductButton
 *
 * FAB circular "Agregar producto" reutilizado en /inventario (change
 * unificar-productos-inventario).
 *
 * - Sin `open`/`onOpenChange` (modo legacy): mantiene su estado interno y
 *   renderiza <ProductForm> él mismo — comportamiento idéntico al original.
 * - Con `open`/`onOpenChange` (modo controlado): delega la apertura en la
 *   página y NUNCA renderiza el ProductForm interno (la página renderiza el
 *   suyo propio con el scrim z-[60] directo, sin wrapper z-[70]).
 */
export function AddProductButton({
  onSuccess,
  open,
  onOpenChange,
}: AddProductButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const currentOpen = isControlled ? open : isOpen;

  const handleClick = () => {
    if (isControlled) {
      onOpenChange(true);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed bottom-24 right-6 w-14 h-14 brand-gradient brand-gradient-hover text-gray-800 rounded-full shadow-lg transition-colors flex items-center justify-center z-40"
        aria-label="Agregar producto"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      {!isControlled && currentOpen && (
        <ProductForm product={null} onClose={() => setIsOpen(false)} onSuccess={onSuccess} />
      )}
    </>
  );
}