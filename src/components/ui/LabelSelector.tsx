// src/components/ui/LabelSelector.tsx
'use client';

import { useState } from 'react';
import { ProductSearch } from '@/components/ProductSearch';
import { generateProductLabels } from '@/actions/label-print';
import { calculateSheetCount } from '@/lib/label-layout';
import { searchProducts, getProducts } from '@/app/actions/product';

interface LabelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LabelSelector({ isOpen, onClose }: LabelSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: number; code: string; name: string; price: number; stock: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Map<string, number>>(new Map());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await searchProducts({ query: q });
      if (result.success) {
        // Convert Decimal price to number
        const converted = result.data?.map(p => ({
          ...p,
          price: Number(p.price),
        })) ?? [];
        setResults(converted);
      } else {
        setError(result.error ?? 'Error al buscar productos');
        setResults([]);
      }
    } catch (err) {
      setError('Error de conexión');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (product: { id: number; code: string; name: string; price: number; stock: number }) => {
    const productId = product.id.toString();
    const currentQty = selections.get(productId) ?? 0;
    setSelections(new Map(selections).set(productId, currentQty + 1));
  };

  const handleRemove = (productId: string) => {
    const currentQty = selections.get(productId);
    if (currentQty === 1) {
      selections.delete(productId);
    } else if (currentQty && currentQty > 1) {
      selections.set(productId, currentQty - 1);
    }
    setSelections(new Map(selections));
  };

  const handleGenerate = async () => {
    if (selections.size === 0) {
      setGenerateError('Seleccione al menos un producto');
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setSuccess(false);

    try {
      // Convert Map to array of { productId: string, quantity: number }
      const selectionArray: { productId: string; quantity: number }[] = Array.from(selections.entries()).map(
        ([productId, quantity]) => ({ productId, quantity })
      );

// Call the server action to generate the PDF
       const result = await generateProductLabels(
         selectionArray.map(s => ({ productId: Number(s.productId), quantity: s.quantity }))
       );

       // The action returns a base64 encoded PDF string
       // Convert it to a Blob for download
       const byteCharacters = atob(result);
       const byteNumbers = new Array(byteCharacters.length);
       for (let i = 0; i < byteCharacters.length; i++) {
         byteNumbers[i] = byteCharacters.charCodeAt(i);
       }
       const byteArray = new Uint8Array(byteNumbers);
       const blob = new Blob([byteArray], { type: 'application/pdf' });
       
       // Create a download link
       const url = window.URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `etiquetas_${Date.now()}.pdf`;
       document.body.appendChild(a);
       a.click();
       window.URL.revokeObjectURL(url);
       a.remove();
       setSuccess(true);
    } catch (err: any) {
      setGenerateError(err.message ?? 'Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  };

  const totalLabels = Array.from(selections.values()).reduce((sum, qty) => sum + qty, 0);
  const totalSheets = calculateSheetCount(totalLabels);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-selector-title"
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="label-selector-title" className="text-xl font-semibold text-[#222222]">
            Generar Etiquetas
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#f2f2f2] transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label htmlFor="label-search" className="block text-sm font-medium text-[#222222] mb-1">
            Buscar producto
          </label>
          <div className="relative">
            <input
              id="label-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch((e.target as HTMLInputElement).value);
                }
              }}
              className="w-full px-4 py-3 bg-[#f8f8f8] rounded-xl text-base text-[#222222] placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20"
              placeholder="Buscar producto por código o nombre..."
              autoComplete="off"
            />
            {loading && (
              <div className="absolute inset-y-0 right-0 flex items-center px-3 text-[#6a6a6a]">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          {!loading && results.length > 0 && (
            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto" role="listbox">
              {results.map((product) => (
                <li
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className="px-3 py-2 bg-white rounded-lg border border-gray-100 hover:bg-[#f8f8f8] transition-colors cursor-pointer flex items-center justify-between"
                  role="option"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleSelect(product)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#222222] truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-xs text-[#6a6a6a] mt-0.5">
                      <span className="px-2 py-0.5 bg-[#f2f2f2] rounded">{product.code}</span>
                      <span>${product.price.toFixed(2)}</span>
                      <span className={product.stock <= 5 ? "text-red-500" : ""}>
                        Stock: {product.stock}
                      </span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-[#6a6a6a] flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </li>
              ))}
            </ul>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <p className="mt-2 text-sm text-[#222222]">No se encontraron productos</p>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-[#222222] mb-1">
            Productos seleccionados
          </label>
          {selections.size === 0 ? (
            <p className="text-sm text-[#6a6a6a]">Ningún producto seleccionado</p>
          ) : (
            <ul className="space-y-1">
              {Array.from(selections.entries()).map(([productId, qty]) => {
                const product = results.find(p => p.id.toString() === productId);
                return (
                  <li
                    key={productId}
                    className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      {product ? (
                        <>
                          <p className="text-sm font-medium text-[#222222] truncate">{product.name}</p>
                          <p className="text-xs text-[#6a6a6a]">Código: {product.code}</p>
                        </>
                      ) : (
                        <p className="text-sm text-[#6a6a6a]">Producto ID: {productId}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemove(productId)}
                        disabled={qty === 1}
                        className="p-1 rounded hover:bg-[#f2f2f2] transition-colors"
                        aria-label="Disminuir cantidad"
                      >
                        <svg className="w-4 h-4 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m0 0 0 0m0 0h6m-6 0l-3 3m3-3l3-3" />
                        </svg>
                      </button>
                      <span className="mx-2 font-medium">{qty}</span>
                      <button
                        onClick={() => handleSelect(results.find(p => p.id.toString() === productId)!)}
                        className="p-1 rounded hover:bg-[#f2f2f2] transition-colors"
                        aria-label="Aumentar cantidad"
                      >
                        <svg className="w-4 h-4 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-3-3m3 3l3-3" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-[#222222]">
            {totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''} en {totalSheets} hoja{totalSheets !== 1 ? 's' : ''} A4
          </p>
        </div>

        {generating && (
          <div className="mt-4 flex items-center justify-center py-4 text-[#6a6a6a]">
            <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generando PDF...
          </div>
        )}

        {generateError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
            {generateError}
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            PDF generado con éxito. La descarga debería haber comenzado.
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || selections.size === 0}
            className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generando...' : 'Descargar Etiquetas PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}