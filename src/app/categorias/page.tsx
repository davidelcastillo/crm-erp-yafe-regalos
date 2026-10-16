"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCategories, deleteCategory, createCategory } from '@/app/actions/category';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionCard } from '@/components/ui/ActionCard';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton } from '@/components/ui/Skeleton';
import type { Category } from '@prisma/client';
import Swal from 'sweetalert2';

type CategoryWithCount = Category & { _count: { products: number } };

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  // Arranca en carga: con `false` el primer render mostraba el vacío y la lista
  // aparecía después (la página saltaba), que es justo lo que evitan los esqueletos.
  const [loading, setLoading] = useState(true);
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
    <div className="min-h-screen bg-white pb-20">
      <main>
        <div className="pb-16 brand-gradient">
          <PageHeader
            title="Categorías"
            actions={
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 min-h-[44px] rounded-xl brand-action text-sm font-medium touch-manipulation"
              >
                Nueva categoría
              </button>
            }
          />

          {/* Acción de la página en mobile: en su propio div, con el fondo de marca a la vista. */}
          <div className="mt-4 px-3 md:hidden">
            <div className="flex gap-3">
              <ActionCard
                label="Nueva categoría"
                onClick={handleCreate}
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>

        <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-black/5 bg-[#ffe4ea] px-4 py-3 text-sm text-[#8f0020]"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="pt-2">
              <Spinner label="Cargando categorías..." />
              <div className="mt-6 space-y-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#6a6a6a]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5a2 2 0 012 2v5a2 2 0 01-.586 1.414l-7 7a2 2 0 01-2.828 0l-2.586-2.586a2 2 0 010-2.828l7-7A2 2 0 017 3z"
                  />
                </svg>
              </div>
              <p className="text-[#6a6a6a]">No hay categorías</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {categories.map((cat) => (
                <li key={cat.id} className="glass rounded-2xl border border-black/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <h2 className="text-base font-semibold text-[#222222] break-words">
                        {cat.name}
                      </h2>
                      {/* El ID se seguía leyendo en la tabla vieja: se conserva, chico. */}
                      <code className="shrink-0 px-2 py-0.5 bg-[#f2f2f2] rounded text-xs font-mono text-[#6a6a6a]">
                        #{cat.id}
                      </code>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-[#6a6a6a]">Productos</p>
                      <p className="mt-0.5 text-base font-semibold text-[#222222]">
                        {cat._count?.products ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Las dos acciones se envuelven: en un celular chico no entran en una fila fija. */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
                    <Link
                      href={`/categorias/${cat.id}`}
                      className="flex-1 whitespace-nowrap py-2 px-3 text-center text-sm font-medium text-[#3f3f3f] bg-[#f2f2f2] rounded-lg hover:bg-[#e5e5e5] transition-colors touch-manipulation"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      className="flex-1 whitespace-nowrap py-2 px-3 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors touch-manipulation"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}