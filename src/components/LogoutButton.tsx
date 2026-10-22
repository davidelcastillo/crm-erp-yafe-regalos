'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/actions/auth';

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M12 2a2 2 0 00-2 2v7a4 4 0 004 4h2a4 4 0 004-4V4a2 2 0 00-2-2z"></path>
    <path d="M12 22v-4"></path>
    <path d="M12 18v-2"></path>
  </svg>
);

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const result = await logout();
      if (result.success) {
        // Redirect to the returned URL
        router.push(result.redirectTo ?? '/login');
      } else {
        console.error('Logout failed:', result.error);
        // In a real app, you might show a toast or error message.
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="
        flex items-center justify-center gap-2
        p-2 rounded-md
        hover:bg-surface-strong
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent
        transition-colors
        disabled:opacity-50
        disabled:cursor-not-allowed
      "
      title="Cerrar sesión"
    >
      {isLoading ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.989 8.989 0 014 16a9 9 0 1112 0zm1 0h.582m15.356-2A8.989 8.989 0 004 12a9 9 0 1012 0z" />
        </svg>
      ) : (
        <LogoutIcon />
      )}
    </button>
  );
}