/sdd-new "FASE 4 – Mejoras de UI, Filtros, Portal Externo y Exportación de Inventario por Sucursal (Wizard PDF) + Creación de Usuario de Sucursal al Registrar Sucursal"

# Change: FASE 4 – Mejoras de UI, Filtros, Portal Externo, Exportación de Inventario por Sucursal (Wizard PDF) + Creación Automática de Usuario de Sucursal al Crear una Sucursal

## Contexto
Proyecto: **Stark Commerce OS** (Next.js 16 App Router + Prisma + Supabase + Tailwind CSS v4)  
Estado actual: Tras la Fase 3 el sistema cuenta con:
- CRUD de sucursales y categorías.  
- Control de productos activos/inactivos.  
- Inventario con filtros de sucursal y categoría y botón **Mover Stock**.  
- Compras y ventas con asignación de stock por sucursal.  
- Dashboard con tarjetas personalizables (aún por implementar).  
- Ruta externa `/sucursal/[branchId]/inventory` de solo‑lectura (rol `branch_user`).  

Falta todavía:
1. Implementar las mejoras de UI, filtros y portal externo descritas en la Fase 4 original.  
2. Añadir la nueva funcionalidad: **Exportar lista de productos de una sucursal** mediante un *wizard* que permita seleccionar la sucursal, marcar los productos deseados y generar un PDF con columnas `Código | Nombre | Stock (sucursal) | Precio`.  
3. **Creación automática de un usuario en Supabase Auth** (con rol `branch_user`) cada vez que se registra una nueva sucursal, asignándole un email y una contraseña temporales que el administrador podrá compartir con el empleado de la sucursal.

Objetivo: cumplir con los requerimientos de la Fase 4, agregar la exportación de inventario y la creación de usuario de sucursal, usando el flujo **SDD** (explore → propose → spec → design → tasks → apply → verify → archive) y delegando todo el trabajo pesado a los sub‑agentes `sdd‑*`.

---

## Requerimientos

### R1 – Mejoras de UI, Filtros y Portal Externo (Fase 4 original)
1. **Buscador unificado en Inventario**  
   - Un único input (debounce 300 ms) que filtra por `name`, `code`, `description` y, si HU02 está activo, `category.name`.  
   - Si la consulta está vacía, muestra el listado completo.  
2. **Búsqueda en Ventas**  
   - Input en la tabla de ventas que busca por `Producto.name` **o** `Producto.code` (coincidencia parcial, case‑insensitive) y devuelve todas las ventas que contengan al menos un producto que coincida.  
   - Mantener paginación y filtros existentes (fecha, método de pago, sucursal si HU01 está activo).  
3. **Dashboard con tarjetas personalizables**  
   - Encima del grid de tarjetas:  
     - **Select de Periodo** (7 días, 30 días, 90 días, Personalizado → rango de fechas).  
     - **Select de Sucursal** (opciones: “Todas” + lista de sucursales obtenida de `Branch`).  
   - Al cambiar cualquiera de los filtros, se llaman a Server Actions genéricos `getStats(type, startDate, endDate, branchId?)` donde `type` puede ser `"ingresos"`, `"egresos"`, `"ganancias"`, `"cuentasPorCobrar"`, etc.  
   - Cada tarjeta muestra el valor y, opcionalmente, el texto “(Sucursal X)” o “(Todas)”.  
4. **Portal Externo de Sucursal (solo‑lectura)**  
   - Ruta dinámica `/sucursal/[branchId]/inventory`.  
   - Middleware que:  
     - Verifica que el usuario tenga rol `branch_user`.  
     - Confirma que el `branchId` de la URL coincida con el `branchId` asociado al usuario (para evitar que vea otra sucursal).  
     - Sólo permite verbos **GET** (cualquier POST/PUT/DELETE → 403).  
   - Página `BranchInventoryPage`: muestra tabla de productos de esa sucursal con su stock, nombre, código, precio base; incluye un buscador simple (nombre/código) pero **sin botones de edición/creación/eliminación**.  
   - Al crear una nueva sucursal (Fase 3) se genera automáticamente un usuario en Supabase Auth con rol `branch_user` y se le envían credenciales (email + contraseña temporal) vía email (función de Supabase Edge o endpoint de Next.js).  

### R2 – Nueva funcionalidad: Exportar lista de productos de una sucursal (Wizard PDF)
1. **Botón “Exportar productos”** en la página de Inventario (junto al botón *Mover Stock*).  
2. Al hacer clic, se abre un **wizard** con los siguientes pasos:  
   - **Paso 1 – Selección de Sucursal**  
     - Campo tipo `BranchSelector` (type‑ahead o dropdown) que lista todas las sucursales activas.  
     - Obligatorio: no se permite avanzar hasta elegir una sucursal.  
   - **Paso 2 – Selección de Productos**  
     - Se cargan todos los productos cuyo `BranchProduct.stock > 0` para la sucursal elegida.  
     - Se muestra una lista de **checkboxes** con la etiqueta `Código – Nombre (Stock: X)`.  
     - El usuario puede marcar/desmarcar cualquiera de ellos.  
     - Se muestra un contador de productos seleccionados.  
   - **Paso 3 – Confirmación y Generación**  
     - Botón **“Generar PDF”**.  
     - Al confirmar, se ejecuta una Server Action `exportBranchProductsPdf(branchId, selectedProductIds)` que:  
       - Recupera para cada `productId` seleccionado: `code`, `name`, `stock` (de `BranchProduct` de la sucursal), `price` (campo `price` de `Product`).  
       - Construye un documento PDF (usando una librería como `pdf-lib` o `jsPDF`) con una tabla que tiene las columnas **Código | Nombre | Stock | Precio** y una fila por cada producto seleccionado.  
       - Devuelve el PDF como `Blob` o como URL temporal.  
     - El wizard muestra un mensaje de éxito y ofrece un enlace de descarga (o dispara la descarga automática).  
3. **Validaciones**  
   - Paso 1: sucursal obligatoria.  
   - Paso 2: al menos un producto debe estar seleccionado (si no, mostrar error y bloquear el paso 3).  
   - En la Server Action, validar que cada `productId` pertenezca a la sucursal indicada y que exista en `BranchProduct`.  
4. **UI/UX**  
   - Utilizar un *stepper* (por ejemplo, Material‑UI Steps o una barra de progreso custom) para indicar el paso actual.  
   - Mensajes de toast/notificación (por ejemplo, usando `hot-toast` o `sonner`) para éxito/error.  
   - El botón de exportar debe estar deshabilitado si no hay productos con stock > 0 en la sucursal seleccionada.  
5. **Tests**  
   - Unitarias:  
     - Server Action `exportBranchProductsPdf` (validación de parámetros, generación correcta del PDF).  
     - Zod schemas de entrada (`branchId` y array de `productId`).  
     - Componentes del wizard (manejo de pasos, habilitación/deshabilitación de botones).  
   - Integración:  
     - Flujo completo: abrir wizard → seleccionar sucursal → marcar productos → generar PDF → verificar que el PDF contiene exactamente las filas esperadas y que el stock mostrado corresponde a `BranchProduct.stock` de esa sucursal.  
   - E2E (opcional): con Playwright, simular el clic en el botón, completar el wizard y confirmar que se descarga un archivo PDF con el contenido correcto.  

### R3 – Creación Automática de Usuario de Sucursal al Registrar una Sucursal
1. **Al crear una sucursal** (a través del modal o página `/sucursales`) se debe:  
   - Insertar el registro en la tabla `Branch`.  
   - Generar un **email** único para la sucursal (por ejemplo, `sucursal-{code}@tudominio.com` o usar un patrón configurable).  
   - Generar una **contraseña temporal** segura (mínimo 12 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo).  
   - Llamar a la **Admin API de Supabase** (`supabase.auth.admin.createUser`) para crear un usuario con ese email y contraseña, asignándole el rol `branch_user` (custom claim o mediante la tabla `user_roles` si la usan).  
   - Devolver al administrador (en un toast o modal) el email y la contraseña generados para que los copie y comparta con el empleado.  
   - Opcional: enviar automáticamente un email con las credenciales utilizando una función de Supabase Edge o un endpoint de Next.js que use el proveedor de email de Supabase (o un servicio externo como SendGrid, Resend, etc.).  
2. **Al editar una sucursal** no se debe crear otro usuario; solo se permite cambiar nombre y código. Si se cambia el código, opcionalmente se puede actualizar el email del usuario asociado (pero eso quedará como mejora futura).  
3. **Eliminar una sucursal** debe también eliminar el usuario de Supabase Auth asociado (llamar a `supabase.auth.admin.deleteUser`) para evitar cuentas huérfanas.  
4. **Validaciones y Seguridad**  
   - El email debe ser único en la tabla de auth de Supabase; si ya existe, mostrar error y no crear la sucursal.  
   - La contraseña nunca se guarda en la base de datos del proyecto; solo se muestra una vez al administrador.  
   - Todas las operaciones de creación/eliminación de usuario deben estar dentro de una transacción lógica (primero crear/eliminar el registro en `Branch`, luego crear/eliminar el usuario en Auth; si cualquiera falla, se revierte la otra).  
5. **Tests**  
   - Unitarias: Server Action `createBranch` verifica que llama a Supabase Auth para crear usuario y que devuelve email y contraseña.  
   - Integración: crear una sucursal → verificar que exista un usuario en Supabase Auth con rol `branch_user` y que se pueda login con las credenciales mostradas → intentar acceder al portal `/sucursal/[branchId]/inventory` y ver que se muestra el inventario sin poder modificar nada.  

---

## Criterios de aceptación combinados

| # | Criterio |
|---|----------|
| 1 | El buscador unificado en Inventario filtra correctamente por nombre, código, descripción y categoría (si está activo). |
| 2 | La búsqueda en ventas devuelve todas las ventas que contienen al menos un producto cuyo nombre o código coincida con el término ingresado. |
| 3 | El Dashboard muestra tarjetas cuyo valor cambia al modificar los filtros de periodo y sucursal; al seleccionar “Todas” se muestra la suma de todas las sucursales. |
| 4 | El portal externo `/sucursal/[branchId]/inventory` permite solo lecturas y muestra correctamente el inventario de la sucursal asociada al usuario; cualquier intento de acceder a otra sucursal o usar métodos distintos de GET devuelve 403. |
| 5 | En la página de Inventario aparece el botón **“Exportar productos”**. Al hacer clic se abre el wizard. |
| 6 | En el wizard: <br>‑ Paso 1 obliga a elegir una sucursal.<br>‑ Paso 2 lista solo productos con stock > 0 de esa sucursal y permite marcar/desmarcar checkboxes.<br>‑ Paso 3 solo se habilita cuando al menos un producto está marcado. |
| 7 | Al pulsar **“Generar PDF”**, se descarga un archivo PDF con una tabla que tiene las columnas **Código | Nombre | Stock | Precio** y una fila por cada producto seleccionado, donde el stock corresponde exclusivamente al `BranchProduct.stock` de la sucursal elegida. |
| 8 | El PDF es válido (se puede abrir con cualquier lector de PDF) y su nombre sigue el patrón `inventario‑<branchCode>‑<YYYYMMDD>.pdf`. |
| 9 | Al crear una sucursal mediante el modal o la página `/sucursales`, el sistema crea automáticamente un usuario en Supabase Auth con rol `branch_user`, genera un email y una contraseña temporal y los muestra al administrador. |
|10 | El usuario creado puede iniciar sesión en el portal externo (`/sucursal/[branchId]/inventory`) y solo tiene permisos de lectura; cualquier intento de realizar mutaciones (POST/PUT/DELETE) resulta en 403. |
|11 | Al eliminar una sucursal, el usuario asociado en Supabase Auth también se elimina. |
|12 | Todas las Server Actions nuevas y actualizadas están cubiertas por pruebas unitarias (≥ 80 % de cobertura). |
|13 | Las pruebas de integración verifican el flujo completo del wizard de exportación, la correcta generación del PDF y el ciclo de creación/eliminación de usuario de sucursal. |
|14 | No se introducen regresiones en las funcionalidades existentes de compra, inventario, movimientos, dashboard o portal externo. |

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/app/(routes)/inventario/page.tsx` | Añadir botón **Exportar productos** y abrir wizard; integrar buscador unificado (debounce) y filtros de sucursal/categoría. |
| `src/app/(routes)/inventario/components/ExportWizard.tsx` | Nuevo componente que implementa los 3 pasos del wizard (selección sucursal, selección productos, generación PDF). |
| `src/app/(routes)/inventario/actions.ts` | Nueva Server Action `exportBranchProductsPdf(branchId: number, selectedProductIds: number[])` que devuelve PDF (Blob) y usa `prisma.$transaction` solo para lecturas. |
| `src/lib/validations/export.ts` | Zod schema: `{ branchId: z.number().int().positive(), selectedProductIds: z.array(z.number().int().positive()).min(1) }`. |
| `src/lib/utils/pdf.ts` | Función `generateProductsPdf(data: Array<{code:string, name:string, stock:number, price:number}>): Promise<Blob>` usando `pdf-lib` o `jsPDF`. |
| `src/app/(routes)/ventas/page.tsx` | Añadir input de búsqueda y lógica para llamar a Server Action `searchSalesByProduct`. |
| `src/app/(routes)/ventas/actions.ts` | Server Action `searchSalesByProduct(query: string)` que devuelve ventas con filtros de producto. |
| `src/app/(routes)/dashboard/page.tsx` | Añadir selects de periodo y sucursal; conectar a Server Actions `getStats`. |
| `src/app/(routes)/dashboard/actions.ts` | Server Actions genéricos `getStats(type, startDate, endDate, branchId?)`. |
| `src/app/(routes)/sucursal/[branchId]/inventory/page.tsx` | Página de solo‑lectura (portal externo) con middleware de protección. |
| `src/middleware.ts` | Middleware de protección de rutas admin (excepto `/login` y `/sucursal/*`). |
| `src/middleware/branch.ts` | Middleware que verifica rol `branch_user` y que el `branchId` de la URL coincide con el del usuario; solo permite GET. |
| `src/app/components/BranchSelector.tsx` | Reutilizable (type‑ahead) usado en el wizard de export y en otros modales. |
| `src/app/components/ButtonBar.tsx` | Añadir enlace/icono “Sucursales” → `/sucursales` (si aún no está). |
| `src/app/(routes)/sucursales/page.tsx` | Lista de sucursales (admin). |
| `src/app/(routes)/sucursales/[id]/page.tsx` | Editar sucursal (admin). |
| `src/app/(routes)/sucursales/[id]/actions.ts` | Server Actions: `createBranch`, `updateBranch`, `deleteBranch`, `getBranches` (incluye creación/eliminación de usuario de Supabase). |
| `src/lib/validations/branch.ts` | Zod schema para crear/actualizar sucursal (nombre y código requeridos, código único). |
| `src/lib/validations/category.ts` | Zod schema para crear/actualizar categoría. |
| `src/lib/validations/product.ts` | Actualizar schema para incluir `categoryId` y `active`. |
| `src/lib/validations/purchase.ts` | Schema para crear compra con arreglo de `{productId, branchId, quantity, price}`. |
| `src/lib/validations/sale.ts` | Actualizar schema para incluir `branchId` y validar líneas contra stock de sucursal. |
| `src/lib/utils/stock.ts` | Funciones `getBranchStock(productId, branchId)`, `validateSaleLines(branchId, lines)`. |
| `src/lib/utils/supabaseAuth.ts` | Funciones auxiliares: `createBranchUser(branch: Branch)`, `deleteBranchUser(userId: string)`, `generateTemporaryPassword()`, `generateBranchEmail(branchCode:string)`. |
| `src/tests/unit/export.actions.test.ts` | Unit tests de `exportBranchProductsPdf`. |
| `src/tests/unit/exportWizard.test.ts` | Unit tests del componente wizard (manejo de pasos, habilitación). |
| `src/tests/integration/export-wizard.test.ts` | Test de integración del flujo completo de exportación PDF. |
| `src/tests/unit/branch.actions.test.ts` | Unit tests de CRUD de sucursales **incluyendo** creación/eliminación de usuario de Supabase. |
| `src/tests/unit/sale.actions.test.ts` | Unit tests de `createSaleWithBranch`. |
| `src/tests/integration/sale-wizard.test.ts` | Test de integración del wizard de venta (si aún no existe). |
| `src/tests/unit/dashboard.actions.test.ts` | Unit tests de `getStats`. |
| `src/tests/unit/branchMiddleware.test.ts` | Test del middleware de sucursal (solo GET y rol correcto). |
| `src/tests/unit/supabaseAuth.test.ts` | Unit tests de las funciones auxiliares de creación/eliminación de usuario. |
| `prisma/seed.ts` (o crear) | Asegurar registro inicial de sucursal “Deposito” (id = 1, code = “DEP”) y al menos un producto de prueba para que los tests tengan datos. |

---

## Notas técnicas

- **Transacciones**:  
  - Las Server Actions que **solo leen** (`exportBranchProductsPdf`, `getBranches`, `getStats`, `searchSalesByProduct`) **no** requieren transacción.  
  - Las que **modifican stock** (`createPurchaseWithBranchSplit`, `createSaleWithBranch`, `assignStockToBranch`, `moveStockBetweenBranches`) **sí** deben usar `prisma.$transaction` para garantizar atomicidad.  
  - La acción `createBranch` debe ejecutar dos pasos en orden: (1) insertar registro en `Branch`; (2) llamar a Supabase Admin API para crear el usuario. Si cualquiera falla, se debe revertir el otro (por ejemplo, si la creación del usuario falla, eliminar el registro de `Branch` recién insertado). Esto se puede lograr con un `try/catch` y una llamada condicional de eliminación.  
  - La acción `deleteBranch` debe primero eliminar el usuario de Supabase Auth y luego el registro de `Branch`; si la eliminación del usuario falla, abortar y no eliminar la sucursal.  

- **Generación de PDF**: Utilizar `pdf-lib` (más ligero y compatible con entorno serverless) o `jsPDF`. La función debe recibir un array de objetos y devolver un `Blob` que el wizard pueda transformar en URL mediante `URL.createObjectURL(blob)` y disparar la descarga.  

- **Manejo de errores**: Devolver mensajes genéricos al UI (p.ej., “Error al generar el PDF”, “No se pudo crear el usuario de sucursal”) y nunca exponer detalles de la base de datos o de la stack trace.  

- **Seguridad**:  
  - El botón de exportar solo aparece para usuarios con rol `admin` (puede reutilizarse el mismo middleware de protección de rutas).  
  - La Server Action verifica que el `branchId` proporcionado pertenece realmente a una sucursal existente y que el usuario que la llama tiene rol `admin` (o, si se decide permitir a cualquier autenticado, se hace un chequeo de rol dentro de la acción).  
  - Las credenciales de usuario de sucursal nunca se guardan en la base de datos del proyecto; solo se muestran una vez al administrador.  

- **Optimización**:  
  - El `BranchSelector` y el listado de productos del wizard pueden usar `swr` o `react-query` con los Server Actions `getBranches` y `getProductsWithBranchStock(branchId)`.  
  - Debounce de 300 ms en los inputs de búsqueda para evitar llamadas excesivas.  

- **Testing**:  
  - Mockear Server Actions en pruebas unitarias usando `jest.mock('../actions/...')`.  
  - En pruebas de integración, usar la base de datos de test de Supabase o un contenedor Docker de PostgreSQL; limpiar datos antes de cada test.  
  - Para probar la creación de usuario de Supabase, usar el entorno de test de Supabase (projecto de pruebas) o mockear la llamada a `supabase.auth.admin.*`.  
  - Para E2E con Playwright, verificar que se descarga un archivo PDF y que su contenido coincide con lo esperado (pueden usar `pdf-parse` o leer el texto del PDF).  

- **Dependencias adicionales**:  
  ```bash
  npm i pdf-lib   # o jsPDF
  npm i swr        # o react-query (si no está ya)
  npm i zod @hookform/resolvers react-hook-form
  npm i sweetalert2 hot-toast   # o sonner para notificaciones
  # Si se usa Supabase Admin API, ya está incluido en @supabase/supabase-js
  ```  

- **Documentación**: Mantener actualizada la página en Notion (ya creada) y añadir archivos Markdown en `docs/` siguiendo la plantilla de `cognitive‑doc‑design` para cada nuevo feature (export wizard, mejoras de dashboard, creación de usuario de sucursal, etc.).  

---

## PROMT por Fase SSD
**Qué debe generar el orchestrator (a través de los sub‑agentes):**

1. **Explorar** el estado actual de la página de Inventario, del Dashboard, de las rutas de ventas y del portal externo, así como la ausencia del wizard de exportación, de los selects de periodo/sucursal y de la lógica de creación/eliminación de usuario de Sucursal en las Server Actions de sucursal.  
2. **Proponer**  
   - Implementar el buscador unificado en Inventario y la búsqueda en ventas.  
   - Añadir los selects de periodo y sucursal al Dashboard y conectarlos a Server Actions genéricos `getStats`.  
   - Crear la página de solo‑lectura `/sucursal/[branchId]/inventory` con su middleware.  
   - Añadir el botón **Exportar productos** en Inventario y el wizard asociado (selección de sucursal, selección de productos mediante checkboxes, generación de PDF).  
   - Definir los nuevos/actualizados Server Actions: `exportBranchProductsPdf`, `searchSalesByProduct`, `getStats`, `getBranches`, `getProductsWithBranchStock`, `createBranch`, `updateBranch`, `deleteBranch` (incluyendo creación/eliminación de usuario de Supabase), `createSaleWithBranch`, etc.  
   - Añadir los Zod schemas de validación y las utilidades de stock, generación de PDF y gestión de usuarios de Supabase.  
3. **Especificar** flujos de usuario detallados (paso a paso del wizard de exportación, validaciones, mensajes de error/éxito, comportamiento del buttonBar, flujo de creación de sucursal con generación de usuario, flujo de eliminación de sucursal con borrado de usuario).  
4. **Diseñar** componentes/Server Actions:  
   - Server Actions: `createBranch`, `updateBranch`, `deleteBranch`, `getBranches`, `exportBranchProductsPdf`, `searchSalesByProduct`, `getStats`, `createSaleWithBranch`, `assignStockToBranch`, `moveStockBetweenBranches`.  
   - Componentes: `BranchSelector`, `ExportWizard` (con stepper), `ButtonBar` (enlace actualizado), `InventoryFilters`, `DashboardFilters`, `MetricCard`, `BranchSalesChart`, `VentaWizard` (si aún no se ha creado), etc.  
5. **Tareas** (dividir en unidades de trabajo):  
   - Ejecutar migraciones Prisma y correr el seed.  
   - Implementar/actualizar Server Actions (con transacciones donde corresponda y lógica de creación/eliminación de usuario de Supabase).  
   - Desarrollar los componentes UI y las páginas.  
   - Añadir los Zod schemas y utilidades (stock, PDF, Supabase Auth).  
   - Actualizar middlewares y buttonBar.  
   - Escribir pruebas unitarias para cada Server Action y componente (incluyendo pruebas de las funciones auxiliares de Supabase Auth).  
   - Escribir pruebas de integración que cubran: <br> • Flujo completo del wizard de exportación (selección sucursal → productos → PDF). <br> • Creación de sucursal → verificación de usuario en Supabase Auth → login en portal externo → solo‑lectura. <br> • Eliminación de sucursal → eliminación de usuario asociado. <br> • Flujos existentes de compra, venta, movimiento, dashboard y filtros.  
6. **Aplicar** las tareas en batches.  
7. **Verificar** con pruebas unitarias, de integración y, si existen, pruebas E2E (Playwright) que el wizard funcione correctamente, que el PDF sea válido, que el stock sea el correcto, que los usuarios de sucursal se creen y eliminen adecuadamente y que no haya regresiones.  
8. **Archivar** el cambio en el artefact store (engram/openspec/both según la pre‑flight de la sesión).  
