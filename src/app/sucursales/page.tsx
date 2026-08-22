// src/app/sucursales/page.tsx
import { getBranches } from "@/app/actions/branch";
import { BranchManager } from "@/components/ui/BranchManager";
import type { Branch } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  // El proxy ya protege las rutas internas (solo admins llegan acá).
  // NO llamar hasUserRole aquí: getUser() dispara el refresh de sesión y
  // escribir cookies no está permitido en un Server Component en render
  // (Next 16: "Cookies can only be modified in a Server Action or Route
  // Handler"). Ese refresh debe ocurrir en el middleware (proxy.ts).

  const result = await getBranches();
  const branches: Branch[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-white pb-20">
      <BranchManager branches={branches} />
    </div>
  );
}
