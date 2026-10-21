// src/lib/auth-guard.ts
import { createServerClient } from "@/lib/supabase/server";

/**
 * Autorización de las Server Actions internas (AGENTS.md §0.2: sesión + rol
 * `admin`, y una redirección del proxy no autoriza nada por sí sola).
 *
 * El proxy protege la navegación; esto protege la acción, que es la única
 * frontera que no se puede saltear desde el cliente. El catálogo público
 * (`inventory.external.ts`) queda afuera a propósito: es de solo lectura y
 * `isPublic && isActive` lo decide la propia acción.
 */
export type AdminGuardResult =
  | { ok: true; email: string }
  | { ok: false; error: "No autorizado" };

const UNAUTHORIZED: AdminGuardResult = { ok: false, error: "No autorizado" };

/**
 * Devuelve `{ ok: true, email }` solo para una sesión válida con rol `admin`
 * en `app_metadata`. Cualquier otra cosa —sin sesión, otro rol, o el cliente
 * de Supabase fallando— es «No autorizado»: nunca se degrada a permitir.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return UNAUTHORIZED;
    if (user.app_metadata?.role !== "admin") return UNAUTHORIZED;

    return { ok: true, email: user.email ?? "" };
  } catch (error) {
    console.error("Error comprobando la sesión:", error);
    return UNAUTHORIZED;
  }
}
