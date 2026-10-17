// src/app/sucursales/[id]/page.tsx
import { redirect } from "next/navigation";
import { getBranches } from "@/app/actions/branch";
import { BranchManager } from "@/components/ui/BranchManager";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Branch } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Detail/edit page for a single branch. Rather than duplicating the
 * management UI, we forward to the unified BranchManager on /sucursales
 * which already supports inline editing for any branch.
 */
export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Validate id is numeric; the BranchManager renders the full list
  if (Number.isNaN(Number.parseInt(id, 10))) {
    redirect("/sucursales");
  }

  const result = await getBranches();
  const branches: Branch[] = result.success && result.data ? result.data : [];

  // If no branches exist, just show the manager (empty state)
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
