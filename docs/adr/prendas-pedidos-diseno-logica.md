# Diseño de la lógica — Prendas y pedidos

Estado: **borrador de diseño, sin código**. Encargo: `docs/adr/prendas-pedidos-brief-claude.md`.
Fuente de verdad: `docs/adr/prendas-pedidos.md` (en adelante, «el ADR»), con las decisiones de §1ter
y los hallazgos de §1bis / `docs/adr/polkalinas-front.md`. Fecha: 2026-11-18.

Convenciones:
- **[decidido P#]**: el dueño ya lo cerró (ADR §1ter). Se diseña sobre eso.
- **[supuesto]**: lo asumo para poder diseñar; la pregunta correspondiente está en §9.
- **[abierto P#]**: pregunta del ADR que sigue sin respuesta.

---

## 0. Lo que el código actual condiciona

Observado en el repo; cada punto pesa en el diseño:

1. **Una `Sale` tiene una sola sucursal** (`Sale.branchId`, `prisma/schema.prisma:107`) y cada
   `SaleItem` exige `productId` (`:119`). No hay forma de que un ítem de venta apunte a otra cosa que
   un `Product`.
2. **La caja suma `Sale.totalAmount` por medio de pago y por la fecha de la venta**
   (`src/app/actions/cash.ts:143-150`), no `amountPaid`. Lo que entra a caja es el total de cada venta
   el día de la venta, más/menos `CashMovement`.
3. **Los cobros de deuda (`Payment`) no tienen sucursal** (`schema.prisma:141-149`) y no entran a la
   caja. «La plata tiene un solo registro de verdad» hoy ya tiene esa excepción.
4. **`registerSale` descuenta stock con un `updateMany` condicional** (`stock >= cantidad`,
   `src/app/actions/sale.ts:103-125`), dentro de `$transaction`. Es el patrón anti-carrera del repo.
5. **`registerSale` toma el precio que manda el cliente** (`saleItemSchema.price`, `sale.ts:12-16`) y
   suma con `number` de JS (`sale.ts:72-74`), no con `Decimal`.
6. **El movimiento `EXIT` de una venta solo se escribe si llega `performedBy`** (`sale.ts:167`): una
   venta puede no dejar rastro en el libro de la sucursal.
7. **No existe anular una venta**: `sale.ts` no tiene acción de anulación ni devolución.
8. **Hay generador de códigos con `pg_advisory_xact_lock` por prefijo** (`product.ts:59-68`, `:237-241`).
9. **`Product` no tiene costo** (`schema.prisma:11-28`). `Customer` no tiene ciudad, teléfono ni
   canal (`:130-139`).
10. **No hay tareas programadas** (cron) en el repo: nada corre solo para vencer reservas.

---

## 1. Prenda: variantes de modelo (P1)

**[decidido P1]** Mixta: second hand e intervenido son **únicas** (cantidad 1); la ropa nueva admite
cantidades. Marca explícita por prenda (`esUnica`), no derivada del nombre de la categoría.

**[decidido P4]** El depósito es una `Branch` más.

Con esas dos decisiones cerradas, la pregunta de modelo que queda es **cómo** se implementa la mezcla.
Tres variantes:

| | **A. Tabla `Prenda` propia + `PrendaInventory`** | **B. `Prenda` propia, dos mecanismos** | **C. `Prenda` como detalle 1:1 de `Product`** |
|---|---|---|---|
| Idea | Copia el patrón `BranchInventory` para prendas; única ⇒ stock total ≤ 1 | Única: `Prenda.branchId` + estado; con cantidad: `PrendaInventory` | `Product` + tabla `PrendaDetalle` (talle, medidas, condición, costo, estilos…); una prenda **es** un producto con detalle |
| Stock y ubicación | Tabla nueva, movimientos nuevos (o `BranchMovement` generalizado) | Dos caminos distintos según `esUnica` | Reusa `BranchInventory` y `BranchMovement` tal cual; única = fila con stock 1 |
| Venta (P5) | `SaleItem` necesita `prendaId` y `productId` opcional: cambia un contrato que leen ~12 archivos (dashboard, ventas, compras, inventario, movimientos) | Igual que A | `SaleItem.productId` sirve sin cambios |
| Caja y reportes | Hay que enseñarles prendas | Igual que A | Ya las ven |
| Fotos (4) | `PrendaImage` nueva o `ProductImage` generalizada | Igual que A | `ProductImage` del catálogo, sin cambios |
| Catálogo F1 (P7) | Otra vista u otra `CatalogItem` | Igual que A | `CatalogItem` y `catalog_public` ya sirven |
| Mover entre sucursales | Acción nueva | Dos acciones nuevas | `moveStock` existente |
| Código | Generador nuevo o generalizado | Igual | Generador existente (P8) |
| Costo | En `Prenda` | En `Prenda` | En `PrendaDetalle`, **fuera** de `Product` (la vista pública nunca lo ve) |
| Riesgo principal | Duplicar stock, ventas y movimientos: dos verdades | Lo de A + dos caminos de código | Las pantallas actuales de productos tienen que filtrar prendas (o mostrarlas a propósito) |
| Esfuerzo | Alto | El más alto | El más bajo |

**Recomendación: C**, pero **no la decido**. El ADR §1 dice «entidad nueva, separada de `Product`» y
el dueño escribió «¿por qué no puede ser un producto normal? Porque la ropa tiene nuevas
características». C sí crea una tabla nueva con todas esas características; lo que comparte con
`Product` es la identidad (código, nombre, precio, activo) y toda la maquinaria de stock, venta y caja.
Si el dueño quiere separación total, A es la alternativa; B no tiene ventaja sobre A. Pregunta 1.

El resto del documento usa **C**. Donde A cambia algo, se marca **[en A: …]**.

### 1.1 Modelo propuesto (variante C, estilo Prisma)

```prisma
model Product {
  // … campos actuales sin cambios …
  kind     ProductKind    @default(PRODUCT)   // nuevo, aditivo
  prenda   PrendaDetalle?
}

enum ProductKind {
  PRODUCT
  PRENDA
}

// Lo propio de la ropa. 1:1 con Product (que aporta nombre, código, precio,
// descripción, activo, fotos, stock y ventas).
model PrendaDetalle {
  productId          Int              @id
  product            Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  esUnica            Boolean                       // [decidido P1] explícito por prenda
  categoriaId        Int
  categoria          CategoriaPrenda  @relation(fields: [categoriaId], references: [id])
  talle              String                        // texto libre, admite «Único» (mockup)
  anchoAxilaCm       Decimal?         @db.Decimal(5, 1)
  largoTotalCm       Decimal?         @db.Decimal(5, 1)
  largoMangaCm       Decimal?         @db.Decimal(5, 1)
  condicion          CondicionPrenda               // [supuesto, abierto P3]
  detalleCondicion   String?                       // «Con detalles (aclarar)»
  detalleIntervencion String?                      // campo aparte en el alta del mockup
  costo              Decimal          @db.Decimal(10, 2)
  estilos            PrendaEstilo[]
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([categoriaId])
}

enum CondicionPrenda {           // [supuesto] los 3 valores del mockup
  MUY_BUENO
  BUENO
  CON_DETALLES
}

model CategoriaPrenda {          // [abierto P2] taxonomía propia, creable
  id                  Int      @id @default(autoincrement())
  name                String   @unique
  esUnicaPorDefecto   Boolean  @default(true)   // solo precarga el formulario
  active              Boolean  @default(true)   // se desactiva, no se borra
  prendas             PrendaDetalle[]
}

model EstiloPrenda {             // [abierto P2] taxonomía propia, creable
  id      Int      @id @default(autoincrement())
  name    String   @unique
  active  Boolean  @default(true)
  prendas PrendaEstilo[]
}

model PrendaEstilo {             // [supuesto] multiselección, como en el mockup
  productId Int
  estiloId  Int
  prenda    PrendaDetalle @relation(fields: [productId], references: [productId], onDelete: Cascade)
  estilo    EstiloPrenda  @relation(fields: [estiloId], references: [id])

  @@id([productId, estiloId])
  @@index([estiloId])
}
```

Decisiones técnicas (las tomo yo, no son de producto):

- **Medidas como columnas, no JSON.** Son tres medidas con nombre conocido (mockup), numéricas y en
  cm. Columnas `Decimal?` se validan con Zod, se filtran y no admiten basura. Si el dueño quiere
  **crear** medidas nuevas, pasa a una tabla `MedidaTipo` + `PrendaMedida`; JSON solo esconde el
  problema (pregunta 4).
- **Taxonomías propias** (`CategoriaPrenda`, `EstiloPrenda`), no `Category`: el requisito pide crearlas
  y modificarlas para ropa, y mezclar las dos genera el choque C4 del front. Se **desactivan**, nunca
  se borran: hay prendas y reportes que las referencian.
- **`esUnicaPorDefecto` en la categoría** solo precarga el valor en el formulario: la verdad es
  `PrendaDetalle.esUnica` **[decidido P1]**.
- **El costo vive en `PrendaDetalle`, no en `Product`**: la vista `catalog_public` lee `product` y una
  columna nueva en esa tabla podría publicarse sin querer (ADR del catálogo, ADR-13 punto 3).
- **Precio, nombre, código, descripción y activo** quedan en `Product`: la venta, la caja y el
  catálogo ya los leen de ahí.

[en A: `Prenda` lleva esos campos propios; `PrendaInventory(branchId, prendaId, stock)` replica
`BranchInventory`; los movimientos piden generalizar `BranchMovement` o una tabla paralela.]

### 1.2 Ubicación y movimientos

- **[decidido P4]** Depósito = `Branch`. Una prenda está donde su `BranchInventory.stock > 0`.
- **Prenda única**: suma de `stock` en todas las sucursales ∈ {0, 1}. Nunca 2 (invariante I1, §5).
- **Mover**: el `moveStock` existente (con su movimiento y comprobante). Para una única, la cantidad es
  siempre 1 y origen = la sucursal donde está.
- **Alta**: crea `Product(kind=PRENDA)` + `PrendaDetalle` + la fila de `BranchInventory` en la
  sucursal elegida (por defecto el depósito **[supuesto]**) con stock 1 si es única, o la cantidad
  cargada, y un `BranchMovement ENTRY`. El mockup no tiene selector de sucursal (C5): el diseño lo
  necesita igual.

### 1.3 Disponibilidad (Disponible / Reservada / Vendida) — derivada, no guardada

**[abierto P17]** Propuesta: **no se guarda un campo de disponibilidad**; se calcula.

| Disponibilidad | Regla (prenda única) |
|---|---|
| Disponible | stock total 1 y ningún pedido activo (§2) la reserva |
| Reservada | stock total 1 y un pedido en `RESERVADO` la tiene |
| Vendida | stock total 0 y tiene al menos un `SaleItem` |
| (sin stock, sin venta) | baja por ajuste o pérdida: no se muestra como «Vendida» |

Para ropa nueva con cantidad: disponible = stock − unidades reservadas en pedidos `RESERVADO`.

Así **«Al pasar a Pagado, la prenda queda como vendida en el catálogo»** sale sola: pagar crea la
`Sale`, la `Sale` descuenta el stock, el stock queda en 0 con venta ⇒ «Vendida». Un campo guardado
sería una segunda verdad que una venta directa, un ajuste o un control de stock podrían dejar
desincronizada.

### 1.4 Código, fotos, publicación

- **Código** **[abierto P8]**: si se reusa el generador por prefijo (`product.ts:59-68`) con un prefijo
  propio (por ejemplo `PK`), la prenda comparte el espacio único de `Product.code`, que es lo correcto
  en C. El formato del mockup (`PK-0143`, con guion) no es el formato actual: pregunta 5.
- **Fotos** **[decidido P9]**: hasta 4, `ProductImage` del catálogo, el mismo flujo de subida
  (`docs/adr/catalogo-externo-diseno.md` §3).
- **Publicación multicanal** **[abierto P13]**: el sistema no publica en Instagram ni en WhatsApp; a lo
  sumo **guarda** en qué canales la publicaron. Si se pide, es una tabla
  `PrendaPublicacion(productId, canal)`, sin integración. La web pública es `CatalogItem` (P7).

---

## 2. Pedido

### 2.1 Modelo propuesto

```prisma
model Pedido {
  id            Int             @id @default(autoincrement())
  numero        String          @unique        // «V-0231», generado con lock (§2.5)
  customerId    Int                             // obligatorio: «Todos deben tener un cliente de origen»
  customer      Customer        @relation(fields: [customerId], references: [id])
  canal         CanalVenta                      // [decidido P12]
  estado        PedidoEstado    @default(RESERVADO)
  total         Decimal         @db.Decimal(10, 2)   // calculado en el servidor
  venceEl       DateTime?                       // vencimiento de la reserva [decidido P11]
  envioMetodo   EnvioMetodo?
  envioEstado   EnvioPreparacion?
  ciudad        String?                         // destino; Customer no tiene ciudad
  notas         String?
  saleId        Int?            @unique         // la Sale que genera al pagarse [decidido P5]
  sale          Sale?           @relation(fields: [saleId], references: [id])
  items         PedidoItem[]
  pagos         PedidoPago[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  pagadoAt      DateTime?
  entregadoAt   DateTime?
  canceladoAt   DateTime?
  createdBy     String
  updatedBy     String

  @@index([estado, canal])
  @@index([estado, venceEl])
  @@index([customerId])
}

model PedidoItem {
  id         Int     @id @default(autoincrement())
  pedidoId   Int
  pedido     Pedido  @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  productId  Int                                // producto normal o prenda (variante C)
  product    Product @relation(fields: [productId], references: [id])
  branchId   Int                                // de qué sucursal sale la unidad reservada
  branch     Branch  @relation(fields: [branchId], references: [id])
  cantidad   Int                                // 1 para prendas únicas
  precio     Decimal @db.Decimal(10, 2)         // foto del precio al reservar
  subtotal   Decimal @db.Decimal(10, 2)

  @@index([pedidoId])
  @@index([productId, branchId])
}

model PedidoPago {                                // señas y saldo [decidido P11]
  id          Int           @id @default(autoincrement())
  pedidoId    Int
  pedido      Pedido        @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  monto       Decimal       @db.Decimal(10, 2)
  metodo      PaymentMethod
  fecha       DateTime      @default(now())
  performedBy String

  @@index([pedidoId])
}

enum PedidoEstado {
  RESERVADO
  PAGADO
  PARA_ENVIAR
  ENTREGADO
  CANCELADO      // no es columna del Kanban; hace falta para vencer o anular una reserva
}

enum CanalVenta { WHATSAPP INSTAGRAM TIKTOK LOCAL }                 // [supuesto] lista fija
enum EnvioMetodo { CORREO ENCOMIENDA RETIRO }                       // del mockup
enum EnvioPreparacion { COORDINAR FALTA_EMBALAR ETIQUETA_LISTA }    // del mockup
```

`Sale` no cambia de forma: el vínculo vive en `Pedido.saleId`. [en A: además `SaleItem.prendaId`.]

### 2.2 Reserva de stock: variantes

Un pedido `RESERVADO` tiene que impedir que la misma prenda se venda o se reserve dos veces. Dos
formas:

| | **R1. Reserva derivada (recomendada)** | **R2. La reserva descuenta stock** |
|---|---|---|
| Cómo | Reservado = suma de `PedidoItem.cantidad` de pedidos `RESERVADO` por (producto, sucursal). Disponible = stock − reservado | Al reservar se baja `BranchInventory.stock` con un movimiento; al cancelar se devuelve |
| Stock físico | `stock` sigue siendo lo que hay en el estante | `stock` deja de coincidir con el estante: la prenda reservada sigue físicamente en el depósito |
| Control de stock | Cuenta bien | Marca diferencia en toda prenda reservada |
| Venta directa en `/ventas` | **Tiene que respetar lo reservado**: cambia la condición de `registerSale` | La respeta sola (el stock ya bajó) |
| Pagar | La `Sale` descuenta el stock como cualquier venta | La `Sale` no puede volver a descontar: camino especial |
| Toca código de stock | Sí: `registerSale`, `moveStock` y el cierre del control pasan a mirar lo reservado | Sí: movimiento de reserva nuevo y una venta que no descuenta |

**Recomendación: R1.** Mantiene `stock` = realidad física (lo que asume el control de stock) y la
`Sale` del pago es una venta común. Su costo es real y **toca stock** (`AGENTS.md` §0.4): la condición
`stock >= cantidad` de `registerSale` pasa a `stock − reservado >= cantidad`, y `moveStock` no puede
mover unidades reservadas. Hay que avisar antes de implementarlo.

### 2.3 Dinero: variantes (P5 + P11)

**[decidido P5]** Al pasar a Pagado se genera una `Sale` de la sucursal donde está la prenda; caja y
reportes son la única verdad de la plata. **[decidido P11]** Hay señas, saldo, vencimiento y la acción
«Cobrada».

Las dos decisiones juntas dejan un hueco: **la seña se cobra antes de que exista la `Sale`.** ¿Dónde
está esa plata entre la reserva y el pago?

| | **M1. Señas en el pedido, todo entra a caja al pagar (recomendada para v1)** | **M2. Señas a caja el día que entran** | **M3. `Sale` al reservar, con saldo pendiente** |
|---|---|---|---|
| Cómo | `PedidoPago` guarda cada seña sin tocar caja. Al pasar a Pagado se crea la `Sale` por el **total**, con fecha del pago | Cada seña genera un `CashMovement INGRESO` en su sucursal y día; al pagar, la `Sale` va por el total y un `CashMovement EGRESO` «seña aplicada» neutraliza lo ya ingresado | Se crea la `Sale` al reservar, con `pendingBalance` y deuda del cliente (mecanismo actual) |
| Respeta P5 | Sí | Sí | **No** (la `Sale` nace al reservar) |
| Caja | Ve toda la plata el día del pago. Entre la seña y el pago, la plata física de la seña está en el cajón y la caja no la ve | Cada día ve lo que entró | Ve el **total** el día de la reserva (la caja suma `totalAmount`, §0 punto 2): plata que no entró |
| Reportes de venta | Correctos (una `Sale` por el total) | Correctos | La venta aparece antes de cobrarse |
| Complejidad | Baja | Media: dos asientos que tienen que cuadrar, y un egreso que no es un egreso | Baja, pero rompe P5 y la caja |

**Recomendación: M1**, avisando del costo: **los cierres de caja entre la seña y el pago no cuentan la
seña**. Si el dueño no acepta eso, M2 es la salida correcta, pero exige aceptar el asiento de «seña
aplicada» en la caja. M3 queda descartada: contradice P5. Pregunta 7.

**Una sucursal por pedido.** `Sale` tiene una sola `branchId`. Si un pedido tiene una prenda en el
depósito y un producto en una sucursal, P5 («la sucursal donde se encuentre») da dos sucursales.
Opciones: (a) **v1: todos los ítems de un pedido salen de la misma sucursal**; si no, primero se mueve
la mercadería con `moveStock`, o (b) una `Sale` por sucursal, que obliga a repartir las señas entre
ventas. Recomiendo (a). Pregunta 6.

**Medio de pago de la `Sale`**: si todos los `PedidoPago` son del mismo método, ese; si se mezclan,
`MIXTO`. `amountPaid = total`, `pendingBalance = 0`: Pagado significa pagado completo **[supuesto]**,
así que el pedido no genera deuda de cliente (pregunta 8).

### 2.4 Máquina de estados

```text
            ┌─────────── cancelar (seña: pregunta 9) ───────────┐
            │                                                    ▼
      ┌───────────┐   cobrar saldo    ┌────────┐  preparar  ┌─────────────┐  entregar  ┌───────────┐
 alta │ RESERVADO │ ────────────────▶ │ PAGADO │ ─────────▶ │ PARA_ENVIAR │ ─────────▶ │ ENTREGADO │
 ───▶ └───────────┘  (crea la Sale)   └────────┘ ◀───────── └─────────────┘ ◀───────── └───────────┘
            │                              │       volver                    volver
            │                              └────────── entregar (retiro, pregunta 10) ─────────▶
            ▼
      ┌───────────┐
      │ CANCELADO │  (terminal)
      └───────────┘
```

Quién: **siempre `admin`** **[decidido P14]**: no hay otros roles. **[abierto P6]** para lo demás.

| Transición | Exige | Efecto | Atrás |
|---|---|---|---|
| alta → RESERVADO | Cliente, canal, ≥ 1 ítem, todos de la misma sucursal (§2.3), disponibilidad suficiente para cada ítem (§2.2), seña ≤ total, `venceEl` futuro u omitido | Crea pedido, ítems y pagos de seña; precios tomados del servidor | — |
| RESERVADO → PAGADO («Cobrada») | Registrar el saldo: suma de pagos = total. Stock suficiente **hoy** en la sucursal del pedido | Crea `PedidoPago` del saldo + `Sale` + `SaleItem` + `BranchMovement EXIT` (con `performedBy` obligatorio) + `pagadoAt` + `saleId`, todo en una transacción | **No**: deshacerlo es anular una venta, y eso no existe (§0 punto 7) |
| RESERVADO → CANCELADO | Motivo **[supuesto]** | Libera la reserva (es derivada: basta el cambio de estado). La seña, pregunta 9 | No en v1 |
| PAGADO → PARA_ENVIAR | `envioMetodo`; `ciudad` si no es retiro | Estado de envío inicial `COORDINAR` | Sí, a PAGADO, sin efecto en plata ni stock |
| PARA_ENVIAR → ENTREGADO | — | `entregadoAt` | Sí, a PARA_ENVIAR (corrección), sin efecto en plata ni stock |
| PAGADO → ENTREGADO | `envioMetodo = RETIRO` **[supuesto]** | `entregadoAt` | Igual que arriba |
| Cualquier otra | — | Rechazada en el servidor | — |

- **Arrastrar en el Kanban no alcanza para pagar**: soltar una tarjeta en «Pagado» abre el paso de
  cobro (monto del saldo y medio). Las demás columnas sí se mueven con un toque, porque no tocan plata.
- **Editar ítems** solo en `RESERVADO`, con las mismas validaciones del alta. Desde Pagado los ítems
  son los de la `Sale` y no se tocan.
- **Vencimiento**: no hay cron (§0 punto 10). «Vencida» es un **estado derivado**
  (`RESERVADO` y `venceEl < ahora`) que se muestra como aviso («vence hoy», «vencida»). La reserva
  **sigue bloqueando** hasta que alguien la cancele **[supuesto]**, para que nada se libere sin que
  nadie se entere. Pregunta 11.

### 2.5 Número de pedido `V-####`

Secuencial, generado dentro de la transacción del alta con `pg_advisory_xact_lock` sobre una clave
fija, el mismo patrón que los códigos de producto. Formato `V-` + 4 dígitos con ceros a la izquierda
(crece a 5 al pasar de 9999). El número inicial es pregunta 12: el mockup muestra `V-0231`, que sugiere
continuar una numeración que ya existe fuera del sistema.

---

## 3. Acciones de servidor y contratos

Todas con la disciplina del repo: `"use server"`, `requireAdmin()` primero, Zod en el servidor,
`$transaction` todo-o-nada, `performedBy` **obligatorio** en lo que escribe stock o plata (corrige el
punto 6 de §0 para este flujo), y mensajes de negocio conservados como en `registerSale`.

**Cambios de estado con concurrencia optimista**: cada transición actualiza con
`updateMany({ where: { id, estado: <origen> } })` y exige `count === 1`. Si dos pestañas mueven el
mismo pedido, la segunda falla con «El pedido cambió de estado; recargá».

### 3.1 Prendas y taxonomías

| Acción | Valida (Zod) | Escribe en la transacción | Revalida |
|---|---|---|---|
| `createPrenda` | nombre, precio > 0, costo ≥ 0, categoría activa, estilos activos, talle no vacío, medidas 0–300 cm con 1 decimal, condición del enum, `esUnica`, sucursal activa, cantidad (= 1 si única) | Código (lock por prefijo), `Product(kind=PRENDA)`, `PrendaDetalle`, `PrendaEstilo`, `BranchInventory`, `BranchMovement ENTRY` | `/inventario`, `/prendas` **[supuesto de ruta]**, tag `catalog` |
| `updatePrenda` | Lo mismo salvo stock. `esUnica` no pasa de `false` a `true` si el stock total es > 1 | `Product` + `PrendaDetalle` + estilos | idem |
| `setPrendaActiva` | id | `Product.active` | idem |
| `createCategoriaPrenda` / `renameCategoriaPrenda` / `setCategoriaPrendaActiva` | nombre único sin distinguir mayúsculas | `CategoriaPrenda` | `/prendas` |
| `createEstiloPrenda` / `renameEstiloPrenda` / `setEstiloPrendaActivo` | idem | `EstiloPrenda` | `/prendas` |
| `getPrendas` | filtros: categoría, estilo, talle, disponibilidad, sucursal, búsqueda; `take` ≤ 50, `skip` | — (lectura; incluye costo: solo admin) | — |

Mover entre sucursales: `moveStock` existente, con la regla nueva de no mover unidades reservadas.

### 3.2 Pedidos

| Acción | Valida (Zod + reglas) | Escribe en la transacción | Revalida |
|---|---|---|---|
| `createPedido` | `customerId` existente, `canal`, ítems `{productId, cantidad}` (sin precio: lo pone el servidor), sucursal activa única, seña opcional `{monto > 0, metodo}` ≤ total, `venceEl` | Lock de número; por cada ítem, lock de la fila de stock (`SELECT … FOR UPDATE` o advisory por producto + sucursal) y chequeo `stock − reservado ≥ cantidad`; `Pedido`, `PedidoItem`, `PedidoPago` | `/ventas/pedidos`, tag `catalog` |
| `updatePedidoItems` | Solo `RESERVADO`; mismas reglas | Reemplaza ítems con el mismo chequeo | idem |
| `registrarSena` | Solo `RESERVADO`; suma de pagos + monto ≤ total | `PedidoPago` | `/ventas/pedidos` |
| `cobrarPedido` («Cobrada») | Solo `RESERVADO`; el saldo informado = total − pagos (no se acepta otro monto); stock suficiente | `PedidoPago` del saldo; transición condicional; `Sale` + `SaleItem` + descuento condicional de stock (mismo `updateMany` que `registerSale`) + `BranchMovement EXIT` con `reference: PEDIDO-<numero>` y `SALE-<id>`; `saleId`, `pagadoAt` | `/ventas`, `/ventas/pedidos`, `/inventario`, `/clientes`, tag `catalog` |
| `moverPedido` | `{id, desde, hacia}` dentro de la tabla de §2.4, excepto PAGADO y CANCELADO, que tienen su propia acción | Transición condicional + timestamps | `/ventas/pedidos` |
| `actualizarEnvio` | Solo `PAGADO`/`PARA_ENVIAR`; método, preparación, ciudad ≤ 100 | `Pedido` | `/ventas/pedidos` |
| `cancelarPedido` | Solo `RESERVADO`; motivo; destino de la seña (pregunta 9) | Transición condicional; `canceladoAt`; asiento de la seña si corresponde | `/ventas/pedidos`, tag `catalog` |
| `getPedidosPorEstado` | `estado`, `canal?`, `take` ≤ 30, cursor | — | — |
| `getPedido` | id | — | — |

**Lógica de la `Sale` compartida.** `cobrarPedido` no puede llamar a `registerSale` (es otra acción,
con su propio `requireAdmin` y su propia transacción). Lo correcto es extraer de `registerSale` la
parte que vive dentro de la transacción (descuento condicional, cabecera, ítems, movimiento) a un
helper que reciba `tx`, y que las dos acciones lo usen. Eso toca `sale.ts`: dinero y stock, aviso
obligatorio.

---

## 4. Kanban: datos

- **Una consulta por columna**, no una sola para todo: `findMany({ where: { estado, canal? }, take: 30,
  cursor })` con un `select` cerrado para la tarjeta: número, canal, cliente (nombre), ciudad, hasta 3
  ítems (nombre × cantidad) + cantidad restante, suma de señas, saldo, medio, envío, preparación,
  total, `venceEl`.
- **Conteos** de las 4 columnas con un `groupBy({ by: ['estado'], where: { canal? } })`.
- **Orden por columna**:
  - Reservado: `venceEl` ascendente, sin vencimiento al final: lo que vence primero, arriba.
  - Pagado: `pagadoAt` ascendente (lo que espera hace más tiempo).
  - Para enviar: preparación (`COORDINAR` primero), después `pagadoAt`.
  - Entregado: `entregadoAt` descendente, **solo los últimos 30 días** por defecto **[supuesto]**: es
    la columna que crece sin fin.
- **Filtro por canal** (las pestañas del mockup): el mismo `canal` en las cinco consultas.
- **Celular**: la misma consulta con un solo `estado` a la vez (selector), «Ver más» con cursor.
- **Índices**: `(estado, canal)` y `(estado, venceEl)` en `Pedido`; `(productId, branchId)` en
  `PedidoItem` para calcular lo reservado.
- Los KPIs del panel salen de estas mismas consultas: reservas por cobrar = conteo `RESERVADO`
  (con «vencen hoy» por `venceEl`), para enviar = conteo `PARA_ENVIAR`.

---

## 5. Invariantes

| # | Invariante | Cómo se sostiene |
|---|---|---|
| I1 | Una prenda única nunca tiene stock total > 1 | `createPrenda` crea con 1; `moveStock` mueve 1 entre filas; el ingreso por compra de una prenda única se rechaza si ya hay stock; chequeo bajo lock |
| I2 | Lo reservado nunca supera el stock: `Σ reservado(producto, sucursal) ≤ stock` | Chequeo bajo lock de la fila de stock en `createPedido`/`updatePedidoItems`; `registerSale` y `moveStock` pasan a respetar lo reservado (R1) |
| I3 | Una prenda única está en a lo sumo **un** pedido activo | Consecuencia de I1 + I2 (stock 1 ⇒ reservado ≤ 1) |
| I4 | Un pedido tiene a lo sumo una `Sale` y solo si está en PAGADO, PARA_ENVIAR o ENTREGADO | `saleId @unique`; solo `cobrarPedido` la crea, en la misma transacción que la transición condicional |
| I5 | `Σ PedidoPago.monto ≤ total`, y `= total` desde PAGADO | Validación en `registrarSena` y `cobrarPedido` |
| I6 | La plata de un pedido pagado vive en **una** `Sale`; el pedido no se suma aparte en ningún reporte | Reportes y caja leen `Sale`, nunca `PedidoPago`. `PedidoPago` es el detalle del cobro |
| I7 | El precio del pedido lo fija el servidor | `createPedido` no acepta precio del cliente (pregunta 13 si se quieren descuentos) |
| I8 | El costo no sale nunca del sistema interno | Vive en `PrendaDetalle`; `catalog_public` no lo une; `select` cerrado en toda lectura pública |
| I9 | Una transición inválida no deja nada escrito | Transición condicional + `$transaction` |
| I10 | Todo cambio de stock por pedido deja `BranchMovement` con actor | `performedBy` obligatorio en `cobrarPedido` |

---

## 6. Seguridad por frontera

- **Autorización**: toda acción empieza con `requireAdmin()`. Las rutas nuevas (`/prendas`,
  `/ventas/pedidos`) quedan detrás del proxy y **no** se suman a la allowlist anónima.
- **Validación**: Zod en el servidor para todo lo que entra; ids enteros positivos; textos con largo
  máximo; montos con dos decimales y > 0; enums cerrados.
- **Dinero**: cálculos con `Prisma.Decimal` (o centavos enteros), no con `number` de JS; totales y
  saldos calculados en el servidor; ningún monto calculado por el cliente se guarda sin recalcular.
  Todo lo que escribe plata (`createPedido` con seña, `registrarSena`, `cobrarPedido`,
  `cancelarPedido`) es zona de aviso de `AGENTS.md` §0.4.
- **Stock**: el cambio de `registerSale` y `moveStock` para respetar reservas es zona de aviso §0.4.
- **Datos públicos**: si las prendas entran al catálogo (P7), solo por `CatalogItem` y la vista
  acotada (ADR-13). Nunca costo, condición interna, `detalleIntervencion` sin revisar, cliente ni
  pedido.
- **RLS**: no se supone activo en las tablas nuevas (`AGENTS.md` §0.2); se verifica en el entorno real.
- **Migración**: todo es aditivo (tablas nuevas + `Product.kind` con default `PRODUCT`). Igual exige
  autorización explícita para ejecutarla.

---

## 7. Etiquetas de prenda (solo el punto de enchufe)

**[decidido P15]** Van en la fase de frontend. En el modelo no hace falta nada nuevo: la etiqueta lee
`Product.code`, `Product.price` y `PrendaDetalle.talle`, y se suma como otro diseño en
`src/lib/label-layout.ts` (el que ya arma las etiquetas de productos), elegido por `Product.kind`.
No se agrega un campo «etiqueta impresa»: no lo pidió nadie.

---

## 8. Fuera de alcance

Roles Dueña/Vendedora (P14), «Mi bolsita» y Favoritas (P10), integración real con Instagram o
WhatsApp (P13), reportes de margen y top clientas (P16, abierto), anulación y devolución de una venta,
costo de envío, Mercado Pago.

---

## 9. Preguntas para el dueño

1. **Modelo** (§1): ¿aceptás que una prenda sea un producto con una ficha de prenda aparte (variante
   C), que comparte stock, ventas, caja, fotos y catálogo con los productos? ¿O la querés totalmente
   separada (variante A), sabiendo que eso duplica stock, ventas y movimientos?
2. **[P2] Taxonomías**: ¿la categoría de prenda y el estilo son listas propias de ropa, separadas de
   las categorías de productos?
3. **[P3] Estado de la prenda**: ¿alcanza con Muy bueno / Bueno / Con detalles + un texto, o la lista
   tiene que ser creable?
4. **Medidas**: ¿alcanza con ancho axila a axila, largo total y largo de manga, en cm? ¿O hay que poder
   crear medidas nuevas (tiro, cintura…)?
5. **[P8] Código**: ¿las prendas usan el mismo generador de los productos, con un prefijo propio? ¿Cuál
   prefijo? ¿El formato del mockup con guion (`PK-0143`) es obligatorio?
6. **Sucursal del pedido**: ¿un pedido puede mezclar mercadería de dos sucursales (por ejemplo una
   prenda del depósito y un producto del local)? Si sí, ¿se aceptan dos ventas por pedido?
7. **Señas y caja**: con la propuesta M1, la seña entra a la caja recién el día que se cobra el saldo.
   Si en el medio se cierra la caja, ese cierre no cuenta la seña que está en el cajón. ¿Es aceptable,
   o la seña tiene que entrar a la caja el día que se cobra?
8. **Pagado con saldo**: ¿un pedido puede pasar a Pagado sin estar cobrado completo, dejando el resto
   como deuda de la clienta (cuenta corriente)?
9. **Seña de una reserva cancelada o vencida**: ¿se devuelve, se retiene (y entonces entra a caja como
   ingreso), o se decide en cada caso?
10. **Retiro en el local**: un pedido que se retira, ¿pasa por «Para enviar» igual (como en el panel del
    mockup) o salta de Pagado a Entregado?
11. **[P6] Vencimiento y vuelta atrás**: cuando una reserva vence, ¿se cancela sola o queda marcada
    como vencida hasta que alguien la cancele? ¿Se puede volver de Para enviar a Pagado, y de
    Entregado a Para enviar, para corregir?
12. **Número de pedido**: ¿desde qué número arranca (`V-0231` del mockup sugiere una numeración
    previa)?
13. **Precio en el pedido**: ¿el precio es siempre el de la prenda, o se puede poner otro (descuento,
    precio acordado por WhatsApp)?
14. **Canal**: ¿la lista WhatsApp / Instagram / TikTok / Local es fija, o tienen que poder agregar
    canales?
15. **Ciudad y contacto**: la ciudad, ¿es del pedido (el destino del envío) o de la clienta? ¿Hace
    falta guardar teléfono o usuario de Instagram de la clienta?
16. **Venta directa de prendas**: ¿una prenda se puede vender también desde «Nueva venta», como un
    producto, o solo a través de un pedido?
17. **[P17 + P7] Vendida en la vidriera**: ¿una prenda vendida se sigue mostrando en el catálogo
    público con la marca «Vendida» (como en el mockup), o desaparece? ¿«Reservada» se muestra al
    público?
18. **[P13] Publicada en**: ¿alcanza con marcar a mano en qué canales se publicó, sabiendo que el
    sistema no publica en Instagram ni en WhatsApp?
19. **[P16] Reportes**: ¿el margen por prenda (precio − costo) y las top clientas entran en v1?

---

## 10. Desacuerdos e inconsistencias

No los resuelvo; los dejo para decidir.

1. **El brief dice «no decidas P1–P9»**, pero P1, P4, P5 y P9 ya los cerró el dueño (ADR §1ter). Diseñé
   sobre esas decisiones; las variantes de P1 que pide el brief quedaron como variantes de
   **implementación** de la decisión mixta (§1).
2. **ADR §1 «entidad separada de `Product`» frente a la variante C.** La recomendación choca con esa
   frase del requisito extraído. La dejo como pregunta 1 en lugar de suponerla.
3. **P5 «la sucursal donde se encuentre» frente a pedidos mixtos.** `Sale` admite una sola sucursal;
   un pedido con ítems en dos sucursales no tiene una «sucursal donde se encuentra» (pregunta 6).
4. **P5 + P11 se pisan.** Con la `Sale` naciendo en Pagado, la seña no tiene lugar en la caja. Las
   variantes están en §2.3 y ninguna es gratis.
5. **«Caja y reportes son la única verdad» ya no es cierto del todo hoy**: la caja suma
   `Sale.totalAmount`, no lo cobrado (`cash.ts:143-150`), así que una venta con saldo pendiente cuenta
   entera; y los cobros de deuda (`Payment`) no entran a ninguna caja. No es de este cambio, pero
   condiciona M1/M2 y la pregunta 8.
6. **`registerSale` confía en el precio del cliente y suma con `number`** (`sale.ts:12-16`, `:72-74`).
   Si `cobrarPedido` reusa esa lógica, hereda las dos cosas. El diseño fija el precio en el servidor
   (I7) y pide `Decimal`.
7. **El brief menciona «movimientos con comprobante» como patrón**, pero en `registerSale` el
   movimiento es opcional (`sale.ts:167`). Para pedidos lo hago obligatorio (I10); para las ventas
   actuales queda igual.
8. **Las reservas obligan a tocar `registerSale` y `moveStock`** (R1) o a romper la igualdad
   stock = estante (R2). El brief no lo menciona y es zona de riesgo §0.4.
9. **El catálogo F1 tiene dos estados** (Disponible / Consultar,
   `docs/adr/catalogo-externo-diseno.md` §1.3), y la vidriera del mockup tiene tres
   (Disponible / Reservada / Vendida), con «Ocultar vendidas». Si las prendas entran a F1 (P7), uno de
   los dos diseños cambia.
10. **C8**: «Reservado» (pedido) y «Reservada» (prenda) usan la misma palabra. Con la disponibilidad
    derivada (§1.3) quedan consistentes, pero la UI tiene que dejar claro de qué entidad habla cada
    una.
11. **C4**: el reporte «por categoría» del mockup mezcla categorías de prenda y de producto. Con
    taxonomías separadas, ese reporte une dos listas.
12. **C5**: el alta de prenda del mockup no tiene sucursal, pero el modelo la necesita para el stock
    (§1.2).
13. **Vencimiento sin cron**: el mockup muestra «vence hoy», pero el sistema no tiene nada que corra
    solo. El diseño lo resuelve como estado derivado; si se pide cancelación automática, hace falta una
    tarea programada (Vercel Cron), que hoy no existe.
14. **Pagado es irreversible en v1**: no existe anular una venta (§0 punto 7). Arrastrar por error una
    tarjeta a Pagado se evita con el paso de cobro, pero no se puede deshacer.
