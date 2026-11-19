# ADR — Prendas y pedidos (ropa intervenida / segunda mano)

Estado: **borrador de requisitos, nada decidido**. Fecha: 2026-11-18. Fuente: mensaje del dueño
(transcriptado en §0). El diseño de la lógica se delega a Claude (`docs/adr/prendas-pedidos-brief-claude.md`);
la exploración del front (HTMLs de `polkalinas-html/`) la hace Pi.

---

## 0. Pedido transcriptado (fuente de verdad textual)

«Nuevo requerimiento -> venta de ropa intervenida, segunda mano, nueva, etc. Sumado a los productos
que ya vendemos, ahora debemos crear una nueva tabla de productos que sea "Prendas" para cargar la
ropa, porque no puede ser un producto normal? Porque la ropa tiene nuevas características que te
describiré luego, además se tratan de forma distintas a un producto normal, una ropa debe tener:
nombre, imagen, código, categoría (intervenido, nuevo, etc -> esto debe ser modificable y poder
crear nuevas categorías), talle, medidas (opcional) - medidas axilas, largo, etc, detalle (o sea
descripción), estado de la prenda, estilo (elegibles y creables por el usuario -> puede ser vintage,
y2k, alternativo, etc), costo, precio de venta. Las prendas también pueden ser movidas en sucursal
aunque principalmente se venderán en el depósito, que es lo que sucede, usualmente las prendas son
por encargo, así que deberíamos hacer una nueva página/sección dentro de ventas en donde veamos los
pedidos, en pedidos también deberíamos poder tener productos normales, los pedidos pueden estar:
Reservados, Pagados, Para enviar, Entregados. Todos deben tener un cliente de origen y un o unos
productos y/o prendas. La vista debe ser estilo tableros Kanban en 4 columnas en PC, en celu una
lista con los selectores por estado. Las prendas además tienen un nuevo tipo de etiquetas distintas
a las de los productos, son más grandes y demás, eso lo vemos en el siguiente paso que es el cambio
de frontend, de todas formas te dejo los html de las ideas que tengo del catálogo y del sistema
interno, la idea es mantener nuestro front pero adaptarlo al estilo propuesto en los htmls.»

## 1. Requisitos extraídos

**Prenda** (entidad nueva, separada de `Product`): nombre, imagen, código, categoría de prenda
(modificable y creable por el usuario; ej.: intervenido, nuevo, segunda mano), talle, medidas
opcionales (axilas, largo, …), detalle/descripción, estado de la prenda, estilo (elegible y creable;
ej.: vintage, y2k, alternativo), costo, precio de venta. Se mueve entre sucursales; se vende
principalmente en el **depósito**.

**Pedido** (entidad nueva, sección dentro de Ventas): cliente de origen, uno o más ítems que pueden
ser productos normales **y/o** prendas. Estados: **Reservado, Pagado, Para enviar, Entregado**.
Vista Kanban de 4 columnas en PC; en celular, lista con selector por estado.

**Etiquetas de prendas**: distintas a las de productos, más grandes — **fuera de alcance de esta
fase**, se resuelven en el cambio de frontend (paso siguiente).

**Referencias visuales**: `polkalinas-html/polkalinas-html/web/` (público: `index`, `catalogo`,
`producto`) y `polkalinas-html/polkalinas-html/sistema/` (interno: `panel`, `prendas`,
`nueva-prenda`, `ventas`, `reportes`). El front propio se mantiene y se **adapta** al estilo
propuesto; no se reemplaza.

## 2. Preguntas abiertas (bloquean partes del diseño; el dueño decide)

| # | Pregunta | Por qué importa |
|---|---|---|
| P1 | ¿Una prenda es un **artículo único** (unidad 1, cada una distinta) o admite cantidades como `Product`? | Decide si reusa `BranchInventory` o tiene su propio seguimiento; segunda mano sugiere única |
| P2 | ¿La categoría de prenda y el estilo son **taxonomías propias** (tablas nuevas, creables) o reusan `Category`? | `Category` es de productos; el requisito pide crear/intervenir categorías de prenda |
| P3 | ¿Qué es exactamente el **«estado de la prenda»**? ¿Condición física (excelente/bueno)? ¿Lista fija o creable? | El requisito lo pide sin definirlo; categoría ya cubre intervenido/nuevo |
| P4 | ¿El **depósito** es una `Branch` más (con `isActive`, movimientos, caja) o una entidad distinta? | El requisito dice que las prendas «se venden en el depósito» y también se mueven a sucursales |
| P5 | ¿Un pedido al pagarse **genera una `Sale`** (y entra a caja/reportes) o vive paralelo a ventas? | **Toca dinero** (`AGENTS.md` §0.4): decide si el Kanban es solo vidriera de estado o parte del flujo contable |
| P6 | Transiciones del pedido: ¿quién puede mover de Reservado a Pagado, qué exige (pago registrado), y se puede volver atrás? | Máquina de estados; sin esto el Kanban es decorativo |
| P7 | ¿Las prendas entran al **catálogo público F1** (`catalog_public`), a una vidriera propia estilo `polkalinas-html/web/`, o a ambas? | Los HTML públicos sugieren un sitio propio; F1 ya está diseñado |
| P8 | ¿El código de prenda reusa el patrón de prefijo + secuencial (`AAA000`) o uno distinto? | Existe el helper de lock y el generador; reusarlo o no es una decisión |
| P9 | ¿La prenda tiene **una** imagen (como dice el requisito) o hasta 4 como `ProductImage`? | Cambia el modelo y el pipeline de subida. **Los HTML dicen «Hasta 6» en la carga y 4 thumbs en la ficha (C2)** |
| P10 | ¿«Mi bolsita» y «Favoritas» entran en la vidriera? Chocan con ADR-12 («vidriera, sin carrito») | Decide si el catálogo público tiene interacción o es solo consulta + WhatsApp |
| P11 | ¿Los pedidos admiten **seña/pago parcial** y reservas con **vencimiento**? | Toca dinero y el modelo de pago; los HTML lo muestran («Seña $ 5.000», «vence hoy», botón «Cobrada») |
| P12 | ¿El **canal de venta** (WhatsApp/Instagram/TikTok/Local) es un campo del pedido y de los reportes? | Los HTML lo ponen en tab, kanban y gráfico de canal |
| P13 | ¿La prenda se **publica en varios canales** (Web/IG/WhatsApp) con checkboxes por prenda? | «Publicada en» con tres destinos aparece en la tabla de prendas |
| P14 | ¿El sistema pasa a **multiusuario con roles** (Dueña/Vendedora, «sin costos ni reportes»)? | Hoy hay un solo rol `admin` + proxy; roles nuevos tocan auth y permisos (riesgo §0.4) |
| P15 | ¿La **etiqueta de prenda** (preview + «Imprimir etiqueta» en el alta) entra en esta fase o queda para la de frontend como se dijo? | El HTML de alta ya la trae (C7) |
| P16 | ¿Los **reportes de costo/ganancia/margen y top clientas** entran en v1 del sistema interno? | Dependen de que el costo de prenda exista y de la regla «solo la dueña ve costos» |
| P17 | ¿Qué estados de **disponibilidad** tiene la prenda (Disponible/Reservada/Vendida) y quién los mueve? | Los HTML separan disponibilidad de condición física; la regla del Kanban dice que «Pagado» ⇒ vendida en catálogo |
| P18 | ¿Dónde se ve la **ubicación/depósito** de la prenda? El requisito dice que se mueve entre sucursales, pero ninguna pantalla lo muestra (C5) | Falta UI para el requisito tal como está escrito |

### 1ter. Decisiones cerradas del dueño (2026-11-18)

- **P1 — Mixta por categoría**: las prendas second hand e intervenidas son **únicas** (cantidad 1);
  la ropa **nueva** admite cantidades. El modelo necesita una marca explícita por prenda (p. ej.
  `esUnica`), no derivarla solo de la categoría, para que la UI y las validaciones no dependan del
  nombre de una fila de taxonomy.
- **P5 — El pedido genera una `Sale` de la sucursal donde se encuentra la prenda** (respuesta
  textual: «Genera una sale de la sucursal donde se encuentre»). Caja y reportes siguen siendo
  la única verdad de la plata.
- **P11 — Señas sí**: pago parcial + saldo pendiente + reservas con vencimiento y acción «Cobrada»,
  como el panel de los HTML.
- **P4/P18 — El depósito es una `Branch` más**, con movimientos como el stock actual. Falta solo
  decidir la UI que muestra la ubicación (C5 sigue abierto en el front).
- **P10 — «Mi bolsita» queda fuera de v1** (respuesta textual: «lo de mi bolsita aun no lo
  implementamos»): idea de mockup, sin decisión. Lo mismo vale para «Favoritas» mientras no se
  decida lo contrario.
- **P14 — Sin roles en v1** (recomendación aceptada): el sistema sigue con el único rol `admin`;
  Dueña/Vendedora queda anotado como fase posterior (toca auth y permisos).
- **P12 — El canal de venta es un campo real del pedido** (WhatsApp/Instagram/TikTok/Local),
  habilita los agrupamientos del panel y los reportes.
- **P15 — La etiqueta de prenda va DESPUÉS**, como decía el mensaje original: la lógica solo deja
  el punto de enchufe; preview e impresión se diseñan en la fase de frontend.
- **P9 — Hasta 4 fotos por prenda** (por encima de las «Hasta 6» del mockup): coincide con el
  máximo de productos y con la ficha pública, que ya muestra 4 thumbs.
- **Modelo — Variante C aceptada** (tercera ronda): una prenda es un `Product` con `kind=PRENDA`
  y una ficha `PrendaDetalle` 1:1 (talle, medidas, condición, costo, estilos). Reusa stock,
  ventas, caja, fotos y catálogo; las pantallas de productos filtran por `kind`. Con esto quedan
  confirmados los supuestos del diseño de lógica (§1, §2.2 R1, §2.3 M1 y «Pagado = completo»).
- **Pedido de una sola sucursal**: todos los ítems de un pedido salen de la misma `Branch`; si
  hay mercadería en otra, primero se traspasa.
- **Señas — M1**: la seña queda anotada en el pedido y entra a caja recién al cobrar el saldo.
  Costo aceptado con conocimiento: un cierre de caja entre la seña y el pago no cuenta esa plata.
- **Pagado = completo**: un pedido solo pasa a Pagado cobrado entero; sin cuenta corriente por
  pedido (la deuda de clienta que ya existe queda para las ventas normales).

Siguen abiertas (segunda ronda cerró P9/P12/P14/P15; ver abajo la tercera y cuarta).

### 1cuater. Decisiones de la segunda jornada (2026-11-19, con el merge del PR #13)

Cuatro rondas con el dueño. Cerraron **todas** las preguntas de prendas/pedidos de su lado:

- **P7 — el catálogo público ES el sitio web de Polkalina's** (respuesta textual: «Mismo catalogo, el
  catalogo es el sitio Web de Polkalinas, asi que seria lo mismo»). Unifica los dos proyectos: F1
  se implementa con el estilo de `polkalinas-html/web` sobre los componentes del repo (plan de
  adaptación en `polkalinas-front.md` §5), sin un segundo sitio.
- **P2 — taxonomías propias** (categoría de prenda y estilo, tablas propias creables).
- **Venta directa sí**: una prenda se vende también desde «Nueva venta» (mostrador), con el chequeo
  de no vender lo reservado (R1).
- **Precio del pedido fijo del servidor** (invariante I7 del diseño confirmado).
- **P3 — condición CREABLE** ⚠️ cambia el diseño de lógica: `CondicionPrenda` deja de ser enum fijo y
  pasa a tabla creable (sembrada con Muy bueno / Bueno / Con detalles).
- **Seña de reserva cancelada: caso por caso** — al cancelar se marca el destino (devuelta o
  retenida); sin asiento automático en caja.
- **Retiro en local pasa por «Para enviar»** (preparación «Coordinar»), como el panel del mockup.
- **Número de pedido: V-0001** (numeración limpia en el sistema).
- **P8 — código PK0143 sin guion**: reusa el generador actual, un solo espacio de códigos.
- **Vencimiento: queda marcada** — la reserva vencida sigue bloqueando la prenda hasta que alguien
  la cancele (sin tarea programada).
- **P16 — reportes de costo/ganancia y top clientas: DESPUÉS** de la v1 de prendas+pedidos.
- **Medidas CREABLES** ⚠️ cambia el diseño de lógica: tabla `MedidaTipo` + `PrendaMedida` en vez de
  las 3 columnas fijas del §1 (sembradas con ancho axila a axila, largo total y largo de manga).
- **Vidriera con estados públicos**: Reservada («consultá») y Vendida (atenuada) se muestran en el
  catálogo como en los mockups, con filtro «Ocultar vendidas». ⚠️ extiende los dos estados del diseño
  del catálogo (Disponible/Consultar) a cuatro.
- **P13 — «Publicada en»: registro simple** de canales por prenda (checkboxes Web/IG/WhatsApp que
  solo anotan dónde se publicó a mano).
- **Clienta con teléfono** ⚠️ nuevo campo `Customer.phone` (hoy solo nombre y apellido).
- **Canales de venta CREABLES** ⚠️ cambia el diseño de lógica: `CanalVenta` pasa de enum fijo a
  tabla creable (sembrada con WhatsApp/Instagram/TikTok/Local).

Lo que queda abierto ya no depende del dueño de prendas: las preguntas de producto/cliente del
**catálogo** (número de WhatsApp, quién saca fotos y cuántas se publican, URL slug vs número, atraso
  aceptable del ISR) y la pregunta de si la vidriera de Polkalina's **muestra etiquetas de sucursal** quedó DECIDIDA
  el mismo día: **sí** — cada prenda muestra en qué sucursales está (allow-list de
  `CatalogItemBranch`), más el punto físico en el footer como los mockups.

### 1bis. Hallazgos de los HTML (`polkalinas-html/`)

La exploración completa de los 8 mockups está en `docs/adr/polkalinas-front.md` (inventario, choques C1–C8 y
plan de adaptación). Lo que afecta a esta lógica: señas y vencimientos (P11), canal de venta (P12),
multi-publicación (P13), roles (P14), estados de disponibilidad con la regla «Pagado ⇒ vendida en
catálogo» (P17), hasta 6 fotos (P9/C2), etiqueta imprimible en el alta (P15/C7), número propio de
pedido `V-02xx`, medidas nombradas (ancho axila a axila, largo total, en cm), estado de condición
con 3 valores (Muy bueno / Bueno / Con detalles), talle como texto libre con «Único», y envío
(Correo/Encomienda/Retiro) con estado de preparación y ciudad de la clienta.

## 3. Restricciones duras conocidas de antemano

- **Dinero**: pedidos con estados de pago y costo/precio en prendas → cualquier diseño que escriba
  plata exige aviso explícito y verificación (`AGENTS.md` §0.4, §0.2).
- **Las etiquetas nuevas NO van en esta fase** (decisión del dueño): el diseño de lógica solo anota
  dónde enchufarían.
- **No deshabilitar ni suponer resuelto el RLS** de nada nuevo (`AGENTS.md` §0.2).
- Mobile-first, `STYLE.md`, patrón de Server Actions con `requireAdmin` + Zod, igual que el resto.
- La vidriera pública, si existe, hereda las decisiones del ADR del catálogo (ADR-12 vidriera,
  ADR-13 vista acotada).

## 4. Reparto de trabajo decidido por el dueño

- **Diseño de la lógica** (modelo de datos, estados, acciones, invariants): Claude, modo plan,
  entregable `docs/adr/prendas-pedidos-diseno-logica.md` — **entregado 2026-11-18** (19 preguntas propias en su §9, 14 desacuerdos en su §10).
- **Exploración del front** (HTMLs de `polkalinas-html/`): Pi, entregable
  `docs/adr/polkalinas-front.md`.
- Implementación: después de cerrar las preguntas de §2 con el dueño.
