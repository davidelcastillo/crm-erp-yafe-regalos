Jarvis, los bugs críticos fueron neutralizados y el flujo de caja está asegurado. Es hora de darle visión estratégica al usuario construyendo el módulo final de nuestra arquitectura base: el Dashboard Interactivo (Ruta /dashboard o /).

Por favor, ejecuta las siguientes tareas para armar este panel de control:

Tarjetas de Resumen Global (Métricas Clave):

Crea un Server Action llamado getGlobalStats que calcule y devuelva:

Ingresos Totales: Suma de totalAmount de todas las ventas (Sales).

Egresos Totales: Suma de totalAmount de todas las compras (Purchases).

Ganancia Neta: Ingresos Totales - Egresos Totales. (Aplica color verde si es positivo, rojo si es negativo).

Cuentas por Cobrar: Suma de pendingBalance de todas las ventas, o la suma del totalBalance actual de todos los clientes.

Muestra estos datos en tarjetas (Cards) en la parte superior de la pantalla. En vista móvil, deben apilarse o formar un grid de 2x2.

Gráficos de Rendimiento (Recharts):

Instala la librería recharts.

Implementa un gráfico de barras simple usando el componente <ResponsiveContainer> (crucial para que no rompa la pantalla en celulares Android) que compare visualmente los Ingresos vs. los Egresos. Puedes agruparlos por los últimos 7 o 30 días si es posible.

Análisis Individual por Producto (Tabla Interactiva):

Crea una sección debajo del gráfico con un buscador o selector (dropdown) de productos.

Al seleccionar un producto, llama a un Server Action (getProductAnalytics) que calcule su rentabilidad específica:

Unidades compradas totales y costo promedio.

Unidades vendidas totales y precio de venta promedio.

Rentabilidad del Producto: (Ingresos totales por ese producto - Costos totales por ese producto).

Estabilidad y Serialización:

Recuerda la lección aprendida: asegúrate de aplicar la serialización profunda (parsear los Decimal a Number) en todos los cálculos financieros antes de enviarlos a los componentes cliente del Dashboard.

Testing de Lógica Financiera:

Crea un test unitario para la función que calcula la Ganancia Neta. Debe recibir un mock de compras y ventas, y devolver el número matemático exacto. Las matemáticas del negocio no pueden fallar.
