# Prendas y pedidos (Polkalina's)

Objetivo: vender ropa second hand, intervenida y nueva como una línea propia del sistema —
cada prenda con su ficha (talle, medidas, condición, estilos, costo) — y gestionar los encargos
como pedidos con cliente, señas, envíos y estados, en un Kanban de 4 columnas.
Rama: `feat/prendas-pedidos` desde `origin/main` (`02bae33`, incluye el PR #13).

Fuentes de diseño (leer antes de implementar):
1. `docs/adr/prendas-pedidos.md` — requisito transcriptado (§0), P1-P18, decisiones del dueño
   (§1ter y §1cuater).
2. `docs/adr/prendas-pedidos-diseno-logica.md` — el diseño de lógica de Claude: variante C,
   reserva derivada R1, máquina de estados, invariantes I1-I10, acciones. **Prevalecen los
   overrides de §1cuater**: condición/medidas/canales son tablas creables (no enums/columnas
   fijas), `Customer.phone` nuevo.
3. `docs/adr/polkalinas-front.md` — inventario de los mockups (el sistema interno se adapta a ese
   estilo en la fase de frontend; la lógica no depende de él).

Fuera de alcance de esta feature (decisiones ya tomadas): etiquetas de prenda impresas (después),
roles Dueña/Vendedora (después), reportes de costo/ganancia (después), «Mi bolsita»/Favoritas
(fuera de v1), la vidriera pública Polkalina's (fase siguiente, con las fotos), fotos por prenda
(llegan con el pipeline de imágenes del catálogo: `ProductImage` ya diseñado).

## Specs

Decisiones del humano, citadas textuales. Las citas largas están transcriptadas completas en
`docs/adr/prendas-pedidos.md` §0; acá van las frases que gobiernan cada unidad.

- **S1.** «ahora debemos crear una nueva tabla de productos que sea "Prendas" para cargar la ropa,
  porque no puede ser un producto normal? Porque la ropa tiene nuevas características» — con:
  nombre, imagen, código, categoría (creable), talle, medidas opcionales, detalle, estado de la
  prenda, estilo (creable), costo, precio de venta. **Decidido (variante C)**: prenda = `Product`
  con `kind=PRENDA` + ficha `PrendaDetalle` 1:1; second hand/intervenido **única** (cantidad 1),
  ropa nueva con cantidades (`esUnica` explícito); código `PK0143` (generador actual, sin guion);
  condición y medidas **creables**; hasta 4 fotos pero **con el pipeline del catálogo, no en esta
  fase**; la imagen no bloquea el alta.
- **S2.** «usualmente las prendas son por encargo, así que deberíamos hacer una nueva página/sección
  dentro de ventas en donde veamos los pedidos, en pedidos también deberíamos poder tener productos
  normales, los pedidos pueden estar: Reservados, Pagados, Para enviar, Entregados. Todos deben
  tener un cliente de origen y un o unos productos y o prendas.» **Decidido**: pedido de **una sola
  sucursal** (si no, primero traspaso); canal de venta como campo (tabla creable, sembrada con
  WhatsApp/Instagram/TikTok/Local); señas con saldo y vencimiento; al pasar a Pagado genera una
  `Sale` de la sucursal del pedido («Genera una sale de la sucursal donde se encuentre»); Pagado =
  cobrado completo; señas entran a caja al pagar (M1); seña de cancelación caso por caso; vencida
  queda marcada hasta que alguien la cancele (sin cron); pedidos desde `V-0001`.
- **S3.** «La vista debe ser estilo tableros Kanban en 4 columnas en PC, en celu una lista con los
  selectores por estado.» Arrastrar no alcanza para pagar: soltar en «Pagado» abre el paso de cobro
  (saldo + medio); en celu, selector por estado.
- **S4.** «las prendas también pueden ser movidas en sucursal aunque principalmente se venderán en
  el depósito» — **decidido**: el depósito es una `Branch` más; mover reusa el flujo existente.
- **S5.** «Las prendas además tienen un nuevo tipo de etiquetas distintas a las de los productos…
  eso lo vemos en el siguiente paso que es el cambio de frontend» — fuera de alcance; la lógica
  solo deja el punto de enchufe.
- **S6.** Venta directa de prendas desde «Nueva venta» (mostrador): **sí**, con el chequeo de no
  vender lo reservado. Precio del pedido: **fijo del servidor**.
- **S7.** «Publicar en» (Web/IG/WhatsApp): registro simple por prenda; el sistema no publica.

## Tasks

| ID | Tarea | Specs | Ruta principal | Estado | Commit |
|---|---|---|---|---|---|
| U1 | Esquema aditivo completo: `ProductKind`, `PrendaDetalle`, taxonomías creables (`CategoriaPrenda`, `EstiloPrenda`, `CondicionPrenda`, `MedidaTipo`+`PrendaMedida`, `CanalVenta`), `Customer.phone`, `Pedido`/`PedidoItem`/`PedidoPago`, `PrendaPublicacion`. `db push` a base local y suite sin regresión | S1, S2, S6 | `prisma/schema.prisma` | pendiente | — |
| U2 | Taxonomías creables: acciones de crear/renombrar/desactivar + semillas (condición: Muy bueno/Bueno/Con detalles; medidas: axila/largo total/manga; canales: los 4) y UI mínima reusando el patrón de categorías | S1, S2 | `src/app/actions/prendaTaxonomy.ts`, `src/lib/validations/`, UI mínima | pendiente | — |
| U3 | Alta y edición de prenda: `createPrenda`/`updatePrenda` (Zod, `requireAdmin`, transacción, código con lock, fila de inventario + movimiento ENTRY, `esUnica`) y el formulario (`/inventario` → «Nueva prenda», patrón del alta de producto) | S1, S4 | `src/app/actions/prenda.ts`, `src/app/prendas/` o modal en `/inventario` | pendiente | — |
| U4 | Pedidos — servidor: `createPedido` (una sucursal, ítems con precio del servidor, seña opcional, `venceEl`, lock de número V-0001, chequeo de disponible bajo lock), `registrarSena`, `cobrarPedido` (crea la `Sale` + `SaleItem` + EXIT + `saleId`, transición condicional), `moverPedido`, `actualizarEnvio`, `cancelarPedido` (motivo + destino de la seña). Zona de dinero: verificación independiente | S2, S3, S6 | `src/app/actions/pedido.ts`, `src/lib/validations/pedido.ts` | pendiente | — |
| U5 | Kanban y pedidos — UI: sección dentro de `/ventas`, 4 columnas en PC con arrastre, lista + selector por estado en celular, paso de cobro al soltar en «Pagado», avisos de vencimiento, tab de canal. Sin Server Actions públicas nuevas para leer | S3 | `src/app/ventas/pedidos/` + componentes | pendiente | — |
| U6 | Reserva derivada R1: `registerSale` y `moveStock` pasan a respetar lo reservado (`stock − reservado ≥ cantidad`), disponibilidad derivada de la prenda (Disponible/Reservada/Vendida), y el aviso en el alta/venta. Zona de dinero/stock: verificación independiente | S1, S2, S6 | `src/app/actions/sale.ts`, `inventory.ts`, `prenda.ts` | pendiente | — |

Orden: U1 → U2 → U3 → U4 → U5 → U6. U4 y U6 tocan plata y stock: aviso `AGENTS.md` §0.4 antes de
cada una, verificador independiente (`gentle-ai-verify`) y tu verificación de front al cierre de cada
unidad. Los docs de fase (`docs/adr/*`, `polkalinas-html/`) se commitean con U1.

## Log

- **L1.** Pedido original, textual: «Nuevo requerimiento -> venta de ropa intervenida, segunda
  mano, nueva, etc. Sumado a los productos que ya vendemos, ahora debemos crear una nueva tabla
  de productos que sea "Prendas" […] usualmente las prendas son por encargo, así que deberíamos
  hacer una nueva página/sección dentro de ventas en donde veamos los pedidos […] La vista debe
  ser estilo tableros Kanban en 4 columnas en PC, en celu una lista con los selectores por estado.
  Las prendas además tienen un nuevo tipo de etiquetas distintas […] eso lo vemos en el siguiente
  paso que es el cambio de frontend, de todas formas te dejo los html de las ideas que tengo del
  catálogo y del sistema interno, la idea es mantener nuestro front pero adaptarlo al estilo
  propuesto en los htmls.» Transcripta completa en `docs/adr/prendas-pedidos.md` §0.
- **L2.** Diseño de lógica delegado a Claude (Opus 5.5, modo plan, vía orca): entregó
  `prendas-pedidos-diseno-logica.md` con variante C, R1, M1/M2 e invariantes. Veintiuna decisiones
  del dueño cerradas en jornadas del 18 y 19/11 (§1ter y §1cuater del ADR); tres cambian el diseño
  (condición, medidas y canales pasan a tablas creables) y una amplía `Customer.phone`.
- **L3.** «Go!» (2026-11-19, con el PR #13 mergeado): arranca la implementación en
  `feat/prendas-pedidos`. Fuera de alcance declarado arriba; la vidriera pública Polkalina's es la
  fase siguiente y reusa todo lo de acá.
