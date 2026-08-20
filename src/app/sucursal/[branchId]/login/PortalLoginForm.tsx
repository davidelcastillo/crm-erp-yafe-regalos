'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginBranch } from '@/actions/auth.branch';
import { loginSchema } from '@/lib/validations/auth';

export default function PortalLoginForm({ branchId }: { branchId: number }) {
  const [formState, setFormState] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = loginSchema.safeParse(formState);
    if (!result.success) {
      const firstError = result.error.issues[0];
      setError(`${String(firstError.path[0])}: ${firstError.message}`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const actionResult = await loginBranch(new FormData(e.currentTarget), branchId);
      if (actionResult.success) {
        setSuccess('Inicio de sesión exitoso');
        setTimeout(() => {
          router.push(actionResult.redirectTo || `/sucursal/${branchId}/inventory`);
        }, 1500);
      } else {
        setError(actionResult.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error inesperado al iniciar sesión');
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="block w-full rounded-xl border-0 px-3 py-3 min-h-[44px] text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 touch-manipulation"
          value={formState.email}
          onChange={handleChange}
        />
      </div>

      <div>
        <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-900">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="block w-full rounded-xl border-0 px-3 py-3 min-h-[44px] text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 touch-manipulation"
          value={formState.password}
          onChange={handleChange}
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {success && <p className="mt-2 text-sm text-green-600">{success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full flex justify-center py-2 px-4 min-h-[44px] border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors touch-manipulation"
      >
        {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
