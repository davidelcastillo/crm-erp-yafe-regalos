1. Al intentar mover stock de una sucursal a otra, ahora me sale un nuevo error en consola, aparentemente relacionado con las transacciones en prisma, el log exacto es el siguiente : 'prisma:query BEGIN
prisma:query DEALLOCATE ALL
prisma:query SELECT "public"."Branch"."id" FROM "public"."Branch" WHERE ("public"."Branch"."id" = $1 AND "public"."Branch"."isActive" = $2) LIMIT $3 OFFSET $4
prisma:query SELECT "public"."Branch"."id" FROM "public"."Branch" WHERE ("public"."Branch"."id" = $1 AND "public"."Branch"."isActive" = $2) LIMIT $3 OFFSET $4
prisma:query SELECT "public"."Product"."id", "public"."Product"."active", "public"."Product"."name" FROM "public"."Product" WHERE ("public"."Product"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3
prisma:query SELECT "public"."BranchInventory"."id", "public"."BranchInventory"."branchId", "public"."BranchInventory"."productId", "public"."BranchInventory"."stock", "public"."BranchInventory"."lastUpdated" FROM "public"."BranchInventory" WHERE (("public"."BranchInventory"."branchId" = $1 AND "public"."BranchInventory"."productId" = $2) AND 1=1) LIMIT $3 OFFSET $4
prisma:query SELECT "public"."BranchInventory"."id", "public"."BranchInventory"."branchId", "public"."BranchInventory"."productId", "public"."BranchInventory"."stock", "public"."BranchInventory"."lastUpdated" FROM "public"."BranchInventory" WHERE (("public"."BranchInventory"."branchId" = $1 AND "public"."BranchInventory"."productId" = $2) AND 1=1) LIMIT $3 OFFSET $4
prisma:query INSERT INTO "public"."BranchInventory" ("branchId","productId","stock","lastUpdated") VALUES ($1,$2,$3,$4) ON CONFLICT ("branchId","productId") DO UPDATE SET "stock" = $5, "lastUpdated" = $6 WHERE (("public"."BranchInventory"."branchId" = $7 AND "public"."BranchInventory"."productId" = $8) AND 1=1) RETURNING "public"."BranchInventory"."id", "public"."BranchInventory"."branchId", "public"."BranchInventory"."productId", "public"."BranchInventory"."stock", "public"."BranchInventory"."lastUpdated"
prisma:query INSERT INTO "public"."BranchInventory" ("branchId","productId","stock","lastUpdated") VALUES ($1,$2,$3,$4) ON CONFLICT ("branchId","productId") DO UPDATE SET "stock" = $5, "lastUpdated" = $6 WHERE (("public"."BranchInventory"."branchId" = $7 AND "public"."BranchInventory"."productId" = $8) AND 1=1) RETURNING "public"."BranchInventory"."id", "public"."BranchInventory"."branchId", "public"."BranchInventory"."productId", "public"."BranchInventory"."stock", "public"."BranchInventory"."lastUpdated"
prisma:query INSERT INTO "public"."BranchMovement" ("productId","branchId","movementType","quantity","reference","createdAt","performedBy") VALUES ($1,$2,CAST($3::text AS "public"."MovementType"),$4,$5,$6,$7) RETURNING "public"."BranchMovement"."id", "public"."BranchMovement"."productId", "public"."BranchMovement"."branchId", "public"."BranchMovement"."movementType"::text, "public"."BranchMovement"."quantity", "public"."BranchMovement"."reference", "public"."BranchMovement"."createdAt", "public"."BranchMovement"."performedBy"
prisma:query INSERT INTO "public"."BranchMovement" ("productId","branchId","movementType","quantity","reference","createdAt","performedBy") VALUES ($1,$2,CAST($3::text AS "public"."MovementType"),$4,$5,$6,$7) RETURNING "public"."BranchMovement"."id", "public"."BranchMovement"."productId", "public"."BranchMovement"."branchId", "public"."BranchMovement"."movementType"::text, "public"."BranchMovement"."quantity", "public"."BranchMovement"."reference", "public"."BranchMovement"."createdAt", "public"."BranchMovement"."performedBy"
Error moving stock between branches: Error [PrismaClientKnownRequestError]: Transaction API error: Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting.
    at async moveStockBetweenBranches (src\app\actions\inventory.ts:344:20)
  342 |       validatedData;
  343 |
> 344 |     const result = await prisma.$transaction(async (...
      |                    ^
  345 |       // 1. Verificar branches activas
  346 |       const [sourceBranch, destBranch] = await Promi...
  347 |         tx.branch.findFirst({ {
  code: 'P2028',
  meta: {
    error: "Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting."
  },
  clientVersion: '6.19.3'
}
prisma:query ROLLBACK
 POST /inventario 200 in 5.9s (next.js: 8ms, proxy.ts: 573ms, application-code: 5.3s)
  └─ ƒ moveStockBetweenBranches({"destBranchId":253,"performedBy":"admin","productId":108,"...":"2 items not stringified"}) in 5329ms src/app/actions/inventory.ts
prisma:query SELECT 1
prisma:query BEGIN
prisma:query DEALLOCATE ALL
prisma:query SELECT "public"."Branch"."id" FROM "public"."Branch" WHERE ("public"."Branch"."id" = $1 AND "public"."Branch"."isActive" = $2) LIMIT $3 OFFSET $4
prisma:query SELECT "public"."Branch"."id" FROM "public"."Branch" WHERE ("public"."Branch"."id" = $1 AND "public"."Branch"."isActive" = $2) LIMIT $3 OFFSET $4
prisma:query SELECT "public"."Product"."id", "public"."Product"."active", "public"."Product"."name" FROM "public"."Product" WHERE ("public"."Product"."id" = $1 AND 1=1) LIMIT $2 OFFSET $3
prisma:query SELECT "public"."BranchInventory"."id", "public"."BranchInventory"."branchId", "public"."BranchInventory"."productId", "public"."BranchInventory"."stock", "public"."BranchInventory"."lastUpdated" FROM "public"."BranchInventory" WHERE (("public"."BranchInventory"."branchId" = $1 AND "public"."BranchInventory"."productId" = $2) AND 1=1) LIMIT $3 OFFSET $4
prisma:query ROLLBACK
 POST /inventario 200 in 3.6s (next.js: 6ms, proxy.ts: 597ms, application-code: 3.0s)
  └─ ƒ moveStockBetweenBranches({"destBranchId":253,"performedBy":"admin","productId":115,"...":"2 items not stringified"}) in 3008ms src/app/actions/inventory.ts'