'use server';

import { createServerClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations/auth';
import type { ActionResult } from '@/actions/auth';

/**
 * Derives the app origin from the request headers. Prefers the platform-set
 * x-forwarded-host / x-forwarded-proto (first value when the proto header is a
 * comma-separated list), falling back to the host header and https.
 */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? 'https';
  return `${proto}://${host}`;
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string | null;
  const result = forgotPasswordSchema.safeParse({ email });
  if (!result.success) {
    return { success: false, error: 'Correo electrónico inválido' };
  }

  try {
    const supabase = await createServerClient();
    const origin = await getOrigin();
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
      redirectTo,
    });
    if (error) {
      console.error('resetPasswordForEmail:', error.message);
    }
    // Anti-enumeration: identical success response whether or not the email exists.
    return { success: true };
  } catch (err) {
    console.error('Unexpected error in requestPasswordReset:', err);
    return { success: true };
  }
}

export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const password = formData.get('password') as string | null;
  const result = resetPasswordSchema.safeParse({ password });
  if (!result.success) {
    return {
      success: false,
      error: 'La contraseña debe tener al menos 8 caracteres',
    };
  }

  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.updateUser({ password: result.data.password });
    if (error) {
      console.error('updateUser:', error.message);
      return { success: false, error: 'No se pudo actualizar la contraseña' };
    }
    return { success: true, redirectTo: '/login' };
  } catch (err) {
    console.error('Unexpected error in updatePassword:', err);
    return { success: false, error: 'Ocurrió un error inesperado' };
  }
}