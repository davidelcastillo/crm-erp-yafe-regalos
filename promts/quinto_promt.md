Jarvis, la actualización de las compras quedó perfecta. Ahora necesitamos aplicar esa misma arquitectura simétrica al Módulo de Ventas (Egresos) para que el comercio pueda facturar múltiples productos en una sola transacción.

Por favor, ejecuta lo siguiente:

Evolución del Esquema de Ventas (Multi-producto): > \* Modifica el modelo Sale (Cabecera) en schema.prisma para que contenga: id, date, totalAmount (el monto total cobrado).

Crea el modelo SaleItem (Detalle) que pertenezca a un Sale y a un Product. Debe contener: id, saleId, productId, price (precio de venta unitario aplicado en ese momento), quantity y subtotal.

Ejecuta la actualización de la base de datos correspondiente.

Refactorización del Modal de Ventas (Ruta /ventas):

Al igual que en compras, transforma el modal en un formulario dinámico estilo 'carrito'.

Incluye el botón "Agregar otro producto" para sumar filas.

El modal debe calcular y mostrar el Subtotal por producto y el Total final a cobrar en tiempo real.

Asegúrate de mantener el z-index alto y usar sweetalert2 para las confirmaciones, tal como lo hicimos en productos y compras.

Lógica Transaccional de Ventas (Crítico y Seguridad):

Crea o actualiza el Server Action registerSale para procesar el array de productos.

Paso de Validación: Antes de iniciar la transacción, el action debe consultar la base de datos para verificar que haya stock suficiente para cada producto solicitado. Si alguno no tiene stock, debe abortar inmediatamente y retornar un error claro.

Dentro del prisma.$transaction: 1) Crea el Sale, 2) Crea los SaleItems, y 3) Resta la cantidad vendida al stock de cada producto correspondiente.

Mejoras de UI en el Historial de Ventas (Estética):

En la tabla principal de ventas muestra: Fecha, Cantidad de Items Diferentes, y Total de la Venta.

Contraste visual: A diferencia de las compras, el saldo total de cada registro de venta debe renderizarse en color verde (ej. text-green-700 en Tailwind) y precedido por un signo positivo (+), representando un ingreso de dinero al comercio. Ejemplo: + $15,400.00.

Incluye la capacidad de desplegar una venta para ver la lista de SaleItems asociados con sus respectivos precios, cantidades y subtotales.

Testing Unitario/Integración: > \* Escribe una prueba que intente registrar una venta con una cantidad mayor al stock disponible de un producto, asegurando que el Server Action la rechace y no altere la base de datos.
