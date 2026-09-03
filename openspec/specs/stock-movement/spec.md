# Domain: stock-movement — Delta

## Delta

Nueva capability; no existe spec base previo (`openspec/specs/stock-movement/spec.md` no existía). Define la action `moveStockBatchBetweenBranches`, que mueve un lote de productos con cantidades distintas entre dos sucursales en una única operación atómica, a diferencia de `moveStockBetweenBranches` (single-product, un movimiento por llamada, sin atomicidad de lote). La nueva action convive con la existente sin modificarla. El contrato de libro contable (`BranchMovement` TRANSFER_OUT/TRANSFER_IN con `reference` y `performedBy`) se mantiene y se extiende a un lote con una referencia de operación común.

## Requirements

1. **Contrato de entrada (SHALL)** — La action `moveStockBatchBetweenBranches` SHALL aceptar un payload de forma `{ sourceBranchId: number, destBranchId: number, items: Array<{ productId: number, quantity: number }>, performedBy: string }` y SHALL retornar `{ success: true, data }` o `{ success: false, error }` con la misma convención de las actions existentes (parseo de objetos con `parseObject`).

2. **Validación zod del lote (SHALL)** — El payload SHALL validarse con un schema zod (`moveStockBatchSchema`) antes de tocar la base de datos, que exija: `items` con al menos 1 elemento; sin `productId` duplicado dentro del lote; `quantity` entera ≥ 1 para cada ítem; y `sourceBranchId ≠ destBranchId` (refine). Los errores de zod SHALL mapearse a mensajes legibles por producto/campo.

3. **Atomicidad en un único `$transaction` (SHALL)** — Todo el procesamiento del lote SHALL ejecutarse en UN solo `prisma.$transaction(async (tx) => ...)` siguiendo el patrón existente de `moveStockBetweenBranches` (inventory.ts:344). NO SHALL realizarse escrituras parciales fuera de la transacción.

4. **Verificación previa de stock de TODOS los ítems (SHALL)** — Dentro de la transacción, antes de cualquier escritura, la action SHALL verificar: que origen y destino sean sucursales activas; que cada `productId` exista y esté activo; y que el stock disponible en origen de cada ítem sea ≥ su `quantity`. La verificación SHALL cubrir el lote completo antes de aplicar el primer decremento.

5. **Rollback total ante fallo parcial (SHALL)** — Si algún ítem del lote no tiene stock suficiente (o falla cualquier validación de pertenencia), la transacción SHALL abortar en su totalidad: ningún `BranchInventory` SHALL modificarse y ninguna fila `BranchMovement` SHALL crearse. El error devuelto SHALL identificar el producto que falló y la cantidad solicitada vs. disponible.

6. **Efecto por ítem y libro contable con referencia común (SHALL)** — Para cada ítem válido, la action SHALL decrementar el stock en origen, incrementar (upsert) el stock en destino, y crear dos registros `BranchMovement` (`TRANSFER_OUT` en origen, `TRANSFER_IN` en destino) con `quantity`, `performedBy` y una `reference` de operación común a TODO el lote (patrón `MOVE-<opId>`), permitiendo agrupar los movimientos del lote en el historial.

7. **Revalidación de rutas (SHALL)** — Tras una operación exitosa, la action SHALL llamar `revalidatePath("/inventario")` y `revalidatePath("/movimientos")`.

8. **Compatibilidad con `moveStockBetweenBranches` (SHALL)** — `moveStockBetweenBranches` SHALL permanecer intacta en firma y comportamiento; la nueva action SHALL ser aditiva. Los 4 casos de `inventory.advanced.test.ts` existentes SHALL seguir en verde.

9. **Pooling transaccional (SHALL)** — La transacción interactiva SHALL ejecutarse sobre una conexión de session pooler (`:5432`); el DSN del entorno de despliegue SHALL replicar el fix P2028 ya aplicado en `.env` para evitar el error de pooling.

## Scenarios

#### Scenario: Batch válido con cantidades distintas

- GIVEN origen B1 (A con stock 10, B con stock 15) y destino B2
- WHEN se ejecuta `moveStockBatchBetweenBranches({ sourceBranchId: 1, destBranchId: 2, items: [{ productId: A, quantity: 3 }, { productId: B, quantity: 7 }], performedBy: "u1" })`
- THEN la operación SHALL completarse en un único `$transaction`
- AND el stock en origen SHALL quedar en 7 (A) y 8 (B); el destino SHALL incrementarse en +3 y +7
- AND SHALL crearse 4 filas `BranchMovement` (2 TRANSFER_OUT, 2 TRANSFER_IN) todas con la misma `reference` y `performedBy: "u1"`

#### Scenario: Stock insuficiente parcial provoca rollback total

- GIVEN origen B1 con A en stock 2 y B en stock 10
- WHEN se ejecuta un lote con `items: [{ productId: A, quantity: 5 }, { productId: B, quantity: 3 }]`
- THEN la transacción SHALL abortar y devolver un error que identifique al producto A (disponible 2, requerido 5)
- AND ni el inventario de A ni el de B SHALL modificarse
- AND ninguna fila `BranchMovement` SHALL crearse

#### Scenario: Origen = destino rechazado por zod

- GIVEN un payload con `sourceBranchId` igual a `destBranchId`
- WHEN se intenta ejecutar la action
- THEN la validación SHALL rechazar el lote sin tocar la base de datos
- AND el error SHALL indicar que origen y destino deben ser distintos

#### Scenario: Lote vacío o con duplicados rechazado

- GIVEN `items` vacío, o con el mismo `productId` repetido, o con una `quantity` 0
- WHEN se intenta ejecutar la action
- THEN zod SHALL rechazar el payload antes de cualquier consulta
- AND NO SHALL abrirse transacción alguna

#### Scenario: `moveStockBetweenBranches` sigue operando sin cambios

- GIVEN la action single-product existente con sus callers y tests
- WHEN se agrega la nueva action batch
- THEN `moveStockBetweenBranches` SHALL conservar firma, validación y comportamiento
- AND los 4 casos actuales de `inventory.advanced.test.ts` SHALL seguir pasando

## Out of Scope

- No se modifican `moveStockBetweenBranches`, `assignStock` ni las actions de compra/venta.
- No se crean migraciones Prisma ni cambios de esquema.
- No se agrega paginación ni particionado de lotes grandes.
- No se define UI aquí (la integración con MoveStockModal pertenece a `inventory-ui`).