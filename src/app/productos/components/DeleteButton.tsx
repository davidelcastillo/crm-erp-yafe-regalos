"use client";

import { toggleProductActive } from "../../actions/product";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

interface DeleteButtonProps {
  productId: number;
}

export function DeleteButton({ productId }: DeleteButtonProps) {
  const router = useRouter();

  const handleDeactivate = async () => {
    const result = await Swal.fire({
      title: '¿Desactivar producto?',
      text: "Esto lo marcará como inactivo pero conservará su stock e historial. ¿Continuar?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      const res = await toggleProductActive({ id: productId, active: false });
      if (res.success) {
        router.refresh();
      } else {
        Swal.fire('Error', res.error || 'Error al desactivar el producto', 'error');
      }
    }
  };

  return (
    <button
      onClick={handleDeactivate}
      className="flex-1 py-2 px-3 text-sm font-medium text-gray-800 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      Desactivar
    </button>
  );
}