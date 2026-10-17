Jarvis, necesitamos aplicar unos parches críticos de serialización y hacer un 'upgrade' importante a la lógica de negocios del Módulo de Compras.

Por favor, ejecuta las siguientes tareas paso a paso:

Hotfix de Serialización (Error Decimal): El sistema está arrojando el error 'Only plain objects can be passed to Client Components... Decimal objects are not supported'.

Solución: En todos tus Server Actions (como getProducts, getPurchases, etc.), asegúrate de mapear y convertir los valores Decimal y las Fechas (Date) que provienen de Prisma a tipos nativos (number y string ISO) antes de retornarlos a los Client Components. Puedes crear una función utilitaria parsePrismaData para esto.

Evolución del Esquema (Multi-producto): El dueño del comercio necesita cargar múltiples productos en un solo movimiento de compra. Actualiza el schema.prisma:

Modifica Purchase (Cabecera) para que contenga: id, date, totalAmount (el costo total de toda la transacción).

Crea un nuevo modelo PurchaseItem (Detalle) que pertenezca a un Purchase y contenga: id, purchaseId, productId, price (precio unitario en ese momento), quantity y subtotal.

Ejecuta la actualización de la base de datos correspondiente (ej. npx prisma db push o migrate).

Refactorización del Modal de Compras: > \* El modal debe convertirse en un formulario dinámico (tipo 'carrito').

Agrega un botón "Agregar otro producto" que añada una nueva fila al formulario.

Cada fila debe tener: Selector de Producto, Precio de Compra y Cantidad.

El modal debe mostrar dinámicamente el Subtotal por fila y el Total general de la compra en tiempo real.

Refactorización de la Lógica Transaccional:

Actualiza el Server Action registerPurchase. Ahora debe recibir un array de productos.

Dentro de un bloque prisma.$transaction, debes: 1) Crear el registro padre Purchase, 2) Crear todos los registros hijos PurchaseItem asociados, y 3) Sumar el stock correspondiente a cada uno de los productos involucrados.

Mejoras de UI en el Historial de Compras (Estética):

En la tabla de resumen de compras, actualiza las columnas para mostrar: Fecha, Cantidad de Items Diferentes, y Total de la Compra.

Crítico visual: El saldo total de cada registro de compra debe renderizarse en color rojo oscuro (ej. text-red-800 en Tailwind) y estar precedido por un signo negativo, simulando una salida de dinero. Ejemplo: - $11,400.00.

Si el usuario despliega o hace clic en una compra, debe poder ver la lista de PurchaseItems con el precio de cada producto, su subtotal y el total de la compra.
