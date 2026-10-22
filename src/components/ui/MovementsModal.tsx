'use client';

import { useState, useEffect } from 'react';
import { getProductMovements, type ProductMovement } from '@/app/actions/product';

const TYPE_LABELS: Record<ProductMovement['type'], string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  TRANSFER_IN: 'Transferencia entrada',
  TRANSFER_OUT: 'Transferencia salida',
  ADJUSTMENT: 'Ajuste',
};

// Entradas verdes, salidas rojas, pases entre sucursales azules, ajustes grises.
const TYPE_STYLES: Record<ProductMovement['type'], string> = {
  PURCHASE: 'bg-green-100 text-green-800',
  ENTRY: 'bg-green-100 text-green-800',
  SALE: 'bg-red-100 text-red-800',
  EXIT: 'bg-red-100 text-red-800',
  TRANSFER_IN: 'bg-blue-100 text-blue-800',
  TRANSFER_OUT: 'bg-blue-100 text-blue-800',
  ADJUSTMENT: 'bg-gray-100 text-gray-700',
};

interface MovementsModalProps {
  product: {
    id: number;
    name: string;
    code: string;
  };
  isOpen: boolean;
  onClose: () => void;
  /** Sucursal elegida en la página: define contra qué control se corta (S4). */
  branchId?: number | null;
}

type MovementRange = 'created' | 'last-control';

type MovementsMeta = {
  range: MovementRange;
  since: string;
  controlClosedAt: string | null;
};

export function MovementsModal({ product, isOpen, onClose, branchId = null }: MovementsModalProps) {
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<MovementRange>(branchId !== null ? 'last-control' : 'created');
  const [meta, setMeta] = useState<MovementsMeta | null>(null);

  // Al abrir (o al cambiar de producto o de sucursal) el rango vuelve al default:
  // «desde el último control» si hay sucursal, si no «desde la creación».
  useEffect(() => {
    if (isOpen) setRange(branchId !== null ? 'last-control' : 'created');
  }, [isOpen, branchId, product.id]);

  useEffect(() => {
    if (isOpen) {
      loadMovements(range);
    }
  }, [isOpen, product.id, branchId, range]);

  const loadMovements = async (rango: MovementRange) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getProductMovements(product.id, { range: rango, branchId });
      if (result.success && result.data) {
        setMovements(result.data as ProductMovement[]);
        setMeta(result.meta ?? null);
      } else {
        setError(result.error ?? 'Error al cargar movimientos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const formatDay = (dateString: string): string =>
    new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('es-AR', options);
  };

  const formatAmount = (quantity: number): string => {
    return `${quantity} uds`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movements-modal-title"
    >
      <div
        className="bg-white w-full max-w-xl md:max-w-2xl rounded-t-3xl md:rounded-b-3xl p-6 animate-fade-in max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="movements-modal-title" className="text-xl font-semibold text-[#222222]">
            Historial de Movimientos: {product.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-icon btn-round hover:bg-[#f2f2f2]"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-[#222222]">Código:</span>
            <span className="font-mono text-[#6a6a6a]">{product.code}</span>
          </div>
        </div>

        {/* S4: rango del historial. «Desde el último control» necesita una
            sucursal: sin ella no hay control contra el cual cortar. */}
        <div role="group" aria-label="Rango del historial" className="mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRange('last-control')}
              aria-pressed={range === 'last-control'}
              disabled={branchId === null}
              className={`btn ${range === 'last-control' ? 'btn-active' : 'btn-secondary'} flex-1 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Desde el último control
            </button>
            <button
              type="button"
              onClick={() => setRange('created')}
              aria-pressed={range === 'created'}
              className={`btn ${range === 'created' ? 'btn-active' : 'btn-secondary'} flex-1 whitespace-nowrap`}
            >
              Desde la creación
            </button>
          </div>
          <p className="mt-2 text-xs text-[#6a6a6a]">
            {branchId === null
              ? 'Elegí una sucursal en la página para ver desde su último control de stock.'
              : meta?.range === 'last-control' && meta.controlClosedAt
                ? `Movimientos desde el control del ${formatDay(meta.controlClosedAt)}.`
                : meta
                  ? `Movimientos desde la creación del producto (${formatDay(meta.since)}).`
                  : ''}
          </p>
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center py-4 text-[#6a6a6a]">
            <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando movimientos...
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}

        {!loading && movements.length === 0 && (
          <p className="mt-4 text-center text-[#6a6a6a]">
            No hay movimientos registrados para este producto.
          </p>
        )}

        {!loading && movements.length > 0 && (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#6a6a6a] uppercase">
                      Fecha
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#6a6a6a] uppercase">
                      Tipo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#6a6a6a] uppercase md:text-right">
                      Cantidad
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#6a6a6a] uppercase">
                      Referencia
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="bg-white">
                      <td className="px-6 py-4 text-sm text-[#222222] whitespace-nowrap">
                        {formatDate(movement.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#222222] whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          TYPE_STYLES[movement.type]
                        }`}>
                          {TYPE_LABELS[movement.type]}
                        </span>
                        {movement.branchName && (
                          <span className="block text-xs text-[#6a6a6a] mt-1">
                            {movement.branchName}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#222222] whitespace-nowrap tabular-nums md:text-right">
                        {formatAmount(movement.quantity)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#222222] whitespace-nowrap">
                        {movement.referenceId !== null
                          ? `#${movement.referenceId}`
                          : movement.reference ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}