"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCategories, deleteCategory, createCategory } from '@/app/actions/category';
import type { Category } from '@prisma/client';
import Swal from 'sweetalert2';

type CategoryWithCount = Category & { _count: { products: number } };

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await getCategories();
      if (result.success) {
        setCategories(result.data);
      } else {
        setError(result.error || 'Error loading categories');
      }
    } catch (err) {
      setError('Error loading categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async () => {
    const modal = await Swal.fire({
      title: 'Nueva categoría',
      input: 'text',
      inputLabel: 'Nombre',
      inputPlaceholder: 'Ej: Limpieza, Alimentos…',
      inputAttributes: { maxlength: '100', autocapitalize: 'on' },
      showCancelButton: true,
      confirmButtonText: 'Crear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#be185d',
      cancelButtonColor: '#6a6a6a',
      background: '#ffffff',
      color: '#222222',
      inputValidator: (value) => {
        if (!value || !value.trim()) return 'El nombre es requerido';
        if (value.length > 100) return 'Máximo 100 caracteres';
        return null;
      },
    });
    if (!modal.isConfirmed) return;
    const name = modal.value.trim();
    const result = await createCategory({ name });
    if (result.success) {
      await Swal.fire({
        title: 'Categoría creada',
        text: `Se creó "${name}"`,
        icon: 'success',
        confirmButtonColor: '#be185d',
        confirmButtonText: 'Aceptar',
        background: '#ffffff',
        color: '#222222',
      });
      loadCategories();
    } else {
      await Swal.fire({
        title: 'Error',
        text: result.error || 'No se pudo crear la categoría',
        icon: 'error',
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Aceptar',
        background: '#ffffff',
        color: '#222222',
      });
    }
  };

  const handleDelete = async (id: number) => {
    const confirmation = await Swal.fire({
      title: '¿Eliminar categoría?',
      text: 'Esta acción no se puede deshacer. Si la categoría tiene productos asociados, se bloqueará.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#be185d',
      cancelButtonColor: '#6a6a6a',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#222222',
    });
    if (!confirmation.isConfirmed) return;
    const result = await deleteCategory({ id });
    if (result.success) {
      await Swal.fire({
        title: 'Categoría eliminada',
        icon: 'success',
        confirmButtonColor: '#be185d',
        confirmButtonText: 'Aceptar',
        background: '#ffffff',
        color: '#222222',
      });
      loadCategories();
    } else {
      await Swal.fire({
        title: 'Error',
        text: result.error || 'No se pudo eliminar la categoría',
        icon: 'error',
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Aceptar',
        background: '#ffffff',
        color: '#222222',
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 pt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <button
            type="button"
            onClick={handleCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Nueva Categoría
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cat.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                    {cat.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cat._count?.products ?? 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/categorias/${cat.id}`}
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      className="ml-4 text-red-600 hover:text-red-500"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No hay categorías
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}