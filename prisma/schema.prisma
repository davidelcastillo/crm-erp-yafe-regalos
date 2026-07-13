generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Product {
  id            Int            @id @default(autoincrement())
  name          String
  description   String?        @default("-")
  stock         Int            @default(0)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  code          String         @unique
  codePrefix    String?
  price         Decimal        @default(0) @db.Decimal(10, 2)
  purchaseItems PurchaseItem[]
  saleItems     SaleItem[]

  @@index([codePrefix])
  @@index([code, name])
}

model Purchase {
  id          Int            @id @default(autoincrement())
  date        DateTime       @default(now())
  createdAt   DateTime       @default(now())
  totalAmount Decimal        @default(0) @db.Decimal(10, 2)
  updatedAt   DateTime       @updatedAt
  items       PurchaseItem[]
}

model PurchaseItem {
  id         Int      @id @default(autoincrement())
  purchaseId Int
  productId  Int
  price      Decimal  @db.Decimal(10, 2)
  quantity   Int
  subtotal   Decimal  @db.Decimal(10, 2)
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)

  @@index([purchaseId])
  @@index([productId])
}

model Sale {
  id             Int           @id @default(autoincrement())
  date           DateTime      @default(now())
  createdAt      DateTime      @default(now())
  totalAmount    Decimal       @default(0) @db.Decimal(10, 2)
  updatedAt      DateTime      @updatedAt
  amountPaid     Decimal       @default(0) @db.Decimal(10, 2)
  pendingBalance Decimal       @default(0) @db.Decimal(10, 2)
  customerId     Int?
  paymentMethod  PaymentMethod @default(EFECTIVO)
  customer       Customer?     @relation(fields: [customerId], references: [id])
  items          SaleItem[]

  @@index([customerId])
}

model SaleItem {
  id        Int     @id @default(autoincrement())
  saleId    Int
  productId Int
  price     Decimal @db.Decimal(10, 2)
  quantity  Int
  subtotal  Decimal @db.Decimal(10, 2)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  sale      Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([saleId])
  @@index([productId])
}

model Customer {
  id           Int       @id @default(autoincrement())
  name         String
  surname      String
  totalBalance Decimal   @default(0) @db.Decimal(10, 2)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  payments     Payment[]
  sales        Sale[]
}

model Payment {
  id         Int      @id @default(autoincrement())
  customerId Int
  amount     Decimal  @db.Decimal(10, 2)
  date       DateTime @default(now())
  customer   Customer @relation(fields: [customerId], references: [id])

  @@index([customerId])
}

enum PaymentMethod {
  EFECTIVO
  TRANSFERENCIA
  MIXTO
}
