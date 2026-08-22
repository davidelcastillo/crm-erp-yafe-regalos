'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/actions/auth.reset';
import { resetPasswordSchema } from '@/lib/validations/auth';

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  const pending = status === 'sending';
  const success = status === 'success';
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || success) return;

    // Validate with Zod first to give immediate feedback.
    const result = resetPasswordSchema.safeParse({ password });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setStatus('sending');
    try {
      const actionResult = await updatePassword(new FormData(e.currentTarget));
      if (actionResult.success) {
        setStatus('success');
        // Brief delay so the user sees the confirmation before leaving.
        setTimeout(() => {
          router.push(actionResult.redirectTo ?? '/login');
        }, 1500);
      } else {
        setError(actionResult.error || 'No se pudo actualizar la contraseña');
        setStatus('idle');
      }
    } catch {
      setError('Ocurrió un error inesperado');
      setStatus('idle');
    }
  };

  return (
    <div className="w-full max-w-md">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password" className="block mb-2 text-sm font-medium text-[#6a6a6a]">
            Nueva contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={success}
            className="block w-full h-14 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#222222] placeholder:text-[#6a6a6a] focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 focus:outline-none transition-all sm:text-sm sm:leading-6 touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            value={password}
            onChange={handleChange}
          />
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-[#c13515]">{error}</p>
        )}

        {success && (
          <p role="status" className="mt-2 text-sm text-green-600">
            Contraseña actualizada correctamente
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending || success}
            className="w-full h-12 flex justify-center items-center border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-[#ff385c] hover:bg-[#e00b41] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff385c]/50 disabled:bg-[#ffd1da] disabled:cursor-not-allowed disabled:opacity-100 transition-colors touch-manipulation min-h-[48px]"
          >
            {pending ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
}