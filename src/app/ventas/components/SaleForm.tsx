import { useState } from 'react';
import { registerSale } from '@/app/actions/sale';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { PaymentMethod } from '@/lib/utils/payment';

export interface SaleFormProps {
  productId: number;
  branches: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export const SaleForm = ({ productId, branches, onClose, onSuccess }: SaleFormProps) => {
  const router = useRouter();
  const [branchId, setBranchId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('EFECTIVO');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { pending: formPending } = useFormStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    const bid = branchId;
    const qty = parseInt(quantity);
    const prc = parseFloat(price);
    const method = paymentMethod;

    if (bid === null) {
      setError('Seleccione una sucursal');
      setPending(false);
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setError('Cantidad debe ser mayor a 0');
      setPending(false);
      return;
    }
    if (isNaN(prc) || prc <= 0) {
      setError('Precio debe ser mayor a 0');
      setPending(false);
      return;
    }
    if (method === 'MIXTO') {
      const cash = parseFloat(cashAmount) || 0;
      const transfer = parseFloat(transferAmount) || 0;
      if (cash + transfer <= 0) {
        setError('se requiere una cantidad en efectivo o transferencia mayor a 0');
        setPending(false);
        return;
      }
    }

    try {
      const result = await registerSale({
        productId,
        branchId: bid!,
        quantity: qty,
        price: prc,
        paymentMethod: method as PaymentMethod,
        ...(method === 'MIXTO'
          ? {
              cashAmount: parseFloat(cashAmount) || 0,
              transferAmount: parseFloat(transferAmount) || 0,
            }
          : {}),
      });

      if (result.success) {
        await Swal.fire({
          title: 'Venta registrada',
          text: 'La venta se ha registrado correctamente',
          icon: 'success',
          confirmButtonColor: '#ff385c',
          confirmButtonText: 'Aceptar',
          background: '#ffffff',
          color: '#222222',
        });
        router.refresh();
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(result.error || 'Error al registrar la venta');
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
        className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#222222]">Registrar Venta</h2>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sucursal
            </label>
            <select
              value={branchId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setBranchId(val === '' ? null : Number(val));
              }}
              className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
              disabled={formPending}
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
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
              disabled={formPending}
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
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
              disabled={formPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de pago
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
              disabled={formPending}
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="MIXTO">Mixto</option>
            </select>
          </div>

          {paymentMethod === 'MIXTO' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cashAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Efectivo
                </label>
                <input
                  id="cashAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                  disabled={formPending}
                />
              </div>
              <div>
                <label htmlFor="transferAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Transferencia
                </label>
                <input
                  id="transferAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                  disabled={formPending}
                />
              </div>
            </div>
          )}

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
              type="button"
              onClick={handleSubmit}
              disabled={pending || formPending}
              className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
            >
              {pending ? 'Procesando...' : 'Registrar Venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};