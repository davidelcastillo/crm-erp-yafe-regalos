Jarvis, tenemos un nuevo requerimiento de alta prioridad: el cliente necesita un Módulo de Gestión de Clientes y Seguimiento de Deudas (Saldos). Esto implica trazabilidad total sobre quién nos debe y cuánto.

Por favor, ejecuta las siguientes tareas:

Actualización del Esquema (schema.prisma):

Modelo Customer: id, name, surname, totalBalance (Decimal, por defecto 0).

Modificación en Sale: Agrega una relación opcional con Customer (customerId puede ser null para ventas 'Anónimas'). Agrega los campos amountPaid (lo que pagó en el momento) y pendingBalance (la deuda generada en esa venta específica).

Modelo Payment: Para registrar cuando un cliente viene a pagar su deuda. Debe tener id, customerId, amount, date.

Nuevo Módulo de Clientes (Ruta /clientes):

UI: Tabla con búsqueda por nombre/apellido. Debe mostrar: Cliente, Total de Compras Realizadas y Saldo Deudor Total.

CRUD: Modal para dar de alta clientes (Nombre y Apellido).

Acción de Cobro: Un botón "Registrar Pago" que abra un modal para ingresar un monto. Este monto debe restar al totalBalance del cliente y crear un registro en la tabla Payment.

Actualización del Módulo de Ventas (Ruta /ventas):

Selector de Cliente: En el modal de venta, añade un buscador/dropdown para seleccionar un cliente. Incluye la opción "Cliente Anónimo" (por defecto).

Lógica de Pago Parcial: Añade un campo 'Monto Pagado'.

Cálculo Automático: El modal debe mostrar: Total Venta - Monto Pagado = Saldo Pendiente.

Lógica Transaccional: El Server Action registerSale ahora debe, dentro de la misma transacción de Prisma:

Crear la Venta y sus Items.

Si hay un pendingBalance y un cliente seleccionado, sumar ese monto al totalBalance del modelo Customer.

Detalle del Cliente:

Al hacer clic en un cliente, permite ver su historial: todas sus ventas asociadas y sus pagos realizados. Es vital para cuando el cliente pregunte: '¿Por qué te debo tanto?'.

Testing:

Escribe un test que verifique que, al realizar una venta de $1000 a un cliente 'X' pagando solo $400, el saldo del cliente en la base de datos suba exactamente a $600.
