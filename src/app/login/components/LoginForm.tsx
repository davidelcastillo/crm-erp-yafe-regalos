'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { login } from '@/actions/auth';
import { loginSchema } from '@/lib/validations/auth';

export default function LoginForm() {
  const [formState, setFormState] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { pending } = useFormStatus();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Validate with Zod first to give immediate feedback
    const result = loginSchema.safeParse(formState);
    if (!result.success) {
      const firstError = result.error.issues[0];
      setError(`${String(firstError.path[0])}: ${firstError.message}`);
      return;
    }

    try {
      // Build the FormData from the actual form (inputs have name="email"/"password")
      const actionResult = await login(new FormData(e.currentTarget));
      if (actionResult.success) {
        setSuccess('Inicio de sesión exitoso');
        // Redirect after a short delay to show success message
        setTimeout(() => {
          router.push(actionResult.redirectTo || '/');
        }, 1500);
} else {
         setError(actionResult.error || 'Credenciales inválidas');
       }
    } catch (err) {
      setError('Error inesperado al iniciar sesión');
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
            className="block w-full h-14 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#222222] placeholder:text-[#6a6a6a] focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 focus:outline-none transition-all sm:text-sm sm:leading-6"
            value={formState.email}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="password" className="block mb-2 text-sm font-medium text-[#6a6a6a]">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="block w-full h-14 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#222222] placeholder:text-[#6a6a6a] focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/20 focus:outline-none transition-all sm:text-sm sm:leading-6"
            value={formState.password}
            onChange={handleChange}
          />
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-[#c13515]">{error}</p>
        )}

        {success && (
          <p role="status" className="mt-2 text-sm text-green-600">{success}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-5 w-5 text-[#ff385c] focus:ring-[#ff385c] border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="remember-me" className="font-medium text-[#222222]">
                Recordarme
              </label>
            </div>
          </div>

          <div className="text-sm">
            <a
              href="#"
              className="font-medium text-[#ff385c] hover:text-[#e00b41]"
            >
              Olvidé mi contraseña
            </a>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full h-12 flex justify-center items-center border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-[#ff385c] hover:bg-[#e00b41] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff385c]/50 disabled:bg-[#ffd1da] disabled:cursor-not-allowed disabled:opacity-100 transition-colors"
          >
            {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </div>
      </form>

<p className="mt-4 text-sm text-center text-[#6a6a6a]">
         ¿No tienes una cuenta?
         <a
           href="/register"
           className="font-medium text-[#ff385c] hover:text-[#e00b41]"
         >
           Regístrate aquí
         </a>
       </p>
    </div>
  );
}