import LoginForm from '@/app/login/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-8">
      <div className="w-full bg-white rounded-xl shadow-md p-6 space-y-6 sm:w-[400px]">
        <h2 className="text-2xl font-bold text-center text-[#222222]">
          Iniciar Sesión
        </h2>
        <LoginForm />
      </div>
    </main>
  );
}