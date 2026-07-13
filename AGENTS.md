# Project Overview

**Nombre:** Stark Commerce OS (Local Business Controller)
**Descripción:** Aplicación web _mobile-first_ optimizada para Android, diseñada para controlar de forma intuitiva los ingresos, egresos y el inventario general de un comercio local.
**Entorno:** Cloud (Next.js alojado en Vercel + Base de datos relacional en Supabase administrada a través de Prisma).

# Architecture & Modules

El agente debe estructurar la aplicación obligatoriamente en los siguientes **6 módulos principales**:

1.  **Módulo de Productos (Alta):** Pantalla para registrar nuevos items.
    - Datos: `Nombre`, `Descripción` (Opcional), `Stock inicial`, **`Precio base`**, **`Prefijo código (2-4 letras)`**
    - **Código auto-generado**: formato `AAA000` (prefijo + secuencial 3 dígitos, inicia en 000)
    - Acciones: Crear, Editar (precio/descripción), Eliminar, Lista con código + precio

2.  **Módulo de Compras (Ingresos):** Historial de compras (tabla adaptativa móvil).
    - Filtros: Por producto, ordenamiento, fechas
    - Acción: "Registrar Nueva Compra" → Modal con: selector producto (busca por código/nombre), precio compra, cantidad
    - **Crear producto inline**: Botón "➕ Nuevo producto" abre modal anidado con formulario Producto

3.  **Módulo de Ventas (Egresos):** Historial de ventas (tabla sencilla).
    - Filtros: Búsqueda por **código o nombre**, ordenamiento, fechas
    - Acción: "Registrar Nueva Venta" → Modal con: **búsqueda producto (código/nombre)**, precio venta (pre-fill desde producto, editable), cantidad
    - **Método de pago**: Selector `EFECTIVO` | `TRANSFERENCIA` | `MIXTO`
      - `EFECTIVO`: amountPaid = total, pendingBalance = 0
      - `TRANSFERENCIA`: amountPaid = 0, pendingBalance = total
      - `MIXTO`: inputs manuales efectivo + transferencia

4.  **Módulo de Inventario:** Gestión de stock tiempo real.
    - Lista productos con stock actual, **búsqueda por código o nombre**
    - Acciones: Editar (modal datos básicos), Eliminar (confirmación)

5.  **Módulo de Clientes:** Gestión y seguimiento de deudas.
    - Lista clientes con saldo pendiente
    - Acciones: Registrar pago, Ver historial ventas/deudas

6.  **Dashboard Interactivo:** Panel analítico.
    - Tarjetas resumen: productos, ventas, compras, totales por método pago
    - Tabla Rendimiento: selecciona producto → historial compras/ventas + ganancias/pérdidas (precio venta - precio base)

# Tech Stack

- **Framework:** Next.js 16 (App Router).
- **Base de Datos:** PostgreSQL (Supabase).
- **ORM:** Prisma.
- **Despliegue:** Vercel.
- **Lenguaje:** TypeScript.
- **Estilos:** Tailwind CSS v4.
- **Charts:** Recharts.
- **Validación:** Zod v4.
- **Alertas:** SweetAlert2.

# Skills (Mapas de Conocimiento)

El agente debe consultar obligatoriamente estos archivos antes de implementar:

- **Next.js & App Router:** `skills/next-best-practices/app-router.md`
- **Prisma ORM Best Practices:** `skills/prisma-best-practices/schema-and-migrations.md`
- **Supabase PostgreSQL:** `agents/skills/supabase-postgres-best-practices/`
- **Mobile-First UI Design:** `skills/frontend-design/android-mobile-first.md`
- **Vercel Deployment:** `skills/vercel-react-best-practices/`
- **Frontend Design:** `skills/frontend-design/`
- **UI/UX Design:** `skills/ui-ux-pro-max/`
- **Web Development:** `skills/web-development/`
- **Mobile Design:** `.agents/skills/mobile-design/`

# Data Structure Requirements (Prisma Schema)

Esquema actual en `prisma/schema.prisma`:

```prisma
// Product - Items en inventario
model Product {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  stock       Int      @default(0)
  price       Decimal  @default(0) @db.Decimal(10, 2)  // Precio base venta
  code        String   @unique                        // Código AAA000
  codePrefix  String?                                 // Prefijo para queries
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  purchaseItems PurchaseItem[]
  saleItems     SaleItem[]
  @@index([codePrefix])
  @@index([code, name])
}

// Purchase - Cabecera de compra
model Purchase {
  id          Int      @id @default(autoincrement())
  date        DateTime @default(now())
  totalAmount Decimal  @default(0) @db.Decimal(10, 2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  items       PurchaseItem[]
}

// PurchaseItem - Detalle de compra
model PurchaseItem {
  id         Int     @id @default(autoincrement())
  purchaseId Int
  productId  Int
  price      Decimal @db.Decimal(10, 2)   // Precio compra
  quantity   Int
  subtotal   Decimal @db.Decimal(10, 2)
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@index([purchaseId])
  @@index([productId])
}

// Sale - Cabecera de venta
model Sale {
  id             Int      @id @default(autoincrement())
  date           DateTime @default(now())
  totalAmount    Decimal  @default(0) @db.Decimal(10, 2)
  amountPaid     Decimal  @default(0) @db.Decimal(10, 2)
  pendingBalance Decimal  @default(0) @db.Decimal(10, 2)
  paymentMethod  PaymentMethod @default(EFECTIVO)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  customerId     Int?
  customer       Customer? @relation(fields: [customerId], references: [id])
  items          SaleItem[]
  @@index([customerId])
}

// SaleItem - Detalle de venta
model SaleItem {
  id        Int     @id @default(autoincrement())
  saleId    Int
  productId Int
  price     Decimal @db.Decimal(10, 2)   // Precio venta
  quantity  Int
  subtotal  Decimal @db.Decimal(10, 2)
  sale      Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@index([saleId])
  @@index([productId])
}

// Customer - Clientes con deuda
model Customer {
  id           Int      @id @default(autoincrement())
  name         String
  surname      String
  totalBalance Decimal  @default(0) @db.Decimal(10, 2)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sales        Sale[]
  payments     Payment[]
}

// Payment - Pagos de clientes
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

```

## Directiva Crítica:
 - Toda inserción en PurchaseItem debe aumentar stock del Product (transacción Prisma).
 - Toda inserción en SaleItem debe disminuir stock del Product (transacción Prisma).
 - amountPaid / pendingBalance se calculan automático según paymentMethod.
 - Validar stock suficiente antes de registrar venta (evitar stock negativo).

# Build and Test Commands
 - **Instalar**: npm install
 - **Configuración**: .env con DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
 - **Sincronizar BD**: npx prisma db push
 - **Generar Cliente**: npx prisma generate
 - **Desarrollo**: npm run dev
 - **Tests**: npm run test (Jest + React Testing Library)
 - **Lint**: npm run lint

# Code Style Guidelines
 - **Tipado Fuerte**: TypeScript estricto con tipos @prisma/client.
 - **Enfoque Móvil**: Tablas → Cards en < md:. Modales = Bottom Sheets 90vh mobile.
 - **Componentes**: Reutilizables (ProductForm, ProductSearch, ProductCard).
 - **Server Actions**: Validación Zod en todos los inputs.
 - **Transacciones**: prisma.$transaction para operaciones multi-tabla.
 - **Decimal**: Prisma Decimal → TS number (usar Number()).

# Security Considerations
 - **Validación Zod en todos los Server Actions.**
 - **Stock: impedir venta si cantidad > stock actual.**
 - **Rate limit en auth (futuro HU7).**
 - **Passwords hasheados (bcrypt), cookies httpOnly.**
 - **Service Role key solo backend, nunca NEXT_PUBLIC_.**

# Testing Strategy
 - **Unit**: Jest + RTL — componentes aislados, utils (cálculos, código auto).
 - **Integration**: Server Actions + Prisma (transacciones, stock, búsqueda).
 - **E2E**: Playwright mobile — flujos: crear producto → compra → venta → inventario.
 - **Convención** [componente].test.tsx junto al componente o __tests__/.
 - **Obligatorio**: npm run test pasa en cada feature completa.