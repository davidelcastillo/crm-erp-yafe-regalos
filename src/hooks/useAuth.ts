'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUser, login, logout } from '@/actions/auth';
import type { ActionResult } from '@/actions/auth';

export function useAuth() {
  const [user, setUser] = useState<null | { email: string }>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Verify session on mount
  useEffect(() => {
    async function checkSession() {
      const userData = await getUser();
      setUser(userData ?? null);
      setLoading(false);
    }
    checkSession();
  }, []);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      const result: ActionResult = await login(formData);
      if (result.success) {
        // Reload session
        const userData = await getUser();
        setUser(userData ?? null);
      }
      return result;
    },
    []
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  return { user, loading, login: handleLogin, logout: handleLogout, isAuthenticated: !!user };
}