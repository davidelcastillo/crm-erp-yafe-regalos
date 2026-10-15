/**
 * RTL tests for ForgotPasswordForm (src/app/forgot-password/ForgotPasswordForm.tsx).
 *
 * Covers the auth-password-reset spec scenarios:
 *   - invalid email -> validation error shown, requestPasswordReset NOT called
 *   - valid email -> requestPasswordReset called + generic anti-enumeration message
 *   - the form never reveals whether the email exists (identical generic message)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPasswordForm from './ForgotPasswordForm';

const mockRequestPasswordReset = jest.fn();

jest.mock('@/actions/auth.reset', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestPasswordReset.mockResolvedValue({ success: true });
});

describe('ForgotPasswordForm', () => {
  it('shows a validation error without calling the action for an invalid email', async () => {
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'abc' },
    });
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo electrónico inválido');
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('calls requestPasswordReset and shows the generic anti-enumeration message for a valid email', async () => {
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1));
    const sentFormData = mockRequestPasswordReset.mock.calls[0][0] as FormData;
    expect(sentFormData.get('email')).toBe('user@example.com');

    // La acción es asíncrona: hay que esperar el estado final, no solo la llamada.
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña'
    );
    // No error alert is revealed after the request.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the form after a successful submission (prevents double submit)', async () => {
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      expect(screen.getByLabelText(/correo electrónico/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    });
  });
});