export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:p-6">
      <div className="w-full max-w-xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">
          No autorizado
        </h1>
        <p className="mb-4 text-lg text-gray-600">
          No tienes permiso para acceder a esta página. Por favor, inicia sesión
          con una cuenta que tenga los permisos necesarios o contacta al
          administrador del sistema.
        </p>
        <div className="mt-8">
          <a
            href="/login"
            className="w-full inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'No autorizado - Feria Conexx',
  description: 'No tienes permiso para acceder a esta página',
};