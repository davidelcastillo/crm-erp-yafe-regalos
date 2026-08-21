'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Hide the app chrome on auth-only/error pages: the login and unauthorized
  // screens render standalone (same pattern as BottomNav on /sucursal/*).
  if (pathname === '/login' || pathname === '/unauthorized') {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    router.push('/login');
    setIsLoggingOut(false);
  };

  return (
    <nav className="bg-white border-gray-200 px-2 sm:px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Link href="/" className="text-xl font-semibold text-indigo-600">
          Seguimientos Compras
        </Link>
      </div>
      <div className="flex items-center space-x-3">
        {user ? (
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors
              ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        ) : (
          <Link href="/login" className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
            Iniciar sesión
          </Link>
        )}
      </div>
    </nav>
  );
}