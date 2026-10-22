# Control de stock por sucursal

Objetivo: registrar un **cierre de stock** por sucursal (conteo físico que ajusta diferencias), mostrar en el catálogo externo los movimientos de cada producto **desde el último control**, y ofrecer en `/inventario` un selector para ver los movimientos **desde el último control** o **desde la creación del producto**.
Rama: `feat/control-stock` (desde `main` = `b55a7c2`). Entrega: commits locales y PR encadenada si el tamaño lo pide. Verificación: `npm run test:local-db`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, y la prueba del usuario en localhost.

## Specs

- **S1** — «Nueva funcionalidad Control de Stock de inventario para Sucursal, porque a veces cada 1 o 2 semanas cerramos stock.» El control es un **evento manual por sucursal**, sin periodicidad automática; puede haber varios por mes y no hay ventana fija.
- **S2** — Decisión del usuario del 2026-10-21: **«Conteo físico que ajusta el stock»**. Tablas nuevas `StockControl` (con `status: DRAFT | CLOSED`) y `StockControlItem` (con `systemStock` y `countedStock`); al cerrar se genera **un `BranchMovement` de tipo `ADJUSTMENT` por cada producto con diferencia ≠ 0** y el stock de la sucursal queda con lo contado.
- **S3** — «en los inventarios de la sucursal externos, se debe mostrar los movimientos del producto desde el último control de stock». Decisión del usuario: **detalle de cada movimiento** (fecha, tipo y cantidad) visible en el catálogo público.
  - **Límite que se aplica igual**, para no publicar más de lo pedido: sin `performedBy` (quién) y sin `reference` (compra/venta/proveedor). Se publica fecha, tipo y cantidad, nada más. Si el cliente quiere también la referencia, es una decisión nueva y explícita.
- **S4** — «Para la página de inventarios, debe haber un selector en los movimientos del producto, que me permita ver los movimientos desde el ultimo control de stock o desde que se creo el producto.» Decisión del usuario: **arranca en «Desde el último control»**; si la sucursal nunca tuvo un control, cae a «Desde la creación» con un aviso, y el selector mantiene siempre las dos opciones.
- **S5** — Sin control previo no hay sección de movimientos en el catálogo externo ni números inventados: se muestra el stock como hoy. Con control, la sección aparece con su fecha.
- **S6** — Reglas de negocio intactas: el stock sólo cambia al **cerrar** un control, dentro de una transacción, y cada diferencia queda registrada como `ADJUSTMENT` con su actor. Las ventas, compras, traslados y ajustes actuales no cambian de comportamiento. Un control `DRAFT` **no** toca stock.
- **S7** — Autorización: todas las acciones nuevas del control exigen `requireAdmin` (como el resto de `src/app/actions`); el catálogo externo sigue público y de solo lectura, y su consulta nueva no expone más que lo que dice S3.
- **S8** — El esquema requiere tablas y un enum nuevos. **La migración a producción es del usuario**: se entrega SQL idempotente y un checklist; el agente no ejecuta migraciones ni `db push` contra bases remotas.
- **S9** — «cuando se ajusta el conteo fisico luego de controlar, agregar 2 opciones, que se siga mostrando lo que deberia haber para ver si lo encontramos (en ese caso luego agregariamos por entrada si es que encontramos) y la opcion de aceptar, y restar el stock para ajustarse al real». Cada diferencia tiene **dos salidas**: **dejar pendiente** (el stock del sistema **no** cambia y se sigue mostrando el teórico, para buscar la mercadería; si aparece, se registra una entrada como hoy) o **aceptar el ajuste** (el stock pasa a lo contado). Por defecto toda diferencia queda **pendiente**: ajustar es una decisión explícita, nunca automática.
- **S10** — «generando un documento PDF con motivo del ajuste». El cierre con ajustes produce un **PDF del ajuste** con el **motivo** escrito por el usuario y el detalle de lo ajustado, siguiendo el patrón de los comprobantes de stock existentes (logo, encabezado, tabla y paginado).
- **S11** — Lo ajustado y lo pendiente no se mezclan en el historial: sólo las diferencias aceptadas generan `ADJUSTMENT` y mueven stock; las pendientes quedan registradas con su `systemStock` y `countedStock` para poder encontrarlas después. Un control cerrado con pendientes sigue siendo un control cerrado (sirve de corte para «movimientos desde el último control»).

## Tasks

- **T1** [S2,S9] — inline — **hecha** — `prisma/schema.prisma`: `StockControl` (con `reason`), `StockControlItem` (con `decision`), enums `StockControlStatus` y `StockControlDecision`, y las relaciones en `Branch` y `Product`. `npx prisma validate` OK y `npm run db:local:push` aplicado al stack local. El SQL para producción quedó en la sección «Migración a producción» de este documento; no se ejecutó nada remoto.
- **T2** [S2,S6,S7,S9] — inline (delegada al escritor `mvivumn0-2-djv1` y revisada por el padre) — **hecha** — `src/lib/validations/stockControl.ts`, `src/app/actions/stockControl.ts` y su test: cinco acciones (`startStockControl`, `getStockControl`, `saveStockControlCounts`, `closeStockControl`, `getLastClosedStockControl`) con `requireAdmin` primero. **17 casos** en verde tras la revisión. La revisión del padre agregó dos cosas (L8): el comprobante lleva la **decisión por ítem** y se tipa con `StockControlReceipt`, y el cierre se **reclama** dentro de la transacción con un `updateMany` condicionado a `status: DRAFT`.
- **T3** [S1,S2,S9] — inline — **hecha** — `src/app/inventario/control/page.tsx` (con su test): selector de sucursal, último control cerrado, apertura del borrador (reutiliza el `DRAFT` de la sucursal y lo avisa con «retomado»), conteo por producto con la diferencia en vivo («Faltan N» / «Sobran N», nunca solo color), decisión por producto con los dos atajos, guardado del borrador, motivo y cierre con descarga del PDF del ajuste. Entrada desde `/inventario` en `actions` (desde `md`) y en el menú ☰ (mobile), porque la banda de acciones ya cierra 2x2. **6 casos** en verde.
- **T4** [S10] — inline — **hecha** — `src/lib/stock-control-receipt.ts` y `src/lib/utils/stock-control-pdf.ts` con su test: título según haya ajustes o no, sucursal, fecha, control, motivo, una fila por diferencia (sistema, contado, diferencia con signo y color, y la salida «Ajustado»/«Pendiente») y el resumen «N ajustados · M pendientes», con paginado. **5 casos** en verde.
- **T5** [S4] — inline — **hecha** — `getProductMovements` acepta `{ range: 'created' | 'last-control', branchId }` (validado con Zod, default `created`) y devuelve un `meta` con el rango aplicado, la fecha de corte y el `controlClosedAt`; el modal de `/inventario` muestra el selector con «Desde el último control» por defecto cuando hay sucursal, cae a «Desde la creación» con aviso si la sucursal no tuvo control cerrado, y la página le pasa el `branchId` del filtro. **8 casos** nuevos (3 de la acción contra la base local + 5 del selector) en verde; el comportamiento previo (sin opciones: desde la creación, todas las sucursales) queda fijado en su propio caso.
- **T6** [S3,S5,S7] — inline — pending — Acción pública de movimientos desde el último control y su sección en el catálogo externo (fecha, tipo y cantidad).
- **T7** [S1–S11] — inline — pending — Checks, evidencia, SQL para producción y PR.

## Log

- **L1 — Pedido, verbatim**: «Nueva funcionalidad Control de Stock de inventario para Sucursal, porque a veces cada 1 o 2 semanas cerramos stock. Unido a esto, en los inventarios de la sucursal externos, se debe mostrar los movimientos del producto desde el último control de stock. Para la página de inventarios, debe haber un selector en los movimientos del producto, que me permita ver los movimientos desde el ultimo control de stock o desde que se creo el producto. Si queres lancemos un handoff para el diseño con claude o lo haces vos asi como venimos, como vos quieras».
- **L2 — Estado leído antes de escribir**: `BranchMovement` ya registra `movementType` (`ENTRY`, `EXIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`), `quantity`, `reference`, `createdAt` y `performedBy`; `Product.createdAt` existe; `BranchInventory` guarda el stock por sucursal. **No existe** ningún concepto de control de stock (`grep` en `prisma/`, `src/`, `docs/`, `odd/`: cero resultados). El precedente de forma es `CashClose` (`branchId`, `closedAt`, `closedBy`, totales, `@@index([branchId, closedAt])`).
- **L3 — Decisiones del usuario**: «Conteo físico que ajusta el stock»; «Detalle de cada movimiento, público»; «Último control por defecto (recomendado)». Se descartó el handoff de diseño: `STYLE.md` ya define modales, listas y confirmaciones, y la pieza que faltaba era la regla del cierre, no lo visual.
- **L4 — Consecuencia declarada de S3**: publicar el detalle de movimientos deja ver, para cualquiera que abra el catálogo, el ritmo de reposición y de salida de cada producto. Se implementa lo pedido, con el límite de no publicar `performedBy` ni `reference`. Es una decisión del usuario y está registrada como tal.
- **L5 — Ajuste del pedido (2026-10-21), verbatim**: «Para la parte de ontrol de stock, cuando se ajusta el conteo fisico luego de controlar, agregar 2 opciones, que se siga mostrando lo que deberia haber para ver si lo encontramos (en ese caso luego agregariamos por entrada si es que encontramos) y la opcion de aceptar, y restar el stock para ajustarse al real, generando un documento PDF con motivo del ajuste». Se abre S9–S11 y el esquema cambia respecto de lo ya conversado: cada diferencia lleva su decisión y el ajuste deja de ser automático al cerrar. **Ninguna diferencia se aplica por defecto.**
- **L6 — Cómo se lee lo de «en ese caso luego agregaríamos por entrada»**: la salida «pendiente» **no** crea movimientos ni toca stock; el sistema sigue mostrando el teórico y, si la mercadería aparece, el usuario registra una `ENTRY` con el flujo que ya existe. Es exactamente lo que pidió, y evita inventar un estado nuevo de inventario.
- **L7 — Segunda ronda de decisiones (2026-10-21)**: «Por producto, con atajos (recomendado)» — cada diferencia se marca pendiente o aceptada por separado, con un atajo para aplicar a todas — y «También ajustan, sumando (recomendado)» — un sobrante aceptado **suma** al stock con su `ADJUSTMENT` positivo, igual que un faltante resta. Con esto el cierre queda: se cuenta, se revisan diferencias, se decide por producto y se cierra; sólo lo aceptado mueve stock y lo pendiente queda registrado para seguir buscando la mercadería.
- **L8 — Revisión del trabajo delegado (2026-10-21)**: el escritor entregó las cinco acciones con 16 casos y su propio RED observado (módulo inexistente) → GREEN. La revisión del padre encontró y corrigió tres cosas: (1) el comprobante del cierre **no llevaba la decisión de cada ítem**, así que el PDF no podía distinguir «Ajustado» de «Pendiente»: se agregó `decision` y el comprobante se tipa con `StockControlReceipt` (fuente única para la acción y el PDF, declarado como `type` y no `interface` para que `parseObject` lo acepte sin casteos); (2) el chequeo de `status` del cierre era una **lectura previa** a la transacción, así que dos cierres simultáneos podrían haber ajustado el stock dos veces: ahora el cierre se **reclama** con un `updateMany({ where: { id, status: "DRAFT" } })` dentro de la transacción y, si no afecta ninguna fila, aborta sin tocar nada (caso de test propio); (3) `CountedItem.decision` estaba tipado como `string` y rompía `tsc` al compararlo con el tipo del comprobante. Estado tras la revisión: **22 casos** (17 de las acciones + 5 del PDF) en verde, `tsc` 0, eslint 0. El cliente Prisma se verificó contra la base local (`stockControl.count()` y `stockControlItem.count()` responden 0). Queda anotado, sin corregir, que **iniciar** dos controles a la vez podría crear dos borradores (no hay índice único parcial): es visible y no toca stock, así que se acepta con un solo admin.

- **L9 — Reanudación y cierre de T5 (2026-10-22)**: al retomar tras el cierre de la terminal, la memoria (#1372) daba T5 como pendiente, pero el árbol tenía el rango ya escrito en `src/app/actions/product.ts` y en `MovementsModal.tsx` sin commitear y sin tests: la sesión anterior se cortó a mitad de T5. Se completó lo que faltaba (la página pasa el `branchId` del filtro, y los tests de la acción y del selector) y se verificó el RED contra el código previo sin tocar el árbol: `git stash push` de los dos archivos de producción, `npm run test:local-db -- … -t "rango"` → **6 fallos** (las llamadas esperadas con `{ range, branchId }` no ocurrían), `git stash pop` con los cambios restaurados. GREEN después: **14 casos** en verde en los dos archivos, `tsc` 0 y eslint 0 errores (35 avisos previos del repo). Queda anotado que la implementación precedió a sus tests por el corte, no por decisión de método.

- **L10 — T3 observado (2026-10-22)**: la pantalla se escribió después del test y el RED se observó moviendo `page.tsx` fuera del árbol (`mv` temporal): `npx jest src/app/inventario/control` → `Cannot find module './page'`, `Tests: 0 total`; restaurado el archivo, **6 casos** en verde, `tsc` 0 y eslint 0 errores en los archivos nuevos. Decisiones de la unidad: (1) la entrada vive en `/inventario` (`actions` para desktop y `menuItems` del ☰ para mobile) porque la banda de acciones cierra 2x2 y el `BottomNav` ya usa sus cinco destinos de `STYLE.md`; (2) entrar a la pantalla no escribe nada: el último control se lee y el borrador se abre con un click explícito, y como `startStockControl` reutiliza el `DRAFT` de la sucursal, «retomar» es el mismo botón; (3) el cierre guarda primero el conteo (`saveStockControlCounts`) y recién después cierra, porque `closeStockControl` ajusta a partir de lo persistido; (4) si el PDF falla después del cierre, el mensaje dice que el control **ya se cerró** y que no hay que repetirlo (el ajuste ya movió stock). No se agregó búsqueda ni filtro por categoría en la lista de conteo: es una lista corta por sucursal y no estaba pedido.

## Migración a producción (del usuario, no del agente)

Generado con `npx prisma migrate diff` entre el esquema de `main` y el de esta rama. **Se corre una sola vez**, en el editor SQL del proyecto Supabase de producción; Prisma no agrega `IF NOT EXISTS`, así que volver a correrlo avisa que el objeto ya existe (no rompe nada). Antes: backup del proyecto y una ventana sin uso. El agente **no** ejecuta esto.

```sql
-- CreateEnum
CREATE TYPE "StockControlStatus" AS ENUM ('DRAFT', 'CLOSED');

-- CreateEnum
CREATE TYPE "StockControlDecision" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "StockControl" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "status" "StockControlStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reason" TEXT,

    CONSTRAINT "StockControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockControlItem" (
    "id" SERIAL NOT NULL,
    "controlId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "systemStock" INTEGER NOT NULL,
    "countedStock" INTEGER NOT NULL,
    "decision" "StockControlDecision" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "StockControlItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockControl_branchId_closedAt_idx" ON "StockControl"("branchId", "closedAt");

-- CreateIndex
CREATE INDEX "StockControl_branchId_status_idx" ON "StockControl"("branchId", "status");

-- CreateIndex
CREATE INDEX "StockControlItem_controlId_idx" ON "StockControlItem"("controlId");

-- CreateIndex
CREATE UNIQUE INDEX "StockControlItem_controlId_productId_key" ON "StockControlItem"("controlId", "productId");

-- AddForeignKey
ALTER TABLE "StockControl" ADD CONSTRAINT "StockControl_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockControlItem" ADD CONSTRAINT "StockControlItem_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "StockControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockControlItem" ADD CONSTRAINT "StockControlItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

```
