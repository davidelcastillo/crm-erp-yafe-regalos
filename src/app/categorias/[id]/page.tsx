"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCategoryById, updateCategory, deleteCategory } from '@/app/actions/category';
import { Category } from '@prisma/client';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { CardSkeleton } from '@/components/ui/Skeleton';

/** Envoltorio de la pagina: banda de marca con el encabezado y hoja de vidrio. */
const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-surface pb-20">
    <div className="pb-16 brand-gradient">
      <PageHeader title="Editar categoría" />
    </div>
    <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      {children}
    </div>
  </div>
);

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
      confirmButtonColor: "#6d28d9",
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
        confirmButtonColor: "#6d28d9",
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
          confirmButtonColor: "#6d28d9",
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
    return (
      <PageShell>
        <Spinner label="Cargando categoría..." />
        <div className="mt-6 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </PageShell>
    );
  }

  if (!category) {
    return (
      <PageShell>
        <p className="py-6 text-center text-sm text-ink-muted">Categoría no encontrada</p>
        <Link
          href="/categorias"
          className="btn btn-secondary mx-auto w-fit"
        >
          Volver a la lista
        </Link>
      </PageShell>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="pb-16 brand-gradient">
        <PageHeader
          title="Editar categoría"
          actions={
            <>
              <Link href="/categorias" className="btn btn-secondary">
                Volver a la lista
              </Link>
              <button type="button" onClick={handleDelete} className="btn btn-danger">
                Eliminar
              </button>
            </>
          }
          menuItems={[
            { label: "Volver a la lista", href: "/categorias" },
            { label: "Eliminar categoría", onClick: handleDelete },
          ]}
        />
      </div>

      <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {error && (
          <div role="alert" className="mb-4 rounded-xl bg-error-surface p-4 text-sm text-error-ink">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="categoria-nombre"
              className="mb-1 block text-sm font-medium text-ink-body"
            >
              Nombre
            </label>
            <input
              id="categoria-nombre"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] w-full rounded-xl bg-surface-soft px-3 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
              disabled={formPending}
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={saving || formPending}
              className="btn btn-primary w-full"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}