#!/usr/bin/env npx tsx
/**
 * Migration script: Populate code, codePrefix, price, description for existing 102 products
 * Run: npx tsx scripts/migrate-product-codes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Iniciando migración de 102 productos...");

  // 1. Fetch all products
  const products = await prisma.product.findMany({
    select: { id: true, name: true, description: true, stock: true },
    orderBy: { id: "asc" },
  });

  console.log(`📦 Encontrados ${products.length} productos`);

  let migrated = 0;
  let legacy = 0;

  for (const product of products) {
    const desc = product.description || "";
    
    // Try to extract code pattern: ^[A-Z]{2,4}[0-9]{3}$
    const codeMatch = desc.match(/^([A-Z]{2,4})([0-9]{3})$/);
    
    let code: string;
    let codePrefix: string;

    if (codeMatch) {
      // Valid pattern found - use it
      code = desc; // e.g., "AA001", "PROD005"
      codePrefix = codeMatch[1]; // e.g., "AA", "PROD"
      migrated++;
    } else {
      // No valid pattern - generate LEGACY code
      code = `LEGACY${String(product.id).padStart(6, '0')}`; // LEGACY000001
      codePrefix = "LEGACY";
      legacy++;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        code,
        codePrefix,
        price: 0,
        description: "-", // User requirement: '-' not NULL
      },
    });

    if (migrated % 20 === 0 || legacy % 20 === 0) {
      console.log(`  Procesados: ${migrated + legacy}/${products.length} (migrados: ${migrated}, legacy: ${legacy})`);
    }
  }

  console.log(`\n✅ Migración completada:`);
  console.log(`   - Productos con código válido migrado: ${migrated}`);
  console.log(`   - Productos con código LEGACY generado: ${legacy}`);
  console.log(`   - Total: ${migrated + legacy}`);

  // 2. Add unique constraint on code (now all populated)
  console.log("\n🔧 Agregando UNIQUE constraint en code...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Product" ADD CONSTRAINT "Product_code_key" UNIQUE ("code");
  `);
  console.log("✅ UNIQUE constraint agregado");

  // 3. Verify
  const verification = await prisma.product.aggregate({
    _count: { code: true, codePrefix: true },
    _min: { price: true },
    _max: { price: true },
  });

  const descCheck = await prisma.product.count({
    where: { description: "-" },
  });

  console.log("\n📊 Verificación post-migración:");
  console.log(`   - Products with code: ${verification._count.code}`);
  console.log(`   - Products with codePrefix: ${verification._count.codePrefix}`);
  console.log(`   - Price min: ${verification._min.price}, max: ${verification._max.price}`);
  console.log(`   - Description = '-': ${descCheck}`);

  if (verification._count.code === products.length && descCheck === products.length) {
    console.log("\n🎉 MIGRACIÓN EXITOSA - Todos los criterios cumplidos");
  } else {
    console.log("\n⚠️ VERIFICACIÓN FALLÓ - Revisar datos");
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });