Jarvis, el motor transaccional de compras y ventas está funcionando a la perfección con su nueva arquitectura. Ahora vamos a construir el centro de mando del catálogo: el Módulo de Inventario (Ruta /inventario).

Por favor, ejecuta las siguientes tareas:

Interfaz Principal de Inventario (UI Mobile-First):

Crea la página en /inventario que muestre una lista o grilla de todos los productos y su stock actual.

Implementa una Barra de Búsqueda en la parte superior. Debe filtrar los productos en tiempo real por nombre (puedes usar estado en el cliente o los searchParams de Next.js, lo que resulte más fluido).

Usa indicadores visuales para el stock: Si el stock es 0 o menor a 5, muestra el número en rojo o con una etiqueta de "Stock Bajo".

Funcionalidad de Edición:

Cada tarjeta/fila de producto debe tener un botón de "Editar".

Al hacer clic, lanza un Modal (recordando usar posición fixed, z-50 y backdrop-blur) que permita modificar únicamente los datos básicos: Nombre y Descripción.

Regla de Negocio: El stock NO debe poder editarse manualmente desde aquí. El stock es sagrado y solo se modifica a través de compras o ventas para mantener la integridad contable.

Usa sweetalert2 para confirmar el éxito de la edición.

Funcionalidad de Eliminación y Seguridad Relacional (Crítico):

Agrega un botón de "Eliminar" (ícono de papelera, color rojo) por cada producto.

Al hacer clic, lanza un SweetAlert2 de confirmación (showCancelButton: true, advirtiendo la acción).

Lógica del Server Action deleteProduct: Antes de eliminar, el action DEBE verificar si el producto tiene historial en PurchaseItem o SaleItem.

Manejo de Errores: Si el producto tiene historial transaccional, rechaza la eliminación y devuelve un error ("No se puede eliminar un producto con historial de movimientos. Considera desactivarlo o cambiar su nombre"). Si no tiene historial, elimínalo de la base de datos de Prisma.

Actualización de Tests:

Escribe un test de integración para el Server Action deleteProduct que verifique la regla de seguridad: Intenta eliminar un producto que ya tiene una venta asociada y asegura que el sistema rechace la operación y proteja la base de datos.
