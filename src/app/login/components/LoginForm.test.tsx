/**
 * RTL test for LoginForm.
 *
 * El formulario de login no debe ofrecer el acceso a restablecer la contraseña
 * (pedido del usuario: "sacar botón de olvidé mi contraseña"), y el resto del
 * formulario debe quedar igual.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from './LoginForm';

jest.mock('@/actions/auth', () => ({
  login: jest.fn(),
}));

import { login } from '@/actions/auth';

const mockLogin = login as jest.MockedFunction<typeof login>;

describe('LoginForm', () => {
  it('no ofrece el enlace para restablecer la contraseña', () => {
    render(<LoginForm />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('mantiene los campos, el recordarme y el botón de ingreso', () => {
    render(<LoginForm />);

    // Exactos: el botón del ojo también se llama «…contraseña» y un regex suelto
    // encontraría dos elementos.
    expect(screen.getByLabelText(/^correo electrónico$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /recordarme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('la leyenda de sesión iniciada va en un recuadro con fondo verde claro, no flotando', async () => {
    mockLogin.mockResolvedValue({ success: true, redirectTo: '/dashboard' } as never);
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/^correo electrónico$/i), { target: { value: 'admin@local.test' } });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    const leyenda = await screen.findByRole('status');
    expect(leyenda).toHaveTextContent('Inicio de sesión exitoso');
    // M4: el texto verde suelto quedaba flotando; el pedido es un div con
    // fondo verde claro (bg-positive en tinte suave).
    expect(leyenda.className).toContain('bg-positive');
  });
});
