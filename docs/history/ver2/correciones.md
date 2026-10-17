A continuación se detallaran las cosas que aun no funcionan :
## Modulo de Compras
- 1. Al momento de registrar una compra, cuando se quiere ingresar un producto nuevo mediante el Componente ProductCards (que permite crear un producto), lo que ocurre es que se ve todo el fondo negro, osea todo lo que queda fuera de ese componente, antes no se veia así, la logica esta correcta, eso no hay que modificar nada, solo que se vea el fondo blanco en blur como los demas componentes.
## Modulo de Ventas
- 1. Al momento de registrar una venta, si se elije como metodo de pago 'Transferencia', no sale la opcion para pagar un total, es decir el boton que esta al lado de saldo pendiente no sale, como así tampoco el selector para seleccionar cuanto se pago. Archivo 'AddSaleButton.tsx' linea 397 en adelante, modificar el saldo pendiente para cualquier metodo de pago.
## Modulo de Inventario
- 1. Lo primero es que al momento de intentar entrar al Componente de Imprimir Etiquetas, no se puede, directamente el boton no hace nada.
- 2. Se pide una nueva funcionalidad : Agregar un pequeño apartado, que por cada producto se puedan ver los moviemientos de ese producto, es decir, si se ingreso, se vendio, se compro o se modifico directamente por algun lado, esto para asegurar trazabilidad.
## Imprimir Etiquetas
-  1.  EN el componente de las etiquetas, el Input que esta debajo de Buscar Producto, no funciona, si escirbo el codigo o el nombre de un producto me dice 'No se Encontraron productos', parece ser que ese componente no esta llamando correctamente al listado de productos disponibles, Las demas funcionalidades no se si andan ya que al no permitirme elegir algun producto, no puedo imprimir las etiquetas y no puedo probar nada mas.
