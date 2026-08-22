'use client';

import { useState } from 'react';
import { requestPasswordReset } from '@/actions/auth.reset';
import { forgotPasswordSchema } from '@/lib/validations/auth';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  const pending = status === 'sending';
  const success = status === 'success';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || success) return;

    // Validate with Zod first to give immediate feedback.
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setStatus('sending');
    try {
      const actionResult = await requestPasswordReset(new FormData(e.currentTarget));
      if (actionResult.success) {
        // Anti-enumeration: always show the same generic message.
        setStatus('success');
      } else {
        setError(actionResult.error || 'Ocurrió un error inesperado');
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
          <label htmlFor="email" className="block mb-2 text-sm font-medium text-[#6a6a6a]">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={success}
            className="block w-full h-14 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#222222] placeholder:text-[#6a6a6a] focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 focus:outline-none transition-all sm:text-sm sm:leading-6 touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            value={email}
            onChange={handleChange}
          />
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-[#c13515]">{error}</p>
        )}

        {success && (
          <p role="status" className="mt-2 text-sm text-green-600">
            Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending || success}
            className="w-full h-12 flex justify-center items-center border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-[#ff385c] hover:bg-[#e00b41] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff385c]/50 disabled:bg-[#ffd1da] disabled:cursor-not-allowed disabled:opacity-100 transition-colors touch-manipulation min-h-[48px]"
          >
            {pending ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </div>
      </form>
    </div>
  );
}