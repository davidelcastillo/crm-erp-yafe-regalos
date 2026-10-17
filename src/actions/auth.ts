'use server';

import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { loginSchema } from '@/lib/validations/auth';
import {
  DEFAULT_SESSION_MAX_AGE,
  REMEMBER_ME_COOKIE,
  REMEMBER_ME_COOKIE_VALUE,
  REMEMBER_ME_MAX_AGE,
} from '@/lib/supabase/session';

export type ActionResult = {
  success: boolean;
  redirectTo?: string;
  error?: string;
};

export async function login(formData: FormData): Promise<ActionResult> {
  // Validate input
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;

  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    // Return generic error to prevent user enumeration
    return {
      success: false,
      error: 'Invalid email or password',
    };
  }

  const { email: validatedEmail, password: validatedPassword } = result.data;

  // Recordarme: 'on' → 7-day session cookie; otherwise default 1 hour.
  const remember = formData.get('remember-me') === 'on';

  // Create Supabase server client. El default va explícito para que una marca
  // vieja de «recordarme» no alargue una sesión que el usuario pidió corta.
  const supabase = await createServerClient(
    remember ? REMEMBER_ME_MAX_AGE : DEFAULT_SESSION_MAX_AGE
  );

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedEmail,
      password: validatedPassword,
    });

    if (error) {
      // Handle specific Supabase errors but return generic message
      console.error('Supabase sign-in error:', error);
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Successful sign-in
    // Determine redirect by role: branch users go straight to their portal
    // inventory; admins use the redirect-to cookie or default to /dashboard.
    const cookieStore = await cookies();

    // La elección se guarda en su propia cookie (ver REMEMBER_ME_COOKIE): el
    // refresh del token reescribe la cookie de sesión y sin la marca volvería a
    // 1 hora. Al no marcarlo se borra, para no alargar una sesión corta.
    cookieStore.set(REMEMBER_ME_COOKIE, remember ? REMEMBER_ME_COOKIE_VALUE : '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: remember ? REMEMBER_ME_MAX_AGE : 0,
    });

    const redirectToCookie = cookieStore.get('redirect-to');

    const role = data.user?.app_metadata?.role;
    const claimBranchId = data.user?.app_metadata?.branchId;

    let redirectTo: string;
    if (role === 'branch_user' && typeof claimBranchId === 'number') {
      redirectTo = `/sucursal/${claimBranchId}/inventory`;
    } else {
      redirectTo = redirectToCookie?.value ?? '/dashboard';
    }

    // Clear the redirect-to cookie after use
    cookieStore.set('redirect-to', '', { expires: new Date(0) });

    return {
      success: true,
      redirectTo,
    };
  } catch (err) {
    console.error('Unexpected error during sign-in:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function logout(): Promise<ActionResult> {
  const supabase = await createServerClient();

  try {
    await supabase.auth.signOut();
    // signOut() clears the real session cookies (sb-<ref>-auth-token + chunks)
    // via the store's setAll with value '' / maxAge 0. No dead cookie here.
    const cookieStore = await cookies();
    cookieStore.set(REMEMBER_ME_COOKIE, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
    });

    return {
      success: true,
      redirectTo: '/login',
    };
  } catch (err) {
    console.error('Unexpected error during logout:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function getUser(): Promise<{ email: string } | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { email: user.email ?? '' };
}