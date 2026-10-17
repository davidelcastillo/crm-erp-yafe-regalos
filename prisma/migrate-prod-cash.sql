-- =============================================================================
-- Publicación de la versión con caja: crea lo único que le faltaba al esquema de
-- PRODUCCIÓN para que el código de la rama `fix/bugs-usuarios` funcione.
--
-- ESTADO: APLICADO Y VERIFICADO el 2026-10-17. La base remota
-- `zvcgksucblpaqtajdvws` ya tiene el enum `CashMovementType` y las tablas
-- `CashMovement` y `CashClose`, con las columnas, los tipos, los defaults, los
-- índices, las claves foráneas y el régimen de seguridad que declara
-- `prisma/schema.prisma` —RLS habilitado, sin grants a anon/authenticated— y
-- **0 filas**. La verificación fue de solo lectura (information_schema,
-- pg_indexes, pg_constraint, pg_class, role_table_grants). El script queda en el
-- repo como registro de lo aplicado: es idempotente, volver a correrlo no cambia
-- nada.
--
-- Contexto original: `npx prisma migrate diff --from-url <DIRECT_URL>
-- --to-schema-datamodel prisma/schema.prisma --script` mostraba que producción
-- tenía 11 tablas y le faltaban `CashMovementType`, `CashMovement` y `CashClose`.
-- Sin esto, el cierre de caja y los movimientos de caja morían con
-- "table does not exist". El resto del drift (Product.stock —que sigue en
-- producción como `NOT NULL DEFAULT 0` y no molesta—, el NOT NULL de
-- Branch.code/Purchase.branchId/Sale.branchId, índices extra) NO se toca acá:
-- no bloquea la publicación y no se borra ni se migra ningún dato existente.
--
-- Es ADITIVO e IDEMPOTENTE: se puede correr más de una vez sin efecto extra.
--
-- Aplicar contra PRODUCCIÓN (solo si hiciera falta de nuevo):
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/migrate-prod-cash.sql
-- =============================================================================

BEGIN;

-- 1. Enum del tipo de movimiento de caja.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashMovementType') THEN
    CREATE TYPE "CashMovementType" AS ENUM ('INGRESO', 'EGRESO');
  END IF;
END$$;

-- 2. Movimientos de caja (plata que entra o sale sin ser venta ni compra).
CREATE TABLE IF NOT EXISTS "CashMovement" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- 3. Cierre de caja por sucursal: el corte que deja las ventas anteriores como
--    caja cerrada y permite resetear los indicadores.
CREATE TABLE IF NOT EXISTS "CashClose" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    "cashTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transferTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mixedTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CashClose_pkey" PRIMARY KEY ("id")
);

-- 4. Índices que declara el esquema.
CREATE INDEX IF NOT EXISTS "CashMovement_branchId_idx" ON "CashMovement"("branchId");
CREATE INDEX IF NOT EXISTS "CashMovement_date_idx" ON "CashMovement"("date");
CREATE INDEX IF NOT EXISTS "CashClose_branchId_closedAt_idx" ON "CashClose"("branchId", "closedAt");

-- 5. Claves foráneas (Postgres no admite IF NOT EXISTS en ADD CONSTRAINT).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_branchId_fkey') THEN
    ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashClose_branchId_fkey') THEN
    ALTER TABLE "CashClose" ADD CONSTRAINT "CashClose_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 6. Seguridad: estas tablas nacen con el mismo régimen que las otras 11 de
--    producción (RLS habilitado, sin políticas, sin grants a anon/authenticated),
--    así no se reabre el agujero que ya está cerrado en el resto del esquema.
ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashClose" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "CashMovement" FROM anon, authenticated;
REVOKE ALL ON TABLE "CashClose" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "CashMovement_id_seq" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "CashClose_id_seq" FROM anon, authenticated;

COMMIT;
