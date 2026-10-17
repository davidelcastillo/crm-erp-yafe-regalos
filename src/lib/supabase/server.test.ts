/**
 * Unit tests for the server Supabase client's cookie store
 * (src/lib/supabase/server.ts).
 *
 * El punto exacto del bug del «recordarme»: el proxy llama createServerClient()
 * sin override en cada request, y el refresh del token reescribía la cookie de
 * sesión con el default (1 hora), pisando la elección del usuario. Acá se fija
 * que el store mire la marca (cookie propia) cuando no hay override.
 */
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockGetAll = jest.fn(() => [] as { name: string; value: string }[]);

jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    getAll: () => mockGetAll(),
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
  }),
}));

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({ auth: {} })),
}));

import { createServerClient as ssrCreateServerClient } from "@supabase/ssr";
import { createServerClient } from "./server";
import {
  DEFAULT_SESSION_MAX_AGE,
  REMEMBER_ME_COOKIE,
  REMEMBER_ME_MAX_AGE,
  deriveStorageKey,
} from "./session";

const SUPABASE_URL = "https://abcdefgh.supabase.co";
const STORAGE_KEY = deriveStorageKey(SUPABASE_URL);

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAll.mockReturnValue([]);
});

/** setAll del último cliente creado, que es el que arma las cookies. */
function lastSetAll(): (cookies: { name: string; value: string; options: object }[]) => void {
  const calls = (ssrCreateServerClient as unknown as jest.Mock).mock.calls;
  return calls[calls.length - 1][2].cookies.setAll;
}

function sessionCookieWrite() {
  lastSetAll()([{ name: STORAGE_KEY, value: "token-value", options: {} }]);
}

describe("createServerClient cookie store", () => {
  it("writes the session cookie with 7 days when the remember-me mark is present", async () => {
    mockGet.mockReturnValue({ name: REMEMBER_ME_COOKIE, value: "1" });

    await createServerClient();
    sessionCookieWrite();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: STORAGE_KEY, value: "token-value", maxAge: REMEMBER_ME_MAX_AGE })
    );
    expect(mockGet).toHaveBeenCalledWith(REMEMBER_ME_COOKIE);
  });

  it("keeps the 1-hour default when there is no mark", async () => {
    mockGet.mockReturnValue(undefined);

    await createServerClient();
    sessionCookieWrite();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: STORAGE_KEY, maxAge: DEFAULT_SESSION_MAX_AGE })
    );
  });

  it("an explicit override wins over the mark", async () => {
    mockGet.mockReturnValue({ name: REMEMBER_ME_COOKIE, value: "1" });

    await createServerClient(DEFAULT_SESSION_MAX_AGE);
    sessionCookieWrite();

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: STORAGE_KEY, maxAge: DEFAULT_SESSION_MAX_AGE })
    );
  });

  it("never touches unrelated cookies", async () => {
    mockGet.mockReturnValue({ name: REMEMBER_ME_COOKIE, value: "1" });

    await createServerClient();
    lastSetAll()([{ name: "redirect-to", value: "/dashboard", options: {} }]);

    // Sin maxAge inyectado: las opciones de la cookie pasan tal cual.
    expect(mockSet).toHaveBeenCalledWith({ name: "redirect-to", value: "/dashboard" });
  });
});
