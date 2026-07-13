-- =============================================================================
-- Pre-migration script: assign temporary unique codes to existing Product rows
-- in PRODUCTION before running `npx prisma db push`.
--
-- WHY: The new schema adds `Product.code` TEXT NOT NULL UNIQUE. Existing rows
-- in prod do not have a code yet. Prisma db push would FAIL with
-- "column contains null values" or violate the UNIQUE constraint.
--
-- This script is IDEMPOTENT: safe to run multiple times. If `Product.code`
-- does not exist yet, it creates it (nullable first, fills values, then we
-- let Prisma enforce NOT NULL). If it already exists, it only fills the NULLs.
--
-- Run this BEFORE `npx prisma db push` against the PRODUCTION database.
-- =============================================================================

BEGIN;

-- 1. Ensure the code column exists (nullable for now; db push will tighten later)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Product'
      AND column_name  = 'code'
  ) THEN
    ALTER TABLE "Product" ADD COLUMN "code" TEXT;
  END IF;
END$$;

-- 2. Ensure codePrefix column exists (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Product'
      AND column_name  = 'codePrefix'
  ) THEN
    ALTER TABLE "Product" ADD COLUMN "codePrefix" TEXT;
  END IF;
END$$;

-- 3. Ensure price column exists with default 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Product'
      AND column_name  = 'price'
  ) THEN
    ALTER TABLE "Product"
      ADD COLUMN "price" NUMERIC(10, 2) NOT NULL DEFAULT 0;
  END IF;
END$$;

-- 4. Ensure description has the new default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Product'
      AND column_name  = 'description'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE "Product" ALTER COLUMN "description" SET DEFAULT '-';
  END IF;
END$$;

-- 5. Fill NULL descriptions with the new default (so NOT NULL constraints later work)
UPDATE "Product" SET "description" = '-' WHERE "description" IS NULL;

-- 6. Assign unique temporary codes to existing rows that don't have one.
--    Format: TMP<zero-padded id, 5 digits>  -> e.g. TMP00001
--    No codePrefix is set here (stays NULL) — that's fine; it's nullable.
--    Using ROW_NUMBER so even if some existing codes look like ours, we avoid
--    collisions by prefixing with 'TMP' + a sequence never reused.
WITH rows_to_update AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM "Product"
  WHERE "code" IS NULL
)
UPDATE "Product" p
SET "code" = 'TMP' || lpad(r.rn::text, 5, '0')
FROM rows_to_update r
WHERE p.id = r.id;

-- 7. Create the UNIQUE constraint on Product.code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_code_key'
  ) THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_code_key" UNIQUE ("code");
  END IF;
END$$;

-- 8. Make code NOT NULL now that all rows have a value
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Product'
      AND column_name  = 'code'
      AND is_nullable  = 'YES'
  ) THEN
    ALTER TABLE "Product" ALTER COLUMN "code" SET NOT NULL;
  END IF;
END$$;

-- 9. Create the two new indexes if they don't exist
CREATE INDEX IF NOT EXISTS "Product_codePrefix_idx" ON "Product" ("codePrefix");
CREATE INDEX IF NOT EXISTS "Product_code_name_idx"  ON "Product" ("code", "name");

-- 10. Create the PaymentMethod enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typname = 'PaymentMethod'
  ) THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'MIXTO');
  END IF;
END$$;

-- 11. Add Sale.paymentMethod column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Sale'
      AND column_name  = 'paymentMethod'
  ) THEN
    ALTER TABLE "Sale"
      ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO';
  END IF;
END$$;

COMMIT;

-- Verification queries (run after COMMIT to check)
SELECT 'Product columns:' AS info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Product'
ORDER BY ordinal_position;

SELECT 'Sale.paymentMethod:' AS info;
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Sale' AND column_name = 'paymentMethod';

SELECT 'Indexes on Product:' AS info;
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'Product'
ORDER BY indexname;

SELECT 'Enum PaymentMethod values:' AS info;
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public' AND t.typname = 'PaymentMethod'
ORDER BY e.enumsortorder;
