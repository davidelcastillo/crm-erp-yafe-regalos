/**
 * @jest-environment node
 *
 * Guardián de las Server Actions internas: solo una sesión con rol `admin`
 * pasa. Nada degrada a permitir (sin sesión, otro rol o el cliente de Supabase
 * fallando dan «No autorizado»).
 */
import { createServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createServerClient: jest.fn(),
}));

// `jest.setup.ts` mockea el guardián como autorizado para las suites de negocio;
// acá se prueba el módulo real, así que se pide el original.
const { requireAdmin } = jest.requireActual("./auth-guard") as typeof import("./auth-guard");

const mockCreateServerClient = createServerClient as jest.Mock;

const withUser = (user: unknown) =>
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("requireAdmin", () => {
  it("deja pasar a una sesión con rol admin y devuelve su email", async () => {
    withUser({ email: "admin@feria.test", app_metadata: { role: "admin" } });

    await expect(requireAdmin()).resolves.toEqual({
      ok: true,
      email: "admin@feria.test",
    });
  });

  it("rechaza cuando no hay sesión", async () => {
    withUser(null);

    await expect(requireAdmin()).resolves.toEqual({
      ok: false,
      error: "No autorizado",
    });
  });

  it("rechaza a otro rol aunque tenga sesión", async () => {
    withUser({ email: "sucursal@feria.test", app_metadata: { role: "branch_user" } });

    await expect(requireAdmin()).resolves.toEqual({
      ok: false,
      error: "No autorizado",
    });
  });

  it("rechaza cuando la sesión no declara rol", async () => {
    withUser({ email: "nadie@feria.test", app_metadata: {} });

    await expect(requireAdmin()).resolves.toEqual({
      ok: false,
      error: "No autorizado",
    });
  });

  it("rechaza si el cliente de Supabase falla, en vez de permitir", async () => {
    mockCreateServerClient.mockRejectedValue(new Error("sin cookies"));

    await expect(requireAdmin()).resolves.toEqual({
      ok: false,
      error: "No autorizado",
    });
  });
});
