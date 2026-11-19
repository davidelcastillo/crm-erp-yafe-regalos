# Plan de la próxima fase

Fuentes: `Funcionalidades 2 (1).md` (5 mejoras del dueño) + `docs/adr/catalogo-externo.md` (catálogo).
Estado: plan de trabajo, sin implementar. PRs 11 y 12 ya mergeados en `main`.

## Cambios grandes (fase nueva)

**F1 — Catálogo público global v1.** Esquema (`CatalogItem`, `CatalogItemBranch`, vista
`catalog_public`), ruta pública nueva, admin de curaduría, etiquetas de sucursal ocultables por
producto. Bloqueado por las respuestas del cliente final (ADR-01, 03, 04, 06; preguntas del §6 del
ADR). Front con el estilo actual, sin rediseño.

**F2 — Fotos por producto (hasta 4).** `ProductImage`, bucket de Supabase Storage, subida
redimensionada en el navegador, miniaturas. **Partible**: F1 funciona sin fotos; F2 se puede entregar
después sin rehacer nada de F1.

Diseño de F1/F2: delegado a Claude (opus 5.5, modo plan) vía Orca, canal por `.md`
(`docs/adr/catalogo-brief-claude.md`).

## Cambios pequeños (sobre lo existente)

| ID | Qué | Tipo | Hipótesis de causa | Dónde |
|---|---|---|---|---|
| M1 | No se pueden seleccionar categorías del producto 2 en adelante en la creación masiva | **Bug (regresión de la alta masiva, ya en `main`)** — VERIFICADO por el dueño, commit `2c033c6` | Causa confirmada: falta `relative` en el contenedor del popup (`CategorySelector.tsx:186`); el listbox `absolute` se colgaba del overlay y no acompañaba el scroll de filas. La colisión de ids quedó descartada | `CategorySelector.tsx`, `CategorySelector.test.tsx`; rama `fix/categoria-lote-relative` |
| M2 | En caja → movimiento de caja sigue apareciendo el selector de sucursales; el wizard del paso 1 debería quitarlo | Bug — **VERIFICADO por el dueño, commit `65df1ad`** | Dos causas: el modal no recibía la sucursal (ahora `fixedBranchId` desde la página) y una doble verdad — el selector del encabezado escribe el BranchContext global mientras la página guardaba una copia local en `null`; la página ahora lee `useBranch()`. Con «Todas» pide como siempre. `CashCloseModal` queda COMO ESTÁ por decisión del dueño («Dejémoslo así») | `CashMovementsModal.tsx`, `ventas/page.tsx` |
| M3 | Debounce lento en búsquedas de compras/ventas/inventario; en ingreso/egreso de stock anda bien — **y las páginas de ventas e inventario tardan en cargar** | Perf — DECIDIDO: (1) el patrón "bueno" no tiene debounce: filtra en memoria; (2) `/ventas`: dejar de re-pedir todos los productos por cada búsqueda (y que la lista no espere a esa carga); (3) `/inventario`: filtro en memoria como los modales; (4) `ProductSearch` (modal de venta): lista inyectada, sin red por tecla | Mediciones contra la base local: 80 productos; queries 3-20ms; el único lento es el arranque frío del pool (1,1s por proceso). La lentitud restante es modo dev + llamadas redundantes. Worker implementando (RED→GREEN) | `ventas/page.tsx`, `inventario/page.tsx`, `ProductSearch.tsx`, `AddSaleButton.tsx` |
| M4 | Leyenda "sesión iniciada" flotante | UX — **VERIFICADO por el dueño, commit `54e0861`** | Recuadro `rounded-xl` con `bg-positive/10` + borde suave, con test de forma | `LoginForm.tsx`, `LoginForm.test.tsx` |
| M5 | Listar productos seleccionados + cantidades en el resumen de ingreso/egreso de stock (y mover stock) | Feature chica | El div de resumen existe; falta el listado | `StockAdjustmentModal`, `MoveStockModal` |

Orden propuesto: **M1 primero** (regresión ya mergeada), después M4, M2, M3, M5. Cada una con su
reproducción antes de tocar código, un bug por vez (`AGENTS.md` §3.1). Rama nueva desde `main`
actualizado para M1; el resto según alcance.

## Reparto de pruebas (acordado con el dueño)

- **Yo (back)**: RED/GREEN, tests unitarios, `npm run test:local-db` contra base aislada, `tsc`,
  `lint`, `build`.
- **El dueño (front)**: verificación en navegador y celular de cada fix/feature.
- Catálogo: el diseño lo hace Claude en paralelo; nada de F1/F2 se implementa hasta cerrar los ADRs
  pendientes con el cliente final.
