import LoginForm from '@/app/login/components/LoginForm';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-pink-50 flex flex-col font-sans relative overflow-hidden">
      {/* 1. HEADER CON GRADIENTE Y ONDA SVG */}
      <div className="relative bg-gradient-to-r from-blue-200 to-pink-400 pt-20 pb-26 flex flex-col items-center justify-center z-10">
        
        {/* Tu Logo (con estilo cristal para que combine) */}
        <div className="w-16 h-16 bg-surface/30 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 shadow-lg border border-white/50 relative overflow-hidden">
          <Image
            src="/logo.webp"
            alt="Logo Feria Conexx"
            fill
            sizes="4rem"
            className="object-contain p-1" // contain + padding para que respire
            priority
            unoptimized
          />
        </div>
        <h1 className="text-white text-2xl font-bold tracking-wider">FERIA CONEXX</h1>

        {/* Separador de Onda (SVG Wave). 
            El fill="#fdf2f8" corresponde al color exacto de Tailwind para bg-pink-50 */}
        <div className="absolute bottom-0 w-full overflow-hidden leading-[0]">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[50px] md:h-[60px]">
            <path 
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.08,130.83,115.42,188.8,102.72,235.27,92.53,277.51,70.5,321.39,56.44Z" 
              fill="#fdf2f8"
            ></path>
          </svg>
        </div>
      </div>
      <LoginForm />
      {/* <div className="w-full bg-surface rounded-xl shadow-md p-6 space-y-6 sm:w-[400px]">
        <h2 className="text-2xl font-bold text-center text-ink">
          Iniciar Sesión
        </h2>
        <LoginForm />
      </div> */}
    </main>
  );
}