Jarvis, el sistema base está operativo, pero necesitamos aplicar una actualización crítica de Experiencia de Usuario (UX) y optimizar el rendimiento del motor (Performance). El sistema se siente lento y el flujo de compras es tedioso si el producto no existe previamente.

Por favor, ejecuta las siguientes directivas de alto nivel:

Fase 1: Creación de Productos 'Inline' (Módulo de Compras)

Refactorización de la UI (Combobox): En el modal de compras, cambia el <select> tradicional de productos por un componente tipo 'Combobox' o 'Creatable Autocomplete'. El usuario debe poder escribir un nombre; si existe, lo selecciona. Si no existe, debe aparecer una opción que diga Crear "Nombre ingresado".

Actualización del Payload: El array de items que se envía al Server Action registerPurchase ahora puede contener items con un productId (existente) o con un newProductName (para crear en el momento).

Lógica Transaccional Inteligente: Actualiza el prisma.$transaction en registerPurchase. Por cada item en el array:

Si trae productId, procede normalmente sumando el stock.

Si trae newProductName, primero debes crear el registro en la tabla Product con ese nombre y el stock igual a la cantidad comprada. Luego, usa el ID de ese nuevo producto para crear el PurchaseItem.

Fase 2: Optimización Extrema de Rendimiento (Next.js 16)

Lazy Loading (next/dynamic): Los modales (especialmente los que usan SweetAlert) y el componente del gráfico de Recharts en el Dashboard son pesados. Importa estos componentes usando next/dynamic para que no bloqueen la carga inicial de la página.

Ejemplo: const PurchaseModal = dynamic(() => import('./PurchaseModal'), { ssr: false })

React Suspense y Skeletons: En todas las páginas (/compras, /ventas, /inventario, /clientes), envuelve las tablas de datos en <Suspense fallback={<TableSkeleton />}>. Queremos que la UI (barra de navegación, títulos) cargue instantáneamente, mientras los datos se resuelven visualmente con un skeleton.

Optimistic UI (Actualizaciones Instantáneas): En los modales, implementa el hook useOptimistic (o cierra el modal inmediatamente al hacer clic en 'Guardar' y muestra un Toast de 'Procesando...'). El usuario no debe quedarse mirando un modal congelado esperando a que Supabase responda.

Caché y Revalidación Correcta: Asegúrate de que tus Server Actions usen revalidatePath('/ruta-afectada') únicamente al final de una mutación exitosa para que Next.js actualice la tabla en segundo plano sin recargar la página entera.

Índices de Base de Datos: En el schema.prisma, agrega índices a las claves foráneas para acelerar las consultas relacionales, por ejemplo: @@index([productId]) en PurchaseItem y SaleItem, y @@index([customerId]) en Sale y Payment. Ejecuta un db push al terminar.
