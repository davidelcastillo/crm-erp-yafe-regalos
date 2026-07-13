import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ 
    take: 5, 
    select: { id: true, name: true, code: true, codePrefix: true, price: true, description: true } 
  });
  console.log("Sample products:", JSON.stringify(products, null, 2));
  
  const count = await prisma.product.count();
  console.log("Total:", count);

  const withCode = await prisma.product.count(); // code is now required (non-nullable)
  const withPrefix = await prisma.product.count({ where: { codePrefix: { not: null } } });
  const descDash = await prisma.product.count({ where: { description: "-" } });
  const priceZero = await prisma.product.count({ where: { price: 0 } });

  console.log("with code:", withCode);
  console.log("with codePrefix:", withPrefix);
  console.log("description='-':", descDash);
  console.log("price=0:", priceZero);

  await prisma.$disconnect();
}

main().catch(console.error);