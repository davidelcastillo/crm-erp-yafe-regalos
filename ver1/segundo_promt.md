Excelente trabajo con el scaffolding inicial. Ahora vamos a darle vida al sistema enfocándonos en el Módulo de Productos (Alta) y estableciendo el estándar de calidad con nuestras primeras pruebas.

Por favor, ejecuta lo siguiente:

Prisma Client: Instancia el cliente de Prisma en un archivo centralizado (ej. lib/prisma.ts) siguiendo las mejores prácticas para Next.js en desarrollo (evitando múltiples instancias por el hot-reload).

Server Actions (Lógica de Negocio): Crea las Server Actions necesarias en actions/product.ts para manejar el CRUD de productos: createProduct, getProducts, updateProduct y deleteProduct. Usa Zod para validar que los datos de entrada sean correctos antes de tocar la base de datos.

UI Mobile-First (Ruta /productos): Construye la interfaz de la pantalla de productos. Recuerda las directivas del AGENTS.md:

Muestra una lista/grilla de tarjetas (Cards) con los productos existentes.

Implementa un botón flotante (FAB) o un botón principal muy accesible para "Nuevo Producto".

Al presionar el botón, despliega un modal estilo Bottom Sheet (hoja inferior) que pida el Nombre, Descripción y Cantidad inicial.

Testing Unitario e Integración: Siguiendo la nueva sección de testing del AGENTS.md, escribe las pruebas para este módulo:

Un test unitario para el componente del formulario de creación.

Un test de integración para el Server Action createProduct. Como dato de prueba en el test, simula la creación de un producto real, por ejemplo: Nombre: 'Jabón de Avena y Arroz', Descripción: 'Jabón artesanal exfoliante', Cantidad: 50.

Asegúrate de que los tests pasen correctamente y que la UI se vea perfecta en vista de celular.
