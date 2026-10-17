// src/app/sucursales/page.tsx
import { getBranches } from "@/app/actions/branch";
import { BranchManager } from "@/components/ui/BranchManager";
import { PageHeader } from "@/components/ui/PageHeader";
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

  // La página no tiene acciones propias ni estado de carga: la lista llega del
  // servidor y el alta/edición vive dentro de `BranchManager`.
  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="pb-16 brand-gradient">
        <PageHeader title="Sucursales" />
      </div>

      <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <BranchManager branches={branches} />
      </div>
    </div>
  );
}
