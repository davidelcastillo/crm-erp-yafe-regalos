import { useState } from 'react';
import { moveStockBetweenBranches, getBranchInventory } from '@/app/actions/inventory';
import { useFormStatus } from 'react-dom';
import Swal from 'sweetalert2';

export interface MoveStockModalProps {
  open: boolean;
  onClose: () => void;
  productId: number; // This prop is no longer used but kept for compatibility
  branches: Array<{ id: number; name: string }>;
  onConfirm: () => void;
}

export const MoveStockModal = ({ open, onClose, productId, branches, onConfirm }: MoveStockModalProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceBranchId, setSourceBranchId] = useState<number | null>(null);
  const [productOptions, setProductOptions] = useState<Array<{ id: number; name: string; stock: number }>>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [destBranchId, setDestBranchId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { pending: formPending } = useFormStatus();

  const goToStep = (newStep: 1 | 2 | 3) => {
    setStep(newStep);
    setError(null);
  };

  const handleOriginChange = async (branchId: number | null) => {
    setSourceBranchId(branchId);
    if (branchId === null) {
      setProductOptions([]);
      setSelectedProductIds([]);
      goToStep(1);
      return;
    }
    // Load products with stock in this branch
    try {
      const res = await getBranchInventory({ branchId });
      if (res.success) {
        setProductOptions(res.data as Array<{ id: number; name: string; stock: number }>);
        setSelectedProductIds([]);
        goToStep(2);
      } else {
        setError(res.error || 'Error al cargar productos');
      }
    } catch (err) {
      setError('Error al cargar productos');
    }
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProductIds(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const isProductSelected = (productId: number) => 
    selectedProductIds.includes(productId);

  const handleSubmit = async () => {
    setError(null);
    setPending(true);
    try {
      const src = sourceBranchId;
      const dst = destBranchId;
      const qty = parseInt(quantity, 10);
      
      if (src === null) {
        throw new Error('Seleccione sucursal de origen');
      }
      if (selectedProductIds.length === 0) {
        throw new Error('Seleccione al menos un producto');
      }
      if (dst === null) {
        throw new Error('Seleccione sucursal de destino');
      }
      if (src === dst) {
        throw new Error('El origen y destino deben ser distintos');
      }
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Cantidad debe ser mayor a 0');
      }

      // Move stock for each selected product
      for (const productId of selectedProductIds) {
        await moveStockBetweenBranches({
          productId,
          sourceBranchId: src,
          destBranchId: dst,
          quantity: qty,
          performedBy: 'admin' // TODO: get from auth context
        });
      }
      
      onClose();
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al mover stock');
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md">
        <h2 className="text-lg font-medium mb-4">Mover Stock</h2>
        {step === 1 && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sucursal Origen
              </label>
              <select
                value={sourceBranchId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleOriginChange(val === '' ? null : Number(val));
                }}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                disabled={formPending}
              >
                <option value="">Seleccionar origen</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
        {step === 2 && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Productos (con stock en sucursal de origen)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {productOptions.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay productos con stock en esta sucursal</p>
                ) : (
                  <>
                    {productOptions.map(product => (
                      <div key={product.id} className="flex items-center p-2 border rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={isProductSelected(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="h-4 w-4 text-[#ff385c] focus:ring-indigo-500"
                        />
                        <div className="flex-1 ml-3">
                          <div className="font-medium text-gray-800">{product.name}</div>
                          <div className="text-sm text-gray-600">Stock: {product.stock}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
              >
                Continuar
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sucursal Destino
              </label>
              <select
                value={destBranchId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setDestBranchId(val === '' ? null : Number(val));
                }}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                disabled={formPending}
              >
                <option value="">Seleccionar destino</option>
                {branches
                  .filter(b => b.id !== sourceBranchId)
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad (por producto)
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                disabled={formPending}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
              >
                ← Volver
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || formPending}
                className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
              >
                {pending ? 'Moviendo...' : 'Mover Stock'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};