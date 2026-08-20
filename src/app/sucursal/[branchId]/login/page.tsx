import { notFound } from 'next/navigation';
import PortalLoginForm from './PortalLoginForm';

export const dynamic = 'force-dynamic';

export default async function BranchPortalLoginPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId: branchIdStr } = await params;
  const branchId = parseInt(branchIdStr, 10);

  if (isNaN(branchId)) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-8">
      <div className="w-full bg-white rounded-2xl shadow-md p-6 space-y-6 sm:w-[400px]">
        <h2 className="text-2xl font-bold text-center text-[#222222]">
          Portal de la Sucursal
        </h2>
        <p className="text-center text-sm text-[#6a6a6a]">
          Iniciá sesión para ver el inventario de la sucursal #{branchId}
        </p>
        <PortalLoginForm branchId={branchId} />
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Portal de Sucursal - Feria Conexx',
  description: 'Iniciá sesión en el portal de tu sucursal',
};
