/**
 * RTL test for LoginForm.
 *
 * El formulario de login no debe ofrecer el acceso a restablecer la contraseña
 * (pedido del usuario: "sacar botón de olvidé mi contraseña"), y el resto del
 * formulario debe quedar igual.
 */
import { render, screen } from '@testing-library/react';
import LoginForm from './LoginForm';

jest.mock('@/actions/auth', () => ({
  login: jest.fn(),
}));

describe('LoginForm', () => {
  it('no ofrece el enlace para restablecer la contraseña', () => {
    render(<LoginForm />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('mantiene los campos, el recordarme y el botón de ingreso', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /recordarme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });
});
