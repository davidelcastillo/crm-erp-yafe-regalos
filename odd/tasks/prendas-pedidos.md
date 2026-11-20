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
| U1 | Esquema aditivo completo: `ProductKind`, `PrendaDetalle`, taxonomías creables (`CategoriaPrenda`, `EstiloPrenda`, `CondicionPrenda`, `MedidaTipo`+`PrendaMedida`, `CanalVenta`), `Customer.phone`, `Pedido`/`PedidoItem`/`PedidoPago`, `PrendaPublicacion`. `db push` a base local y suite sin regresión | S1, S2, S6 | `prisma/schema.prisma` | hecho | `db70f0d` |
| U2 | Taxonomías creables: acciones de crear/renombrar/desactivar + semillas (condición: Muy bueno/Bueno/Con detalles; medidas: axila/largo total/manga; canales: los 4) y UI mínima reusando el patrón de categorías | S1, S2 | `src/app/actions/prendaTaxonomy.ts`, `src/lib/validations/`, UI mínima | hecho (capa servidor; la UI inline quedó en U3 por reencuadre anotado en L5) | `545efa6` |
| U3 | Alta y edición de prenda: `createPrenda`/`updatePrenda` (Zod, `requireAdmin`, transacción, código con lock, fila de inventario + movimiento ENTRY, `esUnica`) y el formulario (`/inventario` → «Nueva prenda», patrón del alta de producto) | S1, S4 | `src/app/actions/prenda.ts`, `src/app/inventario/components/PrendaForm.tsx` | hecho, verificado por el dueño («ya lo probe, anda de diez») | `a029f87` |
| U4 | Pedidos — servidor: `createPedido` (una sucursal, ítems con precio del servidor, seña opcional, `venceEl`, lock de número V-0001, chequeo de disponible bajo lock), `registrarSena`, `cobrarPedido` (crea la `Sale` + `SaleItem` + EXIT + `saleId`, transición condicional), `moverPedido`, `actualizarEnvio`, `cancelarPedido` (motivo en `notas`). Zona de dinero: verificación independiente READY TO COMMIT | S2, S3, S6 | `src/app/actions/pedido.ts`, `src/lib/sale-registration.ts` | hecho, verificador independiente + 3 flecos resueltos | `23370b0` |
| U5 | Kanban y pedidos — UI: sección dentro de `/ventas`, 4 columnas en PC con arrastre, lista + selector por estado en celular, paso de cobro al soltar en «Pagado», avisos de vencimiento, tab de canal. Sin Server Actions públicas nuevas para leer | S3 | `src/app/ventas/pedidos/` + componentes | pendiente | — |
| U6 | Reserva derivada R1: `registerSale` y `moveStock` pasan a respetar lo reservado (`stock − reservado ≥ cantidad`), disponibilidad derivada de la prenda (Disponible/Reservada/Vendida), y el aviso en el alta/venta. Zona de dinero/stock: verificación independiente | S1, S2, S6 | `src/app/actions/sale.ts`, `inventory.ts`, `prenda.ts` | pendiente | — |
| U7 | Entrega contra pago: transición RESERVADO→ENTREGADO («entregar y cobrar») que registra el pago en el momento de la entrega (Sale obligatoria + señas previas al total), con su botón en la tarjeta. Zona de dinero: verificación independiente | S2 | `src/app/actions/pedido.ts`, `src/app/ventas/pedidos/` | pendiente | — |
| U8 | Código de prenda por categoría: `CategoriaPrenda.codePrefix` (semillas RP/RPI/RPH), `createPrenda` usa el prefijo de SU categoría (reemplaza el PK fijo), el generador sigue desde el máximo existente (preparado para la migración de las ropas cargadas como productos). El dueño pasará el último código de producción | S1 | `prisma/schema.prisma`, `prendaTaxonomy.ts`, `prenda.ts` | hecho | `85ce7c1` |
| U9 | Wizard de nuevo pedido (2+ pasos, como BulkProductForm) y retoque de front. PENDIENTE: el dueño quiere explicar personalmente cómo quiere el front cuando llegue el momento — RECORDARLO | S3 | `src/app/ventas/pedidos/components/PedidoForm.tsx` | pendiente | — |

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
- **L4.** U1 commiteada en `db70f0d` (esquema + fixture de tipo + docs de fase: ADRs, mockups,
  plan). Evidencia: `prisma validate` OK; `db push` local en sincronía (dos corridas, la segunda
  "already in sync"); suite completa **115/115 y 945/945** sin regresión; `tsc` 0 tras completar
  `kind: "PRODUCT"` en los dos mocks de `ProductForm.test.tsx` (única causa de los 2 errores
  TS2322, probada por A/B por el worker: sin `kind` en el esquema, `tsc` en 0; completación de tipo
  autorizada por el coordinador, sin tocar aserciones). RED declarada N/A: unidad de puro esquema
  sin cambio de comportamiento. Dos ajustes del coordinador sobre el entregado del worker:
  `PrendaDetalle.detalleCondicion String?` sumado (flaggeado por el worker como faltante del
  diseño §1.1) y limpieza del `prisma generate` que dejaba DLL `.tmp` (causa: dev servers huérfanos
  — el `job_stop` del harness mata el wrapper npm y no el árbol de `next dev`, que retiene el
  puerto 3000 y la DLL; se mató el PID exacto que reportó Next y el generate completó). Deuda
  cosmética: ninguna pendiente. Semillas de taxonomía NO van acá: van con U2.
- **L5.** U2 commiteada en `545efa6` (acciones de las 5 taxonomías + validaciones + semillas +
  npm script). Evidencia: RED correcta (módulo inexistente), GREEN **42/42**; semillas aplicadas a
  la base local (18 filas: condición 3, medidas 3, canales 4, categorías 3, estilos 5) con
  idempotencia probada (2ª corrida: 0 filas); guarda de host no-local verificada con un host
  remoto de prueba; `tsc` 0 y `eslint` 0. Reencuadre del coordinador: la "UI mínima" de U2 se mudó
  a U3 (los selectores con creación inline viven en el formulario, como hace `CategorySelector`).
  Nota de unicidad: el `@unique` de Postgres distingue mayúsculas, la unicidad case-insensitive
  vive en la app y la carrera de alta concurrente queda cubierta mapeando P2002 al mismo mensaje.
  **Frontera de slices** (por el guard de presupuesto de entrega): cada unidad de la tabla es un
  slice con su commit (U1 además llevó los docs de fase en el mismo commit, ~4.2k líneas de
  documentación/mockups que no son código de producción; no se recortaron pruebas ni artefactos,
  que es la guía de `AGENTS.md` §7).
- **L6.** U3 commiteada en `a029f87` y verificada por el dueño en navegador («ya lo probe, anda de
  diez»). Evidencia del worker: RED correcta por área; GREEN **52/52** en 4 suites (18 acciones +
  8 form + 5 card + 21 page) y **3/3** contra base local, incluida atomicidad con fallo forzado
  DESPUÉS del INSERT de Product (log de Prisma: INSERT ejecutado → error → conteos idénticos);
  `tsc` 0; `eslint` 0 errores. Decisiones de mínima aceptadas: update con taxonomía desactivada
  exige elegir una activa; sin reintento de código en colisión legada PK### (aborta limpio);
  desactivar una prenda usa el toggle existente de la card. Entrada: opción «Prenda» en el menú de
  alta de /inventario y Editar de la card abre PrendaForm para kind=PRENDA. Arranca U4 (dinero,
  aviso §0.4 dado): pedidos-servidor con verificación independiente al cierre.
- **L7.** U4 commiteada en `23370b0`. Unidad de DINERO: además del worker corrió
  **verificación independiente** (`gentle-ai-verify`) con veredicto READY TO COMMIT. Evidencia:
  refactor de `sale.ts` cero-cambio (diff vs origin/main = import + llamada al helper;
  `sale.test.ts` sin editar y verde; equivalencia de subtotal Decimal probada con 6 pares
  flotantes); orden requireAdmin→Zod→Prisma en las 9 acciones; cobrarPedido con transición
  optimista, saldo del servidor, re-chequeo de stock bajo lock (excluyendo los ítems propios),
  Sale vía `registrarVentaTx` y `saleId` en la misma transacción; atomicidad con fallo forzado
  DESPUÉS del INSERT de la Sale (rollback verificado en base local); consultas con select
  cerrado sin costo ni datos internos. Tres hallazgos del verificador, resueltos antes del
  commit: `getPedido` sin Zod (ahora `getPedidoSchema`), pedido de total 0 sin señas
  (paymentMethod ahora EFECTIVO, con test) y la transición «volver» PARA_ENVIAR→PAGADO del
  diseño §2.4 que faltaba porque el brief del coordinador la omitió (implementada, con test;
  a PAGADO se sigue entrando solo cobrando). Verde final: 59/59 mockeados + 2/2 base local,
  tsc 0, lint 0. Desviaciones conscientes aceptadas: motivo de cancelación en `notas` (sin
  columna propia), señas M1 sin asiento hasta cobrar, retiro pasa por Para enviar (decisión
  del dueño que reemplaza el supuesto PAGADO→ENTREGADO del diseño), `getPedido` expone
  phone/notas/performedBy solo a admin.
- **L8.** Cuarta jornada de pedidos del dueño (2026-11-19, tras verificar U5: «las demás
  cosas que me dijiste que pruebe andan todo», con el botón de cancelar pendiente de
  aclarar — por diseño solo aparece en RESERVADO, Pagado es irreversible):
  1. **Duda sucursales**: «tengo una prenda en una sucursal y cuando hago el pedido pongo
     para retirarla en otra, ¿eso está bien?». Opinión del coordinador registrada: v1
     mantiene el pedido de UNA sucursal (la del stock, tu decisión P5); retirar en otra se
     resuelve traspasando la prenda antes (el `moveStock` ya existe y U6 lo hará respetar
     reservas). CONFIRMADO por el dueño («Sí, me sirve así»: una sucursal por pedido, retiro cruzado = traspaso previo).
  2. **Entrega contra pago** (nuevo requisito textual): «a veces los clientes pagan recién
     cuando retiran el pedido de una sucursal, entonces un pedido podría estar en estado de
     entrega y aún no estar pagado, al momento de estar entregado ahí sí se registra el pago
     sí o sí si es que no se registró antes» → U7. Modifica la máquina: ENTREGADO exige Sale
     aunque nunca haya pasado por Pagado.
  3. **Código de prenda por categoría** (textual): «la ropa nueva sea RP, la ropa intervenida
     RPI y la ropa second hand RPH»; «en producción ya tengo ropas cargadas como productos
     normales, esas luego las migro, te tendría que decir cuál es el último código generado»
     → U8, REEMPLAZA la decisión P8 (PK fijo). El generador por máximo existente absorbe la
     migración sin sembrar contadores a mano.
  4. **UX/UI** (textual): «estaría bueno que el cargar un nuevo pedido sea en pasos… un tipo
     wizard de 2 o más pasos» y «retocar el front pero eso lo vemos luego, recordame que te
     explique cuando sea el momento como es que quiero el front» → U9, con el recordatorio
     registrado también en Engram.
- **L9.** El dueño pegó la respuesta de Claude: `polkalinas-especificacion-visual.md`, movida a
  `docs/adr/` y commiteada (`a48645d`). Calidad alta: contraste WCAG calculado par por par con
  prohibiciones explícitas (frutilla/suave nunca sobre rosa; `#EADAD6` solo decorativo, controles
  con `#8A6E68`), dos variantes con recetas de className exactas, theming de SweetAlert
  (`lib/alerta.ts`, confirmar pasa a cacao, destructivo a frutilla oscura), next/font, y el orden
  de aplicación con `/ventas` como piloto. TRES observaciones del coordinador para U9:
  1. **Nombres de tokens**: la spec define nombres nuevos (`superficie`, `texto`, `acento`) pero
     el repo ya tiene los suyos (`surface`, `ink`, `accent`…). Para la variante A (recolor), lo
     correcto es REPUNTAR los tokens existentes a los nuevos valores en vez de renombrar clases
     por todo el repo; los nombres nuevos se agregan solo donde hacen falta (frutilla, cacao,
     columnas del Kanban).
  2. **`piano.svg`**: la franja decorativa referencia un asset que no existe en el repo aún
     (opcional, solo variante B); hay que exportarlo del kit de marca o dibujarlo.
  3. **Modo oscuro**: la spec es solo-clara; el repo tiene un bloque dark parcial en `globals.css`
     y `docs/Nuevas cosas.md` pide tema oscuro a elección del usuario. Decidir en U9 si el dark
     se congela hasta después del pilot de recolor.
- **L10.** U6 commiteada. Unidad de DINERO/STOCK con doble firma: worker + verificación
  independiente (veredicto READY TO COMMIT). Evidencia: `reserva.ts` nuevo (R1 extraída de
  pedido.ts — el verificador confirmó extracción pura contra HEAD: mismos where/orden, con una
  desviación de borde en `productIds` vacío que el coordinador cerró con una guarda de 3 líneas
  antes del commit); `registerSale` y ambos traspasos chequean `stock − reservado ≥ cantidad`
  dentro de la transacción y bajo advisory locks en orden ascendente (sin deadlock con
  pedido.ts, verificado); el lote aborta antes del primer upsert (rollback total); wiring-only
  de las 3 suites viejas confirmado por diff (cero expect tocados); proof end-to-end en base
  local: reservar → venta directa rechazada con stock intacto → traspaso rechazado → cobrar
  decrementa una sola vez → cancelar libera y la venta pasa (4/4). Suites: 116/116 en las seis,
  4/4 + 2/2 + 10/10 en base local, tsc 0, lint 0. Dos deudas CONFIRMADAS por el verificador:
  (a) `adjustBranchStockBatch` y el cierre del control de stock NO miran reservas — el ADR §2.2
  lo prometía y ninguna unidad lo tenía agendado: se mueve a U7; (b) `auth-guard.actions.test.ts`
  roja desde U3/U4 (lista de módulos pinneada sin pedido/prenda/prendaTaxonomy): se suma a U7.
- **L11.** U7 commiteada. Unidad de DINERO con doble firma: worker + verificación independiente
  (veredicto READY TO COMMIT). Evidencia: núcleo `cobrarTx` extraído de `cobrarPedido` (los 43
  tests del cobro sin tocar una aserción, byte-idénticos y verdes); `entregarPedido` solo desde
  RESERVADO, transición optimista → núcleo de cobro → `saleId` en la MISMA transacción (el
  verificador confirmó: transición primero para que la reserva propia no cuente, sin ventana de
  sobreventa, y un crash no deja Entregado sin Sale); MIXTO/total-0 por el mismo camino del cobro.
  Las CUATRO bajas de stock fuera de venta/traspaso (adjustProductStock, assignStockToBranch,
  adjustBranchStockBatch EXIT y el cierre del control) pasan por `verificarDisponible` — las dos
  deudas de L10 saldadas; la meta-test de auth-guard verde registrando los módulos nuevos
  (conteo pinneado 64→99, honesto según conteo independiente del verificador). El coordinador
  cerró el hallazgo bajo del verificador ANTES del commit: guarda nueva en `moverPedido`
  (PARA_ENVIAR→ENTREGADO exige `saleId`: ninguna fila legada llega a Entregado sin su venta —
  invariante del dueño) con test propio (51 en pedido.test). Totales: 128/128 + guardia 72/72,
  3/3 base local end-to-end (reservar → entregar → Sale/stock/EXIT únicos), tsc 0, lint 0.
  Verificado en navegador por el dueño («okey») y sesión cerrada al final del día 2026-11-19/20.
- **L12.** U8 commiteada (`85ce7c1`). Código por categoría: `CategoriaPrenda.codePrefix` nuevo
  (semillas RP=«Nuevo», RPI=«Intervenido», RPH=«Second hand» en `scripts/seed-prenda-taxonomies.mjs`,
  que además rellena idempotentemente el prefijo de filas existentes), `createPrenda` genera el
  código con el prefijo de SU categoría bajo el lock de ese prefijo y sigue la secuencia desde el
  máximo existente (absorbe la futura migración de las ropas cargadas como productos, sin
  contadores a mano); sin prefijo, el alta rechaza con «La categoría «X» no tiene prefijo de
  código» antes de abrir la transacción (el renombrado nunca toca el prefijo, así que leerlo
  pre-transacción es seguro). La creación de categoría pide el prefijo en un segundo paso del
  prompt (2-4 letras, normalizado a mayúsculas por Zod). RED: 2 fallos nuevos observados
  (prefijo de categoría y rechazo sin prefijo) → GREEN 20/20 en prenda.test + 2 nuevos en
  prendaTaxonomy.test + pin de PrendaForm (dos prompts). Checks: suite completa
  **1119/1119** con base local, tsc 0, lint 0 errores/36 avisos previos. Prueba visual del dueño
  pendiente: crear categoría con prefijo, alta de prenda con código RP…/RPI…/RPH… y el texto
  nuevo del formulario.
- **L13.** Incidente del entorno (2026-11-20, registrado en Engram #1551): un `npx prisma db push
  --accept-data-loss` corrido directo en vez del wrapper `scripts/local-db.mjs` sincronizó
  **producción** con el esquema de la rama (agregó las tablas/enums de prendas con `codePrefix`;
  dropeó `Product.stock` legada, 435 valores). Causa raíz: el datasource define
  `directUrl = env("DIRECT_URL")` y el push conecta por ahí; pisar solo `DATABASE_URL` (o fijar
  `DATABASE_URL_TEST`, que Prisma no lee) no alcanza. Verificado solo-lectura: la app desplegada
  (`main`) no referencia ni la columna dropeada ni las agregadas — no rompe. El dueño decidió
  **dejar producción como está** (sin PITR); la huella queda como adelanto del esquema que la
  rama llevará igualmente. El push LOCAL correcto pisa las dos variables; base local sincronizada
  y sembrada (RPH/RPI/RP completados en las tres categorías).
- **L14.** Deuda preexistente saldada al cerrar U8 (la suite completa no podía quedar roja):
  (a) `auth-guard.coverage.test.ts` **ya estaba roja en HEAD 9743e0a** (verificado con `git
  stash`): `prendaTaxonomy.ts` centraliza el guardián en helpers genéricos y el barrido no veía
  la delegación — además su regex no matcheaba helpers con genéricos (`crear<T>`). La red ahora
  acepta delegación a helpers del mismo archivo **verificando el guardián dentro del helper y su
  orden**; una acción que haga trabajo directo (Zod/Prisma) sin guardián sigue en roja. (b) El
  conteo de fichas del test de rollback de `prenda.local-db` era global y competía con las suites
  paralelas que crean prendas (carrera observada dos corridas seguidas): acotado al `categoriaId`
  de la propia suite. Ambos cambios son test-only.
