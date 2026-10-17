"use client";

export interface InventoryItem {
  code: string;
  name: string;
  stock: number;
  price: number;
}

interface ExternalInventoryTableProps {
  inventoryData: InventoryItem[];
  showHeaders?: boolean;
}

export default function ExternalInventoryTable({
  inventoryData,
  showHeaders = true,
}: ExternalInventoryTableProps) {
  if (inventoryData.length === 0) {
    return (
      <div className="text-center py-12 text-[#6a6a6a]">
        No hay productos en el inventario de esta sucursal
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile: una card de vidrio por producto, con la misma forma que las
          listas (nombre, código, stock y precio). */}
      <div className="space-y-4 md:hidden">
        {inventoryData.map((item, index) => (
          <div key={index} className="rounded-2xl glass p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[#222222] break-words">
                  {item.name}
                </h3>
                <span className="mt-1 inline-block max-w-full break-words px-2 py-0.5 bg-[#f2f2f2] rounded text-xs font-mono text-[#6a6a6a]">
                  {item.code}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-[#222222]">
                  {item.stock} uds
                </span>
                <span className="text-sm font-semibold text-[#222222]">
                  ${item.price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Escritorio: la tabla con las mismas columnas, con scroll propio si el
          ancho no alcanza. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          {showHeaders && (
            <thead className="bg-gray-50 font-medium text-gray-600">
              <tr>
                <th className="w-[60px] p-3 text-left">Código</th>
                <th className="p-3 text-left">Producto</th>
                <th className="w-[80px] p-3 text-center">Stock</th>
                <th className="w-[100px] p-3 text-right">Precio</th>
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-gray-200">
            {inventoryData.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{item.code}</td>
                <td className="px-4 py-3 break-words text-[#222222]">
                  {item.name}
                </td>
                <td className="px-4 py-3 text-center font-semibold text-[#222222]">
                  {item.stock}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-[#222222]">
                  ${item.price.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
