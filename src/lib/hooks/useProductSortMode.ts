"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ProductSortMode } from "@/lib/product-order";

/**
 * Orden de las listas que eligen productos —los modales de exportar y los de
 * movimiento de stock— y lo que el usuario eligió la última vez.
 *
 * Las cinco listas comparten la clave: cambiar el orden en el modal de mover
 * stock deja ese mismo orden en el de etiquetas. Sin nada guardado (o con un
 * valor que no es un modo del sistema) arranca por código, como el resto de las
 * listas del proyecto.
 */
export const PRODUCT_SORT_STORAGE_KEY = "orden-listas-productos";

export const DEFAULT_PRODUCT_SORT: ProductSortMode = "code";

const isSortMode = (value: string | null): value is ProductSortMode =>
  value === "code" || value === "updated";

/* Lo elegido cuando el navegador no deja guardar (modo privado): el orden vale
   para esta visita en vez de perderse. */
let sinPersistencia: ProductSortMode | null = null;

/** Lo guardado que no es un modo conocido se ignora (basura, otra versión). */
export const readStoredProductSort = (): ProductSortMode => {
  try {
    const stored = localStorage.getItem(PRODUCT_SORT_STORAGE_KEY);
    return isSortMode(stored) ? stored : sinPersistencia ?? DEFAULT_PRODUCT_SORT;
  } catch {
    return sinPersistencia ?? DEFAULT_PRODUCT_SORT;
  }
};

/* Las listas se leen como una fuente externa y no con un efecto: así todas las
   que estén abiertas cambian juntas y el primer render del servidor usa el
   default sin desajuste de hidratación. */
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getServerSnapshot = () => DEFAULT_PRODUCT_SORT;

export function useProductSortMode(): readonly [
  ProductSortMode,
  (mode: ProductSortMode) => void,
] {
  const mode = useSyncExternalStore(subscribe, readStoredProductSort, getServerSnapshot);

  const select = useCallback((next: ProductSortMode) => {
    try {
      localStorage.setItem(PRODUCT_SORT_STORAGE_KEY, next);
      sinPersistencia = null;
    } catch {
      sinPersistencia = next;
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [mode, select];
}
