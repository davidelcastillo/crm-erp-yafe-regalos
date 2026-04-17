# Project Overview

**Nombre:** Stark Commerce OS (Local Business Controller)
**Descripción:** Aplicación web _mobile-first_ optimizada para Android, diseñada para controlar de forma intuitiva los ingresos, egresos y el inventario general de un comercio local.
**Entorno:** Cloud (Next.js alojado en Vercel + Base de datos relacional en Supabase administrada a través de Prisma).

# Architecture & Modules

El agente debe estructurar la aplicación obligatoriamente en los siguientes 5 módulos principales:

1.  **Módulo de Productos (Alta):** Pantalla para registrar nuevos items en el sistema. Los datos requeridos son: `Nombre`, `Descripción` (Opcional) y `Cantidad` (Stock inicial).
2.  **Módulo de Compras (Ingresos):** Historial de compras presentadas en formato de tabla (adaptativa para móviles).
    - _Filtros:_ Por producto específico, ordenamiento ascendente/descendente y fechas.
    - _Acción Principal:_ Botón superior "Registrar Nueva Compra" que lanza un modal. El modal debe solicitar: selección de producto (dropdown de items existentes), precio de compra y cantidad.
3.  **Módulo de Ventas (Egresos):** Historial de ventas en formato de tabla sencilla.
    - _Filtros:_ Búsqueda, ordenamiento y fechas.
    - _Acción Principal:_ Botón superior "Registrar Nueva Venta" que lanza un modal. El modal debe solicitar: selección de producto, precio de venta y cantidad.
4.  **Módulo de Inventario:** Pantalla de gestión de stock en tiempo real.
    - Muestra un listado de productos junto al stock actual de cada uno, con barra de búsqueda y filtros.
    - _Acciones por producto:_ Botón "Editar" (lanza modal para modificar datos básicos) y botón "Eliminar" (con prompt de confirmación de seguridad).
5.  **Dashboard Interactivo:** Panel analítico y estadístico.
    - Muestra tarjetas resumen de datos globales de productos, ventas y compras.
    - _Tabla de Rendimiento:_ Componente interactivo donde el usuario selecciona un producto y la interfaz despliega su historial de compras, ventas y el cálculo automático de ganancias o pérdidas asociadas.

# Tech Stack

- **Framework:** Next.js 16 (App Router).
- **Base de Datos:** PostgreSQL (alojada en Supabase).
- **ORM:** Prisma.
- **Despliegue:** Vercel.
- **Lenguaje:** TypeScript.
- **Estilos:** Tailwind CSS.

# Skills (Mapas de Conocimiento)

El agente debe consultar obligatoriamente los archivos en estas rutas antes de implementar la funcionalidad correspondiente:

- **Next.js & App Router:** `skills/next-best-practices/app-router.md` (Para Server Components y Server Actions).
- **Prisma ORM Best Practices:** `skills/prisma-best-practices/schema-and-migrations.md`
- **Supabase PostgreSQL:** `agents/skills/supabase-postgres-best-practices/`
- **Mobile-First UI Design:** `skills/frontend-design/android-mobile-first.md` (Crucial para adaptar modales y tablas complejas a pantallas pequeñas sin perder usabilidad).
- **Vercel Deployment:** `skills/vercel-react-best-practices/`
- **Frontend Design:** `skills/frontend-design/`
- ui/ux design: `skills/ui-ux-design/`
- web development: `skills/web-development/`
- mobile design: `.agents/skills/mobile-design/`

# Data Structure Requirements (Prisma Schema)

El esquema de Prisma (`schema.prisma`) debe modelarse en base a estas tres entidades principales:

- **Product:** `id`, `name`, `description` (String opcional), `stock` (Int), `createdAt`, `updatedAt`.
- **Purchase:** `id`, `productId` (Relación a Product), `price` (Float/Decimal), `quantity` (Int), `date`.
- **Sale:** `id`, `productId` (Relación a Product), `price` (Float/Decimal), `quantity` (Int), `date`.

> **Directiva Crítica para Jarvis:** Toda inserción en la tabla `Purchase` debe aumentar el `stock` del `Product` correspondiente. Toda inserción en la tabla `Sale` debe disminuir dicho `stock`. Estas operaciones deben ejecutarse estrictamente utilizando Transacciones de Prisma (`prisma.$transaction`) para garantizar la consistencia de la base de datos en caso de fallos.

# Build and Test Commands

- **Instalar:** `npm install`
- **Configuración:** Crear archivo `.env` con las variables `DATABASE_URL` y `DIRECT_URL` de Supabase.
- **Sincronizar BD:** `npx prisma db push`
- **Generar Cliente:** `npx prisma generate`
- **Desarrollo:** `npm run dev`

# Code Style Guidelines

- **Tipado Fuerte:** Usar TypeScript estricto aprovechando los tipos generados por `@prisma/client`.
- **Enfoque Móvil:** Las tablas de datos deben transformarse visualmente en listas de tarjetas (Cards) en resoluciones menores a `md:` de Tailwind para asegurar una excelente experiencia en Android.
- **Componentes Modales:** En dispositivos móviles, los modales de altas/compras/ventas deben renderizarse idealmente como _Bottom Sheets_ (Hojas inferiores) que ocupen el 90% de la pantalla para facilitar el alcance del pulgar.
- **Diseño de Interfaces:** Revisar el archivo DESING.md para obtener pautas de diseño.

# Security Considerations

- **Validación de Inputs:** Todo dato enviado desde los formularios a los Server Actions debe ser validado con bibliotecas como Zod.
- **Integridad de Stock:** Prevenir mediante lógica de backend que una venta pueda procesarse si la `cantidad` solicitada es mayor al `stock` actual del producto (evitar stock negativo).

# Testing Strategy & Guidelines

El agente debe priorizar la calidad y estabilidad del software implementando pruebas automatizadas robustas. Seguiremos las mejores prácticas de la industria utilizando herramientas modernas compatibles con el entorno de Next.js:

- **Unit Testing (Lógica de Negocio y UI):** \* Utilizar Jest (o Vitest) en combinación con React Testing Library.
  - _Objetivo:_ Validar la correcta renderización de los componentes aislados (ej. asegurar que los modales de "Nueva Venta" muestran los campos correctos) y verificar que las funciones utilitarias (como los cálculos de ganancias/pérdidas del Dashboard) devuelvan los resultados matemáticos exactos.
- **Integration Testing (Server Actions & BD):**
  - Las Server Actions que interactúan con Supabase deben probarse rigurosamente.
  - _Objetivo:_ Validar que las transacciones de Prisma funcionen como se espera. Por ejemplo, al ejecutar la acción de "Registrar Compra", verificar mediante un test de integración que el stock del producto efectivamente incremente. Se debe utilizar un entorno de base de datos de pruebas aislado (test database) o mockear el cliente de Prisma.
- **End-to-End (E2E) Testing (Flujos Críticos):**
  - Emplear Playwright (o Cypress) configurado para emular _viewports_ de dispositivos móviles Android.
  - _Objetivo:_ Simular el viaje completo del usuario. Un flujo E2E obligatorio debe ser: "Acceder al sistema -> Crear un producto -> Registrar una venta -> Ir al Inventario y verificar que el stock disminuyó correctamente".
- **Convención de Archivos:** Los archivos de prueba deben ubicarse junto al componente/acción que evalúan (ej. `[nombre-componente].test.tsx`) o en un directorio centralizado `__tests__/`.

> **Directiva Crítica para Jarvis:** Todo nuevo módulo, componente interactivo complejo o Server Action debe ser entregado junto con su respectiva batería de pruebas. No se debe dar por finalizada ninguna característica ("feature") sin que los tests pasen exitosamente (`npm run test`).
