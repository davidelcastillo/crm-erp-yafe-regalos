"use client";

import { deleteProduct } from "../../actions/product";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  productId: number;
}

export function DeleteButton({ productId }: DeleteButtonProps) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    const result = await deleteProduct({ id: productId });
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || "Error al eliminar");
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="flex-1 py-2 px-3 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
    >
      Eliminar
    </button>
  );
}