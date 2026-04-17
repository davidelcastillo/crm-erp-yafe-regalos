Jarvis, necesitamos aplicar un hotfix (Parche 7.2) en el Módulo de Clientes porque tenemos dos bugs bloqueantes.

Por favor, ejecuta las siguientes correcciones:

Hotfix de Validación de Pagos (Error 'mayor a 0'):

El Server Action de registrar pagos está fallando porque recibe un string del formulario en lugar de un número.

Solución: En tu esquema de validación de Zod para el pago, asegúrate de usar z.coerce.number() en el campo del monto. Ejemplo: amount: z.coerce.number().positive('El pago debe ser mayor a 0'). Revisa también que el <input> del modal tenga type="number" y step="0.01".

Implementación del Historial del Cliente (UI y Lógica):

Actualmente no se puede ver el historial de un cliente. Necesitamos que al hacer clic en un cliente de la tabla, se despliegue su información detallada.

Lógica: Crea un Server Action getCustomerHistory(customerId) que haga una consulta a Prisma buscando al cliente e incluyendo sus ventas y pagos: include: { sales: { orderBy: { date: 'desc' } }, payments: { orderBy: { date: 'desc' } } }. Recuerda parsear los valores Decimal a number antes de retornarlos al cliente.

UI (Mobile-First): Implementa un Modal tipo Bottom Sheet (o un componente de fila expandible 'Accordion' dentro de la misma tabla) que se abra al tocar un cliente.

Este detalle debe mostrar dos pestañas o listas separadas:

Historial de Ventas: Fecha, Monto Total y Saldo Pendiente de cada venta.

Historial de Pagos: Fecha y Monto de cada abono realizado.

Asegúrate de probar que el pago de $2500 ahora pase correctamente y se refleje en la resta del saldo deudor del cliente

Asegurate de correr los test adecuados para verificar correctamente la implementacion de los cambios solicitados

Primero piensa el problema y luego implementa la solucion, no intentes adivinar, si no estas seguro de algo, pregunta
