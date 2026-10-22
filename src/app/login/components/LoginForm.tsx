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
  const [showPassword, setShowPassword] = useState(false);
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
          router.push(actionResult.redirectTo || '/dashboard');
        }, 1500);
} else {
         setError(actionResult.error || 'Credenciales inválidas');
       }
    } catch (err) {
      setError('Error inesperado al iniciar sesión');
    }
  };

  return (
    <div className="flex-1 w-full max-w-md mx-auto px-6 pt-8 pb-6 flex flex-col z-10 relative">
        <h2 className="text-3xl font-bold text-ink text-center mb-8">Bienvenida Estefi!</h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4 mb-6">
            {/* Input Username (Translúcido) */}
            <div className="bg-surface/60 backdrop-blur-md border border-white/80 rounded-full px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex items-center transition-all focus-within:bg-surface/80 focus-within:border-accent/30">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Correo electrónico"
                aria-label="Correo electrónico"
                className="w-full bg-transparent outline-none text-ink placeholder-ink-muted font-medium"
                value={formState.email}
                onChange={handleChange}
              />
            </div>

            {/* Input Password (Translúcido) */}
            <div className="bg-surface/60 backdrop-blur-md border border-white/80 rounded-full px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex items-center justify-between transition-all focus-within:bg-surface/80 focus-within:border-accent/30">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Contraseña"
                aria-label="Contraseña"
                className="w-full bg-transparent outline-none text-ink placeholder-ink-muted font-medium"
                value={formState.password}
                onChange={handleChange}
              />
              {/* Ojo para ver contraseña: sin `type="button"` el navegador lo toma
                  como submit y enviaba el formulario al tocarlo. */}
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                className="text-ink-soft hover:text-accent transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
            </div>
          </div>

          {/* Recordarme y Olvidé contraseña */}
          <div className="flex justify-between items-center mb-10 px-2 text-sm">
            <label className="flex items-center gap-2 text-ink-muted cursor-pointer font-medium">
              {/* Un pequeño toque: acento rosa en el checkbox */}
              <input
                type="checkbox"
                name="remember-me"
                className="accent-pink-500 w-4 h-4 cursor-pointer"
              />
              Recordarme
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-sm text-error">{error}</p>
          )}

          {success && (
            <p role="status" className="mt-2 text-sm text-positive">{success}</p>
          )}
          {/* Botón de Login: en celular se hunde un poco al tocarlo (feedback táctil). */}
          <button 
          type="submit"
          disabled={pending}
          className="w-full py-4 rounded-full border-2 border-accent text-accent font-bold text-lg hover:bg-accent hover:text-white active:scale-[0.98] active:bg-accent active:text-white transition-all mb-6 shadow-sm touch-manipulation">
            {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
          
        </form>
      </div>
    // <div className="w-full max-w-md">
    //   <form className="space-y-6" onSubmit={handleSubmit}>
    //     <div>
    //       <label htmlFor="email" className="block mb-2 text-sm font-medium text-ink-muted">
    //         Correo electrónico
    //       </label>
    //       <input
    //         id="email"
    //         name="email"
    //         type="email"
    //         autoComplete="email"
    //         required
    //         className="block w-full h-14 rounded-xl border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none transition-all sm:text-sm sm:leading-6"
    //         value={formState.email}
    //         onChange={handleChange}
    //       />
    //     </div>

    //     <div>
    //       <label htmlFor="password" className="block mb-2 text-sm font-medium text-ink-muted">
    //         Contraseña
    //       </label>
    //       <input
    //         id="password"
    //         name="password"
    //         type="password"
    //         autoComplete="current-password"
    //         required
    //         className="block w-full h-14 rounded-xl border border-hairline bg-surface px-3 py-2 text-sm font-medium text-ink placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none transition-all sm:text-sm sm:leading-6"
    //         value={formState.password}
    //         onChange={handleChange}
    //       />
    //     </div>

    //     {error && (
    //       <p role="alert" className="mt-2 text-sm text-error">{error}</p>
    //     )}

    //     {success && (
    //       <p role="status" className="mt-2 text-sm text-positive">{success}</p>
    //     )}

    //     <div className="flex items-center">
    //       <div className="flex items-start">
    //         <div className="flex items-center h-5">
    //           <input
    //             id="remember-me"
    //             name="remember-me"
    //             type="checkbox"
    //             className="h-5 w-5 text-accent focus:ring-accent border-hairline rounded"
    //           />
    //         </div>
    //         <div className="ml-3 text-sm">
    //           <label htmlFor="remember-me" className="font-medium text-ink">
    //             Recordarme
    //           </label>
    //         </div>
    //       </div>
    //     </div>

    //     <div>
    //       <button
    //         type="submit"
    //         disabled={pending}
    //         className="w-full h-12 flex justify-center items-center border border-transparent text-sm font-medium rounded-xl shadow-sm brand-gradient brand-gradient-hover text-ink focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    //       >
    //         {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
    //       </button>
    //     </div>
    //   </form>
    // </div>
  );
}