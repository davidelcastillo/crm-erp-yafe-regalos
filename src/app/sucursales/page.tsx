// src/app/sucursales/page.tsx
import { getBranches } from "@/app/actions/branch";
import { BranchManager } from "@/components/ui/BranchManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandBand } from "@/components/ui/BrandBand";
import type { Branch } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  // El proxy ya protege las rutas internas (solo admins llegan acá).
  // NO llamar hasUserRole aquí: getUser() dispara el refresh de sesión y
  // escribir cookies no está permitido en un Server Component en render
  // (Next 16: "Cookies can only be modified in a Server Action or Route
  // Handler"). Ese refresh debe ocurrir en el middleware (proxy.ts).

  const result = await getBranches();
  const branches: Branch[] = result.success && result.data ? result.data : [];

  // La única acción es el acceso a /clientes, que salió de la barra inferior (S6):
  // botón en la barra desde desktop y fila en el menú ☰ en celular.
  // La lista llega del servidor y el alta/edición vive dentro de `BranchManager`.
  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Server Component: la banda de movimiento (S10/S11) vive en `BrandBand`. */}
      <BrandBand
        header={
          <PageHeader
            title="Sucursales"
            actions={
              <Link href="/clientes" className="btn btn-primary">
                Clientes
              </Link>
            }
            menuItems={[{ label: "Clientes", href: "/clientes" }]}
          />
        }
      />

      <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <BranchManager branches={branches} />
      </div>
    </div>
  );
}
