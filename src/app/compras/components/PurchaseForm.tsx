import { useState } from 'react';
import { createPurchaseWithBranchSplit } from '@/app/actions/purchase';
import { useFormStatus } from 'react-dom';
import Swal from 'sweetalert2';

export interface PurchaseFormProps {
  productId: number;
  branches: Array<{ id: number; name: string }>;
  totalStock: number; // total stock across all branches
  onClose: () => void;
  onSuccess: () => void;
}

export const PurchaseForm = ({ productId, branches, totalStock, onClose, onSuccess }: PurchaseFormProps) => {
  const [lines, setLines] = useState<Array<{ branchId: number | null; quantity: string; price: string }>>([
    { branchId: null, quantity: '', price: '' }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { pending: formPending } = useFormStatus();

  const addLine = () => {
    setLines([...lines, { branchId: null, quantity: '', price: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    // Validate lines
    const validated = lines.map((line, idx) => {
      const branchId = line.branchId;
      const qty = parseInt(line.quantity);
      const price = parseFloat(line.price);
      if (branchId === null) {
        throw new Error(`Línea ${idx + 1}: Seleccione una sucursal`);
      }
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Línea ${idx + 1}: Cantidad debe ser mayor a 0`);
      }
      if (isNaN(price) || price <= 0) {
        throw new Error(`Línea ${idx + 1}: Precio debe ser mayor a 0`);
      }
      // TODO: check stock per branch? Could be done in action
      return { branchId, quantity: qty, price };
    });

    try {
      const result = await createPurchaseWithBranchSplit({
        items: validated.map(l => ({
          productId,
          branchId: l.branchId!,
          quantity: l.quantity,
          price: l.price
        }))
      });

      if (result.success) {
        await Swal.fire({
          title: 'Compra registrada',
          text: 'La compra se ha registrado correctamente',
          icon: 'success',
          confirmButtonColor: '#ff385c',
          confirmButtonText: 'Aceptar',
          background: '#ffffff',
          color: '#222222',
        });
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(result.error || 'Error al registrar la compra');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message || 'Error inesperado' : 'Error inesperado');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center">
      <div 
        className="bg-white w-full max-w-2xl rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#222222]">Registrar Compra</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#f2f2f2] transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto ID: {productId}
            </label>
          </div>

          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-gray-700">Línea {index + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-sm text-red-600 hover:text-red-500"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-600">Sucursal</label>
                    <select
                      value={line.branchId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newLines = [...lines];
                        newLines[index] = { ...newLines[index], branchId: val === '' ? null : Number(val) };
                        setLines(newLines);
                      }}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Seleccionar sucursal</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[index] = { ...newLines[index], quantity: e.target.value };
                        setLines(newLines);
                      }}
                      className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio unitario
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.price}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[index] = { ...newLines[index], price: e.target.value };
                        setLines(newLines);
                      }}
                      className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}

            {lines.length < 10 && (
              <button
                type="button"
                onClick={addLine}
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-600 rounded hover:bg-indigo-50"
              >
                + Añadir otra línea
              </button>
            )}
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending || formPending}
              className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
            >
              {pending ? 'Procesando...' : 'Registrar Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};