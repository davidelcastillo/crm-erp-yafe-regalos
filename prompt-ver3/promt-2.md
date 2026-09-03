# Change: FASE 2 - Reestructuración de Base de Datos (Sucursales, Categorías y Soft‑Delete)

## Contexto
Proyecto: Stark Commerce OS (Next.js 16 + Prisma + Supabase + Tailwind v4)
Estado actual: El esquema Prisma contiene los modelos Product, Purchase, Sale, Customer, Payment y los Server Actions correspondientes. No existen tablas para sucursales, categorías ni control de activación/desactivación de productos.
Objetivo: Aplicar en una única migración los cambios necesarios para soportar HU01 (Sucursales), HU02 (Categorías) y HU03 (Activar/desactivar productos), incluyendo la lógica de integridad que garantice que la suma del stock por sucursal sea igual al stock total del producto.

## Requerimientos

### HU01 – Sucursales y asignación de stock por sucursal
- Crear tabla Branch (id, name, code).
- Crear tabla pivote BranchProduct (branchId, productId, stock) para manejar inventario por sucursal.
- Añadir campo branchId a Sale (valor por defecto = 1, sucursal “Deposito”).
- Opcional: añadir branchId a Purchase para rastrear origen de la compra.
- Crear tabla BranchMovement para registrar traslados entre sucursales.
- La suma de stock en todas las BranchProduct de un mismo productId debe ser igual a Product.stock (implementar mediante trigger o validación en Server Actions).

### HU02 – Categorías de productos
- Crear tabla Category (id, name, description).
- Añadir campo categoryId a Product (nullable, con valor por defecto = 1 tras migración).
- Relación muchos‑a‑uno Product → Category.

### HU03 – Activar/desactivar productos (soft‑delete)
- Añadir columna booleana active a Product (valor por defecto = true).
- En listados de inventario y en modales de producto mostrar solo los activos (active = true).
- Reemplazar botón “Eliminar” por toggle Activo/Inactivo (con confirmación SweetAlert2).
- Página especial /inventario/inactivos para ver y reactivar productos desactivados.
- Impedir selección de productos inactivos en flujos de compra, venta y cualquier otra operación que requiera un producto.

## Criterios de aceptación combinados

### Esquema Prisma & Migraciones
1. prisma/schema.prisma contiene los modelos Branch, BranchProduct, BranchMovement, Category y los campos añadidos a Product (categoryId, active, branchId en Sale).
2. Migración generada con prisma migrate dev --name add_branch_category_active aplica los cambios sin pérdida de datos.
3. Script de seed (prisma/seed.ts o archivo separado) crea:
    - Registro inicial en Branch (name: "Deposito", code: "DEP").
    - Categoría por defecto (name: "General").
    - Actualiza todos los Product existentes: categoryId = 1, active = true, y asigna su stock a BranchProduct donde branchId = 1 (Deposito).

### Lógica de Integridad de Stock
4. Server Actions que modifican stock (assignStockToBranch, moveStockBetweenBranches, createPurchaseWithBranchSplit, createSaleWithBranch) validan que:
    - La cantidad asignada a una sucursal no exceda el stock total del producto.
    - Después de la operación, la suma de stock en BranchProduct para ese productId sigue siendo igual a Product.stock.
5. En caso de violación, se lanza un error controlado y la operación se revierte (uso de prisma.$transaction).

### Server Actions Actualizados
6. getProducts y relacionados incluyen select: { category: true, active: true } y filtran WHERE active = true.
7. createPurchase y createSale reciben arreglos de { productId, branchId, quantity, price } y usan la lógica de asignación de stock por sucursal.
8. Nuevas Server Actions:
    - createBranch, updateBranch, deleteBranch (CRUD de sucursales).
    - createCategory, updateCategory, deleteCategory (CRUD de categorías).
    - toggleProductActive (cambia active).
    - getBranchMovements, getProductsWithBranchStock, getSalesByBranch.

### UI/UX (se implementará en Fase 3, pero el backend debe estar listo)
9. Los componentes de UI podrán consumir los nuevos Server Actions sin cambios adicionales en el esquema.

### Tests
10. Unit: pruebas sobre las validaciones de stock en assignStockToBranch y moveStockBetweenBranches.
11. Unit: pruebas de los Server Actions de CRUD de Branch y Category.
12. Integración/E2E: flujo completo – crear sucursal → asignar stock → registrar compra con distribución → registrar venta verificando stock de sucursal → mover stock entre sucursales → consultar movimientos y confirmar que el stock total del producto permanece constante.

## Archivos a modificar/crear
| Archivo	| Acción | 
|prisma/schema.prisma	| Añadir modelos Branch, BranchProduct, BranchMovement, Category; agregar campos categoryId, active a Product; agregar branchId a Sale (y opcionalmente a Purchase).| 
| prisma/migrations/xxxxxx_add_branch_category_active/migration.sql	| Migración generada por Prisma (no editar manualmente).| 
| prisma/seed.ts (o crear prisma/seed.js)	| Insertar registro de Deposito, categoría General, actualizar productos existentes y poblar BranchProduct.|
|src/lib/prisma.ts	(si no existe) |utilidad para cliente Prisma; asegurarse de exportar prisma.|
|src/actions/product.actions.ts|	Actualizar getProducts, createProduct, updateProduct para incluir category y filtrar active = true.|
|src/actions/purchase.actions.ts	| Modificar createPurchase para aceptar arreglo de items con branchId y usar transacción que actualice BranchProduct.|
| src/actions/sale.actions.ts |	Modificar createSale de forma análoga a compra.|
| src/actions/branch.actions.ts	| Crear nuevas Server Actions: createBranch, updateBranch, deleteBranch, assignStockToBranch, moveStockBetweenBranches, getBranchMovements.|
| src/actions/category.actions.ts	| Crear CRUD para Category.| 
| src/actions/product.actions.ts (adicional) |	Añadir toggleProductActive, getActiveProducts, getInactiveProducts.|
| src/lib/validations/branch.ts	| Zod schemas para crear/actualizar sucursal. |
| src/lib/validations/category.ts	| Zod schemas para crear/actualizar categoría.|
| src/lib/validations/product.ts	| Actualizar schema para incluir categoryId y active.|
| src/app/(routes)/branches/page.tsx	| Lista de sucursales.| 
| src/app/(routes)/branches/[id]/page.tsx	| Editar sucursal.|
|src/app/(routes)/categories/page.tsx	| Lista de categorías.| 
| src/app/(routes)/categories/[id]/page.tsx	| Editar categoría.| 
| src/app/(routes)/inventario/page.tsx	| (actualizar en Fase 3) pero preparar hooks para consumir nuevos Server Actions.|
| src/app/(routes)/inventario/inactivos/page.tsx	| Página de productos inactivos (Fase 3). |
| src/app/(routes)/login/page.tsx	| Ya existente (Fase 1).|
| src/app/components/LogoutButton.tsx	| Ya existente (Fase 1).| 
| src/app/components/BranchSelector.tsx	| Componente reutilizable para seleccionar sucursal (usado en modales de compra/venta).|
| src/app/components/CategorySelector.tsx	| Componente reutilizable para seleccionar/crear categoría (usado en ProductForm).|
| src/app/components/ProductForm.tsx	| Actualizar para incluir selector de categoría y toggle activo. |

## Notas técnicas
- Prisma Transactions: Todas las operaciones que modifican stock deben estar dentro de prisma.$transaction para garantizar atomicidad y evitar estados inconsistentes.
- Trigger de integridad (opcional): Si se prefiere no depender únicamente de la lógica de aplicación, se puede crear un trigger en PostgreSQL que verifique la suma de stock en BranchProduct antes de UPDATE o INSERT.
- Supabase Auth: Los roles admin y branch_user ya fueron creados en la Fase 1; aquí solo se usan para proteger rutas de administración (sucursales, categorías) en siguientes fases.
- Manejo de errores: Nunca exponer detalles de la base de datos al cliente; devolver mensajes genéricos como “Error al actualizar stock”.
- Testing: Utilizar la base de datos de prueba de Supabase (db test) o un entorno local de Docker para ejecutar las pruebas sin afectar datos de producción.
- Documentación: Comentar cada nuevo campo y modelo en schema.prisma explicando su propósito (ej. // Stock disponible de este producto en determinada sucursal).

## PROMT por Fase SSD

### Qué debe generar el orchestrator (a través de los sub‑agentes):

1. Explorar el estado actual del esquema Prisma y los Server Actions relacionados con productos, compras y ventas.
2. Proponer
    - Añadir los modelos Branch, BranchProduct, BranchMovement, Category y los campos categoryId, active a Product y branchId a Sale.
    - Crear migración Prisma y script de seed que inserte Deposito, categoría General y migre los productos existentes.
    - Implementar Server Actions actualizados y nuevos (CRUD de sucursales y categorías, toggle de activo, asignación/movimiento de stock, etc.).
    - Añadir componentes UI reutilizables (BranchSelector, CategorySelector) y actualizar ProductForm.
3. Especificar flujos de usuario:
    - Intento de asignar stock a una sucursal sin suficiente stock total → error y operación abortada.
    - Movimiento de stock entre sucursales actualiza correctamente ambos registros y mantiene el total del producto.
    - Crear una compra con distribución múltiple descontará stock de cada sucursal involucrada.
    - Venta solo permite seleccionar una sucursal donde haya suficiente stock.
    - Producto inactivo no aparece en listados ni puede ser seleccionado en compra/venta.
4. Diseñar componentes/Server Actions:
    - Server Actions: createBranch, updateBranch, deleteBranch, assignStockToBranch, moveStockBetweenBranches, getBranchMovements, createCategory, updateCategory, deleteCategory, toggleProductActive, getActiveProducts, getInactiveProducts.
    - Componentes: BranchSelector, CategorySelector, ProductForm (con categoría + toggle activo), LogoutButton (ya existente).
5. Tareas (dividir en unidades de trabajo):
    - Ejecutar migración Prisma (prisma migrate dev).
    - Ejecutar script de seed.
    - Modificar prisma/schema.prisma y generar cliente.
    - Actualizar Server Actions de producto, compra y venta.
    - Crear nuevas Server Actions de branch y category.
    - Crear componentes UI de selección y formularios.
    - Escribir pruebas unitarias de validaciones de stock y de los nuevos Server Actions.
    - Escribir pruebas de integración que cubran los flujos completos (creación sucursal, asignación, compra, venta, movimiento).
6. Aplicar las tareas en batches.
7. Verificar con pruebas unitarias y de integración (verificar que el stock total del producto permanece constante tras cualquier operación).
8. Archivar el cambio.