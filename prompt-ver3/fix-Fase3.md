# Change: FASE 3 – Corrección de UI (Sucursales CRUD y Flujo de Venta estilo Wizard)

## Contexto
Tras la implementación de la Fase 3 existen dos brechas importantes:

1. **Página `/sucursales`** que permita el CRUD completo de sucursales (crear, leer, actualizar, eliminar) y que esté accesible desde el *buttonBar* del layout principal.  
2. **Modal de Registro de Venta** debe presentar un flujo tipo *wizard*: primero el usuario selecciona la sucursal (obligatorio) y, solo después de elegirla, se muestra el selector de productos, cantidades, método de pago, etc. Actualmente el modal muestra todo junto y no valida la sucursal antes de continuar.

Objetivo: corregir estos puntos usando el flujo **SDD** (explore → propose → spec → design → tasks → apply → verify → archive) y delegando todo el trabajo pesado a los sub‑agentes `sdd‑*`.

---

## Requerimientos

### R1 – Página de Sucursales (CRUD + buttonBar)
- **Ruta:** `/sucursales` (protegida por middleware de rol `admin`).  
- **Componentes:**  
  - Lista de sucursales con columnas: `Nombre`, `Código`, `Acciones` (Editar / Eliminar).  
  - Botón **“+ Nueva Sucursal”** que abre un modal de creación.  
  - Modal de creación/edición con campos `Nombre` (texto requerido) y `Código` (texto requerido, único).  
  - Acción de eliminación con confirmación SweetAlert2.  
- **Integración en buttonBar:** Añadir un ícono o enlace llamado **“Sucursales”** que redirija a `/sucursales`.  
- **Server Actions:** `createBranch`, `updateBranch`, `deleteBranch`, `getBranches`.  
- **Validaciones Zod:** `name` no vacío, `code` no vacío y único en la tabla `Branch`.  
- **Tests:** unitarias de los Server Actions y de los Zod schemas; integración que verifique que el botón del buttonBar lleva a la página y que el CRUD funciona.

### R2 – Modal de Venta tipo Wizard
- **Paso 1 – Selección de Sucursal:**  
  - Campo tipo *Componente `BranchSelector` (type‑ahead o dropdown) que muestra todas las sucursales activas.  
  - Obligatorio: no se permite avanzar hasta elegir una sucursal.  
- **Paso 2 – Selección de Producto(s) y Cantidad(es):**  
  - Una vez seleccionada la sucursal, se muestra el selector de producto (type‑ahead) con campo de cantidad.  
  - Permitir agregar varias líneas (botón “+ Otro producto”).  
  - Cada línea valida que la cantidad solicitada no supere el stock disponible en la sucursal elegida (`BranchProduct.stock`).  
- **Paso 3 – Método de Pago y Datos del Cliente:**  
  - Mantener los campos actuales (efectivo/tarjeta, datos del cliente).  
- **Paso 4 – Resumen y Confirmación:**  
  - Mostrar un resumen con sucursal, lista de productos, total y botón **“Confirmar Venta”**.  
  - Al confirmar, ejecutar Server Action `createSaleWithBranch` dentro de una transacción que:  
    1. Crea la venta (`Sale`) con `branchId` = sucursal seleccionada.  
    2. Crea los `SaleItem` asociados.  
    3. Descuenta el stock de `BranchProduct` para cada línea.  
    4. Lanza error si alguna validación falla y revierte la transacción.  
- **UI:** Utilizar un *stepper* (por ejemplo, material‑ui Steps o una barra de progreso custom) para indicar el paso actual.  
- **Validaciones Zod:** esquema que incluya `branchId` (obligatorio), arreglo de `{productId, quantity, price}` y campos de pago.  
- **Tests:** unitarias de la nueva Server Action y del Zod schema; integración que recorra todo el wizard y verifique que el stock de la sucursal se actualiza correctamente y que no se permite avanzar sin sucursal.

---

## Criterios de aceptación combinados

| # | Criterio |
|---|----------|
| 1 | Al ingresar a `/sucursales` (requiriendo rol `admin`) se visualiza la lista de sucursales y se pueden crear, editar y eliminar sin errores. |
| 2 | El buttonBar del layout muestra un enlace “Sucursales” que navega a `/sucursales`. |
| 3 | Al abrir el modal de venta, el primer paso es exclusivamente la selección de sucursal; no se muestran productos ni campos de pago hasta que se elige una sucursal. |
| 4 | Tras elegir una sucursal, se habilita el selector de producto y la cantidad; la cantidad no puede exceder el stock disponible en esa sucursal. |
| 5 | Al confirmar la venta, se crea el registro en `Sale` con el correcto `branchId` y se actualiza `BranchProduct.stock` de forma atómica. |
| 6 | Si se intenta avanzar sin seleccionar sucursal o con cantidad inválida, se muestra mensaje de error y el wizard no permite continuar. |
| 7 | Todas las Server Actions nuevas y actualizadas están cubiertas por pruebas unitarias (≥ 80 % de cobertura). |
| 8 | Las pruebas de integración recorren el flujo completo del wizard y verifican que el stock total del producto permanece igual a la suma de `BranchProduct`. |
| 9 | No se introducen regresiones en las funcionalidades existentes de compra, inventario o movimientos. |

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/app/(routes)/sucursales/page.tsx` | Lista de sucursales (admin). |
| `src/app/(routes)/sucursales/[id]/page.tsx` | Editar sucursal (admin). |
| `src/app/(routes)/sucursales/[id]/actions.ts` | Server Actions: `createBranch`, `updateBranch`, `deleteBranch`, `getBranches`. |
| `src/app/components/ButtonBar.tsx` | Añadir enlace/icono “Sucursales” → `/sucursales`. |
| `src/app/components/BranchSelector.tsx` | Reutilizable (type‑ahead) usado en el wizard de venta y en otros modales. |
| `src/app/components/VentaWizard.tsx` | Nuevo componente que implementa los 4 pasos descritos. |
| `src/app/(routes)/sale/page.tsx` | Reemplazar el modal actual por `<VentaWizard />`. |
| `src/app/(routes)/sale/actions.ts` | Nueva Server Action `createSaleWithBranch` (transacción). |
| `src/lib/validations/branch.ts` | Zod schema para crear/actualizar sucursal (incluye regla de unicidad de `code`). |
| `src/lib/validations/sale.ts` | Actualizar schema para incluir `branchId` y validar líneas de producto contra stock (usará una función de utilidad que consulte `BranchProduct`). |
| `src/lib/utils/stock.ts` | Función `getBranchStock(productId, branchId)` y `validateSaleLines(branchId, lines)`. |
| `src/tests/unit/branch.actions.test.ts` | Unit tests de CRUD de sucursales. |
| `src/tests/unit/sale.actions.test.ts` | Unit tests de `createSaleWithBranch`. |
| `src/tests/integration/sale-wizard.test.ts` | Test de integración del wizard (selección sucursal → productos → confirmation). |
| `src/tests/unit/branchSelector.test.ts` | Unit tests del componente selector. |
| `src/tests/unit/ventaWizard.test.ts` | Unit tests del wizard (manejo de pasos, validaciones). |
| `prisma/seed.ts` (si no existe) | Asegurar registro inicial de sucursal “Deposito” (id = 1, code = “DEP”). |

---

## Notas técnicas

- **Middleware:** El buttonBar no necesita protección extra; la página `/sucursales` ya está bajo el middleware de admin (creado en Fase 1).  
- **Transacciones:** `createSaleWithBranch` debe usar `prisma.$transaction` para garantir atomicidad entre la creación de la venta, los ítems y el descuento de stock.  
- **Manejo de errores:** Devolver mensajes genéricos al UI (p.ej., “Stock insuficiente en la sucursal seleccionada”) y nunca exponer detalles de la base de datos.  
- **Optimización:** El `BranchSelector` puede usar `swr` o `react-query` con `getBranches` Server Action para cached data.  
- **SweetAlert2:** Utilizar para confirmaciones de eliminación de sucursal y para alertas de error en el wizard.  
- **Testing:** Mockear Server Actions en pruebas unitarias usando `jest.mock('../actions/...')`. En integración, usar la base de datos de test de Supabase o un contenedor Docker de PostgreSQL.  

---

## PROMT por Fase SSD
**Qué debe generar el orchestrator (a través de los sub‑agentes):**

1. **Explorar** el estado actual del layout (buttonBar), del modal de venta y de la ausencia de la página `/sucursales`.  
2. **Proponer**  
   - Crear la página `/sucursales` con su CRUD, los componentes reutilizables y los Server Actions necesarios.  
   - Actualizar el buttonBar para incluir el enlace a sucursales.  
   - Rediseñar el modal de venta como un wizard con selector de sucursal primero, seguido de selección de producto(s), método de pago y resumen.  
   - Definir los nuevos/actualizados Server Actions (`createBranch`, `updateBranch`, `deleteBranch`, `getBranches`, `createSaleWithBranch`).  
   - Añadir los Zod schemas de validación y las utilidades de stock.  
3. **Especificar** flujos de usuario detallados (paso a paso del wizard, validaciones, mensajes de error, comportamiento del buttonBar).  
4. **Diseñar** componentes/Server Actions:  
   - Server Actions: `createBranch`, `updateBranch`, `deleteBranch`, `getBranches`, `createSaleWithBranch`.  
   - Componentes: `BranchSelector`, `VentaWizard` (con stepper), `ButtonBar` (enlace actualizado).  
5. **Tareas** (dividir en unidades de trabajo):  
   - Crear/actualizar páginas y componentes listados.  
   - Implementar los Server Actions, asegurando uso de transacciones y validaciones de stock.  
   - Añadir los Zod schemas y utilidades de stock.  
   - Actualizar el buttonBar.  
   - Escribir pruebas unitarias para cada Server Action y componente.  
   - Escribir pruebas de integración que recorran el flujo completo del wizard y verifiquen el CRUD de sucursales.  
6. **Aplicar** las tareas en batches.  
7. **Verificar** con pruebas unitarias, de integración y, si existen, pruebas E2E (Playwright) que el wizard funcione correctamente y que el stock se mantenga consistente.  
8. **Archivar** el cambio.  
