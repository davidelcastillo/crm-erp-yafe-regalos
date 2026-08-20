// src/app/sucursales/page.tsx
import { getBranches } from "@/app/actions/branch";
import { BranchManager } from "@/components/ui/BranchManager";
import { hasUserRole } from "@/lib/supabase/auth";
import type { Branch } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  // Check if the current user is an admin
  const isAdmin = await hasUserRole('admin');
  
  // If not an admin, redirect to home or show an error
  if (!isAdmin) {
    // In a real app, you might want to redirect to an unauthorized page
    // For now, we'll return an empty branch list so the UI shows nothing
    // Or you could throw a redirect or error here
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 text-center py-12">
            No autorizado
          </h1>
          <p className="text-center text-gray-600">
            No tienes permiso para acceder a esta página
          </p>
        </div>
      </div>
    );
  }

  const result = await getBranches();
  const branches: Branch[] = result.success && result.data ? result.data : [];

  return (
    <div className="min-h-screen bg-white pb-20">
      <BranchManager branches={branches} />
    </div>
  );
}
