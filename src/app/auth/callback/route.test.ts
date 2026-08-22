/**
 * Unit tests for the /auth/callback route handler (src/app/auth/callback/route.ts).
 *
 * Covers the auth-password-reset spec scenarios:
 *   - code + valid next -> 307 redirect to the sanitized path
 *   - malicious next (https://evil.example) -> 307 redirect to /reset-password (open redirect blocked)
 *   - missing code -> redirect to /forgot-password
 *   - exchangeCodeForSession error -> redirect to /forgot-password
 *
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { GET } from './route';

const mockExchangeCodeForSession = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    },
  }),
}));

function mockRequest(pathname: string): NextRequest {
  const url = new URL(pathname, 'https://app.example.com');
  return {
    url: url.toString(),
    nextUrl: { searchParams: url.searchParams, origin: url.origin },
  } as unknown as NextRequest;
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it('redirects (307) to the sanitized next path after a successful exchange', async () => {
    const res = await GET(mockRequest('/auth/callback?code=pkce-code&next=/reset-password'));

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.example.com/reset-password');
  });

  it('blocks an absolute external next and falls back to /reset-password', async () => {
    const res = await GET(mockRequest('/auth/callback?code=pkce-code&next=https://evil.example'));

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.example.com/reset-password');
  });

  it('redirects to /forgot-password when the code is missing', async () => {
    const res = await GET(mockRequest('/auth/callback'));

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.example.com/forgot-password');
  });

  it('redirects to /forgot-password when the exchange fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid code' },
    });

    const res = await GET(mockRequest('/auth/callback?code=bad-code&next=/reset-password'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://app.example.com/forgot-password');
    consoleErrorSpy.mockRestore();
  });
});