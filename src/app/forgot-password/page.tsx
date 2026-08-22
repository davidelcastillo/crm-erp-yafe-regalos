import type { Metadata } from 'next';
import ForgotPasswordForm from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Recuperar contraseña - Feria Conexx',
  description: 'Solicitá un enlace para restablecer tu contraseña',
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-8">
      <div className="w-full bg-white rounded-xl shadow-md p-6 space-y-6 sm:w-[400px]">
        <h2 className="text-2xl font-bold text-center text-[#222222]">
          Recuperar Contraseña
        </h2>
        <p className="text-center text-sm text-[#6a6a6a]">
          Ingresá el correo de tu cuenta y te enviaremos un enlace para restablecer la contraseña.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}