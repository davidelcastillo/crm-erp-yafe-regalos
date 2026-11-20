# Brief — Diseño de la LÓGICA de prendas y pedidos (solo diseño, no código)

Encargo de **diseño en modo plan**. No escribas código de implementación, no toques la base de datos,
no hagas commits. Tu único entregable es un documento de diseño.

## Contexto que tenés que leer primero

1. `docs/adr/prendas-pedidos.md` — el requisito transcriptado y las preguntas abiertas (P1–P9). Es
   tu fuente de verdad; **no decidas P1–P9**, diseñá con supuestos marcados y dejá las preguntas al
   final.
2. `prisma/schema.prisma` — el modelo actual: `Product`, `Branch`, `BranchInventory`,
   `BranchMovement`, `Sale`/`SaleItem`, `Customer`, `Payment`, `Category`, `CashMovement`.
3. Los patrones del servidor: `src/app/actions/sale.ts`, `src/app/actions/inventory.ts`,
   `src/app/actions/branch.ts`, `src/app/actions/customer.ts` (si existe, buscá el equivalente),
   `src/lib/validations/` — `requireAdmin` + Zod + `$transaction` + movimientos con comprobante.
4. `docs/adr/catalogo-externo.md` y `docs/adr/catalogo-externo-diseno.md` — el catálogo público ya
   diseñado; las prendas podrían convivir con él (pregunta P7).
5. `AGENTS.md` §0.2 y §0.4 — límites de seguridad y dinero.

## Qué diseñar

1. **Modelo de datos** (estilo Prisma): `Prenda` con los campos del requisito (nombre, imagen,
   código, categoría de prenda creable, talle, medidas opcionales, detalle, estado, estilo creable,
   costo, precio de venta). Decidí cómo modelar medidas (¿JSON?, ¿columnas?), las taxonomías
   propias (categoría de prenda, estilo), y el seguimiento de ubicación de la prenda
   (depósito/sucursales, movimientos). P1 (única vs cantidad) es la decisión madre: diseñá ambas
   variantes en una tabla comparativa y recomendá una, sin decidir por el dueño.
2. **Pedido**: ítems mixtos (productos normales + prendas), cliente de origen, estados Reservado →
   Pagado → Para enviar → Entregado. Máquina de estados completa: transiciones permitidas, quién
   autoriza cada una, qué exige cada salto, si se puede volver atrás, y qué pasa con la prenda
   (¿se reserva? ¿deja de estar disponible para otros pedidos?). Relación con `Sale`/caja (P5):
   variantes y recomendación.
3. **Acciones de servidor y contratos**: qué Server Actions existen, qué validan con Zod, qué
   escriben en `$transaction`, qué revalidan. La misma disciplina del repo: `requireAdmin`,
   validación en el servidor, todo-o-nada.
4. **Invariantes**: el stock de prendas (o su unicidad) nunca queda inconsistente con los pedidos;
   una prenda reservada por dos pedidos no puede pasar; la plata siempre tiene un solo registro de
   verdad.
5. **Kanban**: qué consulta alimenta cada columna, paginación/límites, y el equivalente móvil
   (lista + selector por estado). Solo la lógica de datos, no el diseño visual (eso ya se exploró
   aparte).
6. **Etiquetas de prendas**: solo anotá dónde se enchufarían en el modelo (decisión del dueño: van
   en la fase de frontend).

## Entregable

`docs/adr/prendas-pedidos-diseno-logica.md`, en español, con: modelo propuesto, variantes de P1 y
P5 con recomendación, máquina de estados, acciones con sus invariantes, seguridad por frontera
(requireAdmin, validación, dinero), preguntas abiertas numeradas para el dueño, y desacuerdos con
este brief o con el código si los encontrás. No modifiques ningún otro archivo.
