import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getUser } from '@/actions/auth';
import ResetPasswordForm from './ResetPasswordForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nueva contraseña - Feria Conexx',
  description: 'Definí una nueva contraseña para tu cuenta',
};

export default async function ResetPasswordPage() {
  // The PKCE token expires in ~1h; without a valid session the link is stale,
  // so the user is sent back to request a fresh reset.
  const user = await getUser();
  if (!user) {
    redirect('/forgot-password');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-8">
      <div className="w-full bg-white rounded-xl shadow-md p-6 space-y-6 sm:w-[400px]">
        <h2 className="text-2xl font-bold text-center text-[#222222]">
          Nueva Contraseña
        </h2>
        <p className="text-center text-sm text-[#6a6a6a]">
          Ingresá tu nueva contraseña para continuar.
        </p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}