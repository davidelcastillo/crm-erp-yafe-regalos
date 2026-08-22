/**
 * Unit tests for the password-reset server actions (src/actions/auth.reset.ts).
 *
 * Covers the auth-password-reset spec scenarios:
 *   - invalid email -> validation error WITHOUT calling resetPasswordForEmail
 *   - valid email -> resetPasswordForEmail(email, { redirectTo: '<origin>/auth/callback?next=/reset-password' })
 *   - anti-enumeration: identical { success: true } whether Supabase succeeds or errors
 *   - password < 8 chars -> validation error WITHOUT calling updateUser
 *   - valid password -> updateUser({ password }) -> { success: true, redirectTo: '/login' }
 *   - updateUser error -> { success: false, error: 'No se pudo actualizar la contraseña' }
 */
import { requestPasswordReset, updatePassword } from './auth.reset';

const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn().mockResolvedValue({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  }),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue(
    new Headers({
      'x-forwarded-host': 'app.example.com',
      'x-forwarded-proto': 'https',
    })
  ),
}));

function makeFormData(
  overrides: Partial<Record<'email' | 'password', string>> = {}
): FormData {
  const fd = new FormData();
  fd.set('email', overrides.email ?? 'user@example.com');
  fd.set('password', overrides.password ?? 'NewPass123!');
  return fd;
}

describe('requestPasswordReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('rejects an invalid email without calling Supabase', async () => {
    const result = await requestPasswordReset(makeFormData({ email: 'abc' }));

    expect(result).toEqual({
      success: false,
      error: 'Correo electrónico inválido',
    });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('calls resetPasswordForEmail with the origin-based redirectTo for a valid email', async () => {
    const result = await requestPasswordReset(makeFormData({ email: 'user@example.com' }));

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://app.example.com/auth/callback?next=/reset-password',
    });
    expect(result).toEqual({ success: true });
  });

  it('returns the same success response when Supabase errors (anti-enumeration)', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'User not found' },
    });

    const result = await requestPasswordReset(makeFormData());

    expect(result).toEqual({ success: true });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('updatePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('rejects a password shorter than 8 characters without calling Supabase', async () => {
    const result = await updatePassword(makeFormData({ password: 'short' }));

    expect(result).toEqual({
      success: false,
      error: 'La contraseña debe tener al menos 8 caracteres',
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser and redirects to /login for a valid password', async () => {
    const result = await updatePassword(makeFormData({ password: 'NewPass123!' }));

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass123!' });
    expect(result).toEqual({ success: true, redirectTo: '/login' });
  });

  it('returns a generic error when updateUser fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: 'New password should be different from the old password.' },
    });

    const result = await updatePassword(makeFormData());

    expect(result).toEqual({
      success: false,
      error: 'No se pudo actualizar la contraseña',
    });
    consoleErrorSpy.mockRestore();
  });
});