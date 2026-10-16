"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCategoryById, updateCategory, deleteCategory } from '@/app/actions/category';
import { Category } from '@prisma/client';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function CategoryEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pending: formPending } = useFormStatus();

  const [name, setName] = useState('');

  useEffect(() => {
    if (!id) return;
    const loadCategory = async () => {
      setLoading(true);
      try {
        const result = await getCategoryById(parseInt(id));
        if (result.success) {
          setCategory(result.data as Category);
          setName((result.data as Category).name);
        } else {
          setError(result.error || 'Error loading category');
        }
      } catch (err) {
        setError('Error loading category');
      } finally {
        setLoading(false);
      }
    };
    loadCategory();
  }, [id]);

  const handleDelete = async () => {
    const confirmation = await Swal.fire({
      title: '¿Eliminar categoría?',
      text: 'Esta acción no se puede deshacer. Si tiene productos asociados, se bloqueará.',
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
    const result = await deleteCategory({ id: parseInt(id) });
    if (result.success) {
      await Swal.fire({
        title: 'Categoría eliminada',
        icon: 'success',
        confirmButtonColor: '#be185d',
        confirmButtonText: 'Aceptar',
        background: '#ffffff',
        color: '#222222',
      });
      router.push('/categorias');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await updateCategory({ id: parseInt(id), name });
      if (result.success) {
        await Swal.fire({
          title: 'Categoría actualizada',
          text: 'La categoría se ha actualizado correctamente',
          icon: 'success',
          confirmButtonColor: '#be185d',
          confirmButtonText: 'Aceptar',
          background: '#ffffff',
          color: '#222222',
        });
        router.push('/categorias');
      } else {
        setError(result.error || 'Error al actualizar');
      }
    } catch (err) {
      setError('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-[calc(100vh-4rem)] pb-20 pt-12 flex items-center justify-center">Cargando...</div>;
  }

  if (!category) {
    return <div className="min-h-[calc(100vh-4rem)] pb-20 pt-12 flex items-center justify-center">Categoría no encontrada</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-20 pt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Editar Categoría</h1>
          <div className="flex space-x-3">
            <Link href="/categorias" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
              Volver a la lista
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 hover:text-red-500"
            >
              Eliminar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
              disabled={formPending}
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={saving || formPending}
              className="w-full py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}