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
      <div className="text-center py-8 text-gray-500">
        No hay productos en el inventario de esta sucursal
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeaders && (
        <div className="grid grid-cols-2 sm:grid-cols-[60px_1fr_80px_100px] bg-gray-50 p-3 rounded-t-lg font-medium text-gray-600">
          <div className="sm:hidden">Producto</div>
          <div className="hidden sm:block">Código</div>
          <div className="hidden sm:block">Producto</div>
          <div className="sm:hidden text-end">Stock / Precio</div>
          <div className="hidden sm:block text-center">Stock</div>
          <div className="hidden sm:block text-end">Precio</div>
        </div>
      )}
      <div className="divide-y divide-gray-200">
        {inventoryData.map((item, index) => (
          <div key={index} className="px-4 py-3 hover:bg-gray-50">
            <div className="grid grid-cols-2 sm:grid-cols-[60px_1fr_80px_100px] text-sm items-baseline">
              <div className="sm:hidden flex flex-col min-w-0">
                <span className="font-mono">{item.code}</span>
                <span className="break-words text-gray-800">{item.name}</span>
              </div>
              <div className="hidden sm:block font-mono">{item.code}</div>
              <div className="hidden sm:block break-words">{item.name}</div>
              <div className="sm:hidden text-end">
                <div>{item.stock} uds</div>
                <div className="font-medium">
                  ${item.price.toFixed(2)}
                </div>
              </div>
              <div className="hidden sm:block text-center">{item.stock}</div>
              <div className="hidden sm:block text-end font-medium">
                ${item.price.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}