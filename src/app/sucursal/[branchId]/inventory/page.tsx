import { notFound } from 'next/navigation';
import { getExternalBranchInventory } from '@/app/actions/inventory.external';
import { getUserBranchId } from '@/lib/supabase/auth';
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

  // Get the user's branch ID from auth metadata
  const userBranchId = await getUserBranchId();
  
  // Check if user is authorized to view this branch's inventory
  // Branch users can only see their own branch
  // Admin users can see any branch (handled by middleware)
  if (userBranchId !== null && userBranchId !== branchId) {
    notFound();
  }

  // Fetch inventory for this branch (external portal format)
  // The action expects a { branchId } object (zod-validated)
  const inventoryResult = await getExternalBranchInventory({ branchId });
  
  if (!inventoryResult.success) {
    notFound();
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Inventario de la Sucursal #{branchId}
        </h1>
      </div>
      
      <div className="space-y-4">
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