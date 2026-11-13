# Orden de las listas en los modales de exportar y de movimiento de stock

Rama `feat/orden-listas-modales`. Cinco listas que eligen productos: exportar
stock de sucursal, etiquetas de precio, mover stock, entrada/salida y control de
stock. Todas ganan el control de orden «Código / Última modificación» que ya usa
el resto de las listas, y el elegido se recuerda entre modales.

## Specs

- **S1** «que cuando se entra a los modales de exportar (stock de sucursal, precios) o los modales de movimiento de stock (entre sucursales, entrada/salida, control) que por defecto, en las listas agregemos los filtros como estaban antes para ordenarlas por orden alfabetico o por ultimo modificado»
- **S2** Decisión del usuario en la consulta previa: el par de opciones es **Código + Última modificación**, el mismo control (`ProductSortToggle`) que ya está en la página de inventario y en el inventario externo. No se agregan las opciones de stock ni «por nombre».
- **S3** Decisión del usuario en la consulta previa: **«Recordar el último elegido»** — el orden se guarda en el navegador y se reusa en los cinco lugares; sin nada guardado arranca **por código**.
- **S4** (derivada de S1 + S2) Las cinco listas son: `ExportWizard` (paso 2), `LabelSelector` (paso 2), `MoveStockModal` (paso 2), `StockAdjustmentModal` (paso 2) y la página `/inventario/control`. «Control» no tiene modal propio: elegir «Control de stock» en el menú de stock navega a esa página, así que el control va en su lista.
- **S5** El orden elegido también manda en el PDF de exportación: `exportBranchProductsPdf` ya acepta `sortBy` y el wizard le pasaba `"code"` fijo.

## Tasks

- [x] **T1** [S2, S3] — Hook compartido `src/lib/hooks/useProductSortMode.ts`: `ProductSortMode` de `@/lib/product-order`, clave `orden-listas-productos` en `localStorage`, default `code`, ignora basura y fallas de almacenamiento (patrón de `src/lib/theme.ts`). Se lee con `useSyncExternalStore`: sin efecto que escriba estado, sin desajuste de hidratación y todas las listas abiertas cambian juntas. Test `useProductSortMode.test.tsx` (6 casos: default, guardado, basura, cambio, persistencia entre montajes y falla de almacenamiento). Commit `e9577d5`.
- [x] **T2** [S1, S4, S5] — `ExportWizard` paso 2: `ProductSortToggle` sobre la lista, `availableProducts` ordenado con el modo elegido y `sortBy` enviado al PDF (antes iba `"code"` fijo). El test que fijaba «el modal no tiene selector» se invirtió: ahora exige el control y el orden por código, más un caso nuevo de «última modificación» con su `sortBy`. Commit `e9577d5`.
- [x] **T3** [S1, S4] — `LabelSelector` paso 2: toggle debajo del buscador y `visibles` ordenadas (antes salían en el orden del servidor, sin ordenar en el cliente). Test nuevo: código por defecto y reordenamiento por última modificación. Commit `e9577d5`.
- [x] **T4** [S1, S4] — `MoveStockModal` paso 2: toggle debajo del buscador, `visibles` ordenadas y `getBranchInventory` proyecta `updatedAt` (`code` pasa a obligatorio en `MovableProduct`). Test nuevo en `MoveStockModal.test.tsx`. Commit `e9577d5`.
- [x] **T5** [S1, S4] — `StockAdjustmentModal` paso 2: toggle debajo del buscador, `visibles` ordenadas y `Fila` lleva `updatedAt`. Test nuevo. Commit `e9577d5`.
- [x] **T6** [S1, S4] — `/inventario/control`: toggle sobre la lista de conteo, `itemsOrdenados` con `sortProducts` y `getStockControl` proyecta `updatedAt` (ISO) para cada ítem. Test nuevo en `page.test.tsx` y expectativa del action actualizada. Commit `e9577d5`.
- [x] **T7** [S1–S5] — Cierre: `npm run test:local-db` **110/110 suites y 835/835 tests**; `npx tsc --noEmit` 0 errores; `npm run lint` **0 errores** / 36 warnings preexistentes (ninguno en archivos tocados); `npm run build` OK con `/inventario` y `/inventario/control` presentes. Commit `e9577d5`.

## Log

- **L1** — Pedido original: «Hola, carga lo ultimo en memoria y agregemos algo nuevo a producción, que cuando se entra a los modales de exportar (stock de sucursal, precios) o los modales de movimiento de stock (entre sucursales, entrada/salida, control) que por defecto, en las listas agregemos los filtros como estaban antes para ordenarlas por orden alfabetico o por ultimo modificado»
- **L2** — Estado leído antes de escribir: ninguna de las cinco listas tuvo nunca selector de orden (`git log -S"ProductSortToggle"` vacío en los cuatro archivos y en `control/page.tsx`); «como estaban antes» es el control de la página de inventario, que hoy es `ProductSortToggle` (dos opciones) en inactivos/externo y `InventoryFilters` (cinco opciones) en `/inventario`. Lo que cada lista trae hoy: `ExportWizard` ya recibe `updatedAt` del servidor y ordena por código; `LabelSelector` no ordena en el cliente; `MoveStockModal` recibe el orden del servidor y su proyección **no** tiene `updatedAt`; `StockAdjustmentModal` no ordena y su `Fila` tampoco; `getStockControl` no proyecta `updatedAt`.
- **L3** — Decisiones del usuario: par Código/Última modificación y recordar el último elegido.
- **L4** — Implementación. RED observados: (a) `useProductSortMode.test.tsx` contra un módulo inexistente; (b) el test de `ExportWizard` que afirmaba la ausencia del selector falla al agregarlo. El par de acciones cambia solo **sumando** un campo (`getBranchInventory` y `getStockControl` devuelven `updatedAt`); no se quitó nada del contrato ni se tocó escritura, stock, precios ni permisos.
- **L5** — Dos defectos propios detectados por los checks y corregidos: (a) `tsc` rechazó `code?: string` en `MovableProduct` contra `CodeProduct` de `sortProducts` → `code` pasa a obligatorio; (b) `npm run lint` marcó `react-hooks/set-state-in-effect` en el hook (leer `localStorage` desde un efecto) → se reescribió con `useSyncExternalStore`, que además sincroniza todas las listas abiertas y evita el desajuste de hidratación. Sin verificación en navegador: no hay navegador en esta sesión; el orden y la posición del control quedan para la prueba del usuario en localhost.
- **L6** — Diferencial: no hay comandos ni flags nuevos, así que no aplica la comparación contra el commit base por CLI. Lo que comparte código modificado es la proyección de las dos acciones (solo campo nuevo) y el orden de la lista de exportación, que sigue saliendo por código mientras el usuario no elija otra cosa; ambos quedan fijados por los tests de T2–T6.
