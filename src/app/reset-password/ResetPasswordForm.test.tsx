/**
 * RTL tests for ResetPasswordForm (src/app/reset-password/ResetPasswordForm.tsx).
 *
 * Covers the auth-password-reset spec scenarios:
 *   - password < 8 chars -> validation error shown, updatePassword NOT called
 *   - valid password -> updatePassword called + success message + router.push('/login')
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResetPasswordForm from './ResetPasswordForm';

const mockUpdatePassword = jest.fn();
const mockPush = jest.fn();

jest.mock('@/actions/auth.reset', () => ({
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePassword.mockResolvedValue({ success: true, redirectTo: '/login' });
});

describe('ResetPasswordForm', () => {
  it('shows a validation error without calling the action for a short password', async () => {
    render(<ResetPasswordForm />);

    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: 'short' },
    });
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña debe tener al menos 8 caracteres'
    );
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('calls updatePassword and redirects to /login after a successful update', async () => {
    render(<ResetPasswordForm />);

    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: 'NewPass123!' },
    });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledTimes(1));
    const sentFormData = mockUpdatePassword.mock.calls[0][0] as FormData;
    expect(sentFormData.get('password')).toBe('NewPass123!');

    expect(screen.getByRole('status')).toHaveTextContent(/contraseña/i);
    // Redirect happens after a brief delay so the success message is visible.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'), {
      timeout: 3000,
    });
  });
});