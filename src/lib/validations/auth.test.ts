import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth';

describe('loginSchema', () => {
  it('should accept a valid email and password (at least 8 characters)', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject an invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a password too short (less than 8 characters)', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '123',
    });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('should accept a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('should reject an invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'invalid-email' });
    expect(result.success).toBe(false);
  });

  it('should reject a missing email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('should accept a password with at least 8 characters', () => {
    const result = resetPasswordSchema.safeParse({ password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('should reject a password shorter than 8 characters', () => {
    const result = resetPasswordSchema.safeParse({ password: '1234567' });
    expect(result.success).toBe(false);
  });
});