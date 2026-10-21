// scripts/backfill-admin-claim.mjs
// PRE-GATING tooling: run manually BEFORE admin-claim gating is enabled in the
// middleware. Sets app_metadata.role = 'admin' on the target admin user using
// the Supabase service role key. Idempotent (safe to re-run).
//
// Usage:
//   ADMIN_EMAIL=admin@dominio.com node scripts/backfill-admin-claim.mjs
//
// Target user: process.env.ADMIN_EMAIL, obligatorio. No hay fallback: el 2026-10-21
// una version que elegia "el primer usuario con email" le dio el rol admin a una
// cuenta de sucursal. Si el objetivo no es declarado, el script no escribe nada.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
  );
  process.exit(1);
}

if (!adminEmail) {
  console.error(
    "ADMIN_EMAIL is required: this script promotes exactly one declared user and never guesses.\n" +
      "Example: ADMIN_EMAIL=admin@dominio.com node scripts/backfill-admin-claim.mjs"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function resolveTargetUser() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;

  const users = data?.users ?? [];
  if (users.length === 0) {
    throw new Error("No users found in Supabase Auth");
  }

  const user = users.find((u) => u.email === adminEmail);

  if (!user) {
    throw new Error(`User with email "${adminEmail}" was not found`);
  }

  // Una cuenta de sucursal nunca se promueve: su rol lo escribe createBranchUser.
  if (user.app_metadata?.role === "branch_user") {
    throw new Error(
      `"${user.email}" es una cuenta de sucursal (branch_user); este script no la promueve a admin`
    );
  }

  return user;
}

try {
  const user = await resolveTargetUser();
  const label = user.email ?? user.id;
  console.log(`Backfilling admin claim for: ${label}`);

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { role: "admin" },
  });

  if (error) throw error;
  console.log(`Success: ${label} now has app_metadata.role = "admin"`);
} catch (err) {
  console.error("Backfill failed:", err?.message ?? err);
  process.exit(1);
}
