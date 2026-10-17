import { notFound } from 'next/navigation';
import { getExternalBranchInventory } from '@/app/actions/inventory.external';
import ExternalInventoryTable, {
  type InventoryItem,
} from '@/lib/components/ExternalInventoryTable';

export const dynamic = 'force-dynamic';

export default async function BranchInventoryPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId: branchIdStr } = await params;
  const branchId = parseInt(branchIdStr, 10);
  
  // Validate branchId is a number
  if (isNaN(branchId)) {
    notFound();
  }

  // Fetch inventory for this branch (external portal format)
  // The action expects a { branchId } object (zod-validated).
  // Visibility is decided inside getExternalBranchInventory: the catalog is
  // public only for branches with isPublic && isActive (same notFound for
  // non-public, inactive and non-existent branches — no existence leak).
  const inventoryResult = await getExternalBranchInventory({ branchId });
  
  if (!inventoryResult.success) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Catalogo publico: sin acciones de cuenta (no hay sesion en esta vista). */}
      <div className="pb-16 brand-gradient">
        <header className="px-3 pt-6">
          <div className="rounded-2xl glass-strong px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6a6a6a]">
              Catálogo
            </p>
            <h1 className="text-2xl font-bold text-[#222222]">
              Inventario de la sucursal
            </h1>
            <p className="text-sm text-[#6a6a6a]">
              {inventoryResult.branchName ?? `Sucursal #${branchId}`}
            </p>
          </div>
        </header>
      </div>

      <div className="glass rounded-t-[2.5rem] border-t border-white/80 -mt-12 px-5 pt-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <ExternalInventoryTable
          inventoryData={(inventoryResult.data || []) as unknown as InventoryItem[]}
        />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Inventario de Sucursal - Feria Conexx',
  description: 'Vista de solo lectura del inventario de una sucursal específica',
};