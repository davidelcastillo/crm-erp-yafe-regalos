'use server';

import { createServerClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validations/auth';

export type ActionResult = {
  success: boolean;
  redirectTo?: string;
  error?: string;
};

/**
 * Dedicated login for the branch portal (/sucursal/[branchId]/login).
 *
 * Signs the user in and then verifies that the authenticated session actually
 * belongs to the branch in the URL. If the role is not `branch_user` or the
 * branchId claim does not match the URL branchId, the session is discarded and
 * a generic error is returned (no redirect to the inventory).
 */
export async function loginBranch(
  formData: FormData,
  branchIdFromUrl: number
): Promise<ActionResult> {
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;

  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    return {
      success: false,
      error: 'Credenciales no válidas para esta sucursal',
    };
  }

  const { email: validatedEmail, password: validatedPassword } = result.data;

  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedEmail,
      password: validatedPassword,
    });

    if (error || !data.user) {
      console.error('Branch portal sign-in error:', error?.message ?? 'No user returned');
      return {
        success: false,
        error: 'Credenciales no válidas para esta sucursal',
      };
    }

    const role = data.user.app_metadata?.role;
    const claimBranchId = data.user.app_metadata?.branchId;

    if (role !== 'branch_user' || Number(claimBranchId) !== branchIdFromUrl) {
      // The credentials are valid but do not belong to this branch. Discard the
      // session so a branch user cannot keep a central session, then fail.
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Credenciales no válidas para esta sucursal',
      };
    }

    return {
      success: true,
      redirectTo: `/sucursal/${branchIdFromUrl}/inventory`,
    };
  } catch (err) {
    console.error('Unexpected error during branch sign-in:', err);
    return {
      success: false,
      error: 'Ocurrió un error inesperado',
    };
  }
}
