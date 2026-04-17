Jarvis, el módulo de productos va por buen camino, pero necesitamos aplicar un hotfix en la UI y mejorar la experiencia de usuario antes de avanzar.

Por favor, ejecuta las siguientes tareas:

Corrección del Modal (z-index fix): El Bottom Sheet de creación de productos está colisionando visualmente con la barra de navegación inferior. Ajusta el componente del modal para que tenga una posición fixed y un z-index superior (por ejemplo, z-50 o mayor) garantizando que se superponga absolutamente a todo, incluida la Bottom Nav Bar. Debe tener un fondo semitransparente oscuro (backdrop-blur recomendado) para aislar la acción.

Instalación de UI Alerts: Instala la librería sweetalert2 (y su integración sweetalert2-react-content si lo consideras necesario para Next.js).

Implementación de Alertas: Refactoriza el formulario de creación de productos (que es un Client Component) para que, al recibir la respuesta exitosa del Server Action, lance un SweetAlert de éxito estilizado ("Producto creado correctamente"). Si hay un error, debe lanzar un SweetAlert de error.

Desarrollo del Módulo de Compras (Ingresos): Ahora, construye la ruta /compras.

UI: Crea la tabla/lista de compras históricas con un botón principal para "Registrar Nueva Compra". Este botón debe lanzar un modal (con la misma corrección de capas que el anterior).

Modal de Compra: Debe incluir un selector (dropdown) con los productos registrados, un input numérico para el costo total y otro para la cantidad adquirida.

Lógica Transaccional (Crítico): Crea el Server Action registerPurchase. Este action debe utilizar una transacción de Prisma (prisma.$transaction) para asegurar dos cosas en una sola operación: crear el registro en la tabla Purchase y sumar la cantidad comprada al stock del Product correspondiente.

Actualización de Tests: Escribe un test de integración que verifique que el Server Action registerPurchase efectivamente aumenta el stock del producto en la base de datos.
