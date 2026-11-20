# Front — Polkalinas: inventario de los HTML y plan de adaptación

Estado: **exploración completa, sin implementar**. Fuente: los 8 mockups de
`polkalinas-html/polkalinas-html/` (`web/`: index, catalogo, producto; `sistema/`: panel, prendas,
nueva-prenda, ventas, reportes). Fecha: 2026-11-18. El inventario funcional completo con las
funcionalidades que faltaban en el requisito está en §3; los choques detectados en §4.

---

## 1. Lenguaje visual (tokens, idénticos en los 8 HTML)

- **Paleta**: `--crema #FFF6F0` (fondo), `--rosa #F2C4CC`, `--frutilla #C8323C` (acento/primario),
  `--cacao #4A2C2A` (texto/botón primario), `--gris #D8D2D0` (placeholders), `--suave #76574F`
  (texto secundario), `--borde #EADAD6`. Estados: ok `#E3EFE3/#2F5B33`, warn `#FBE7C8/#7A4A06`,
  bad `#F6D5D7/#8E1F28`, neutro `#ECE6E4/#5E4E4B`.
- **Tipografías**: Fraunces (serif, 400/600, **itálica para títulos, marca y etiquetas de precio**)
  + Work Sans (cuerpo 16px/1.5). Google Fonts.
- **Formas**: botones/chips/estados en pastilla (`999px`, borde 2px cacao), paneles 18px, tarjetas
  16px, inputs 12px, kanban 14px. Distinto del glass actual: superficies planas crema/blanco con
  bordes marcados, sin blur.
- **Motivos de marca**: logo frutilla (SVG), «piano» (franja decorativa de teclado), colgante de
  etiqueta en el hero, radial-gradient de lunares en el banner rosa.
- **A11y ejemplificada**: `aria-pressed` en toggles, `focus-visible` con outline 3px frutilla,
  `role=status/alt/tablist`, targets 44px (56px tabbar).
- **Sistema interno**: sidebar 248px (Panel · Prendas · Ventas · Clientas y reportes) + bloque
  usuario con rol visible y logout; breakpoint 900px pasa a `mob-head` sticky + **tabbar fija de 4**
  + FAB frutilla. Kanban con fondos por columna (`#F3E3D3/#E3EFE3/#F2C4CC/#ECE6E4`).
- **Móvil público**: nav en chips scrolleables, filtros como **bottom sheet** (85vh, radius 22px
  superior), galería PDP con dots en vez de thumbs, 2 columnas de tarjetas.

## 2. Inventario por página (resumen)

**web/index** — topbar («Envíos a todo el país desde Salta · Compras por WhatsApp»), hero con
kicker de **drop** («Nuevo drop · [FECHA]») y colgante «Pieza única», 4 categorías destacadas
(Second hand, Intervenido, Cositas, Accesorios), grilla «Recién llegado» con tarjetas (tag de
categoría, fav, aviso «Reservada/Vendida»), banner con lunares, «Cómo comprar» en 4 pasos,
valores, grilla de 6 fotos «Instagram», footer con Ayuda (Cómo comprar, Envíos y retiros, Medios
de pago, Guía de talles, Cambios) y contacto (WhatsApp, Instagram, TikTok, punto físico).

**web/catalogo** — título con contador («[N] prendas · todas únicas»); filtros desktop 260px /
bottom sheet mobile: **categoría con conteo, talle (XS–XL + Único), estilo (coquette, vintage,
Y2K, alternativo, romántico), precio desde/hasta, «Ocultar vendidas»**; chips de filtros activos
removibles; ordenar (más nuevas / menor / mayor precio); «Ver más prendas»; tarjetas 4:5 con tag
de categoría, favorito, precio y meta «Talle M · única».

**web/producto** — galería (1 foto + 4 thumbs en PC, dots en mobile), chips «Pieza única» +
estado «Disponible», talle fijo + **link «Guía de talles»**, precio grande, **«Lo quiero por
WhatsApp»** con `wa.me` que lleva nombre y **código `PK-0142`**, «Sumar a mi bolsita»,
descripción, **medidas nombradas** (ancho axila a axila, largo total, largo de manga),
**estado «Muy bueno · [detalle]»**, info de envío (correo/encomienda, costo por WhatsApp), retiro
en punto físico con horario, medios de pago (transferencia, Mercado Pago, efectivo), relacionados.

**sistema/panel** — saludo «Hola, [Nombre] ♡», buscador global (prenda, código o clienta),
avisos, botón «Nueva venta»; **4 KPI**: Ventas del mes ($ y cantidad), Prendas disponibles,
**Reservas sin cobrar («2 vencen hoy»)**, Pedidos para enviar («1 sale hoy»); ventas por canal
(WhatsApp 42%, Instagram 28%, Punto físico 20%, TikTok 10%); **lista «Reservas por cobrar» con
vencimiento y botón «Cobrada» por fila**; últimas ventas con canal; **lista «Para enviar» con
estado de preparación («Etiqueta lista», «Falta embalar», «Coordinar») y medio de envío
(Correo/Encomienda/Retira en el local) + ciudad**.

**sistema/prendas** — «86 prendas cargadas · cada una es única»; tabs con conteo: **Todas ·
Disponibles · Reservadas · Vendidas**; filtros categoría/talle/estilo y orden; tabla con thumb,
código, categoría, talle, **costo**, precio, estado, **«Publicada en» (Web · IG · WhatsApp)** y
menú de acciones por fila; paginación; mobile como tarjetas que abren la edición.

**sistema/nueva-prenda** — fotos con **«Hasta 6 · la primera es la portada»** (grilla de slots);
**etiqueta de precio con preview 110×180 y botón «Imprimir etiqueta»** (código + talle + precio);
nombre; **código autogenerado readonly (`PK-0143`, «Se genera solo»)**; categoría select; talle
select (XS–XL + Único); **medidas: «Ancho axila a axila (cm)» y «Largo total (cm)»**; estado de la
prenda select (**Muy bueno / Bueno / Con detalles (aclarar)**); **«Detalle de la intervención»**
aparte; **estilo multi-selección (pills)**; «Descripción para la web» textarea; **costo + precio
con «Ganancia estimada: $ X · margen Y%» calculado en vivo**; **«Publicar en»: Web (catálogo),
Instagram, Catálogo de WhatsApp (checkboxes)**; «Guardar y cargar otra» y «Guardar prenda».
**No hay** selector de sucursal/depósito, ni cliente, ni fecha de ingreso.

**sistema/ventas** — título **«Ventas y pedidos»**; tabs por **canal** (Todos, WhatsApp,
Instagram, TikTok, Local); **Kanban 4 columnas: Reservado / Pagado / Para enviar / Entregado**, con
conteos; tarjetas **draggables** con nº de pedido (`V-0231`), canal, clienta + **ciudad**, ítems
en texto libre con cantidades («Peluche osito ×2»), pie con **seña** («Seña $ 5.000», «Sin seña»),
medio de pago (Transferencia/Efectivo), envío y estado de etiqueta, y total. Instrucción
explícita: **«Al pasar a "Pagado", la prenda queda como vendida en el catálogo.»** Mobile:
segmentos por estado + «mantené apretada una tarjeta para moverla» (long-press).

**sistema/reportes** — «Solo la dueña ve costos y ganancias»; rango (Este mes / Mes anterior /
Últimos 3 meses); KPIs: **Ingresos, Costo de mercadería, Ganancia + margen %, Ticket promedio**;
ventas por semana (4 barras); **por categoría** (Second hand, Intervenido, Cositas, Accesorios —
mezcla taxonomías de prenda y de producto); **top clientas** (compras, total, última compra);
**«Equipo y permisos» con roles Dueña / Vendedora ×2 e invitación** (Vendedora: «sin costos ni
reportes»).

## 3. Funcionalidades que NO estaban en el requisito

1. **Seña / pago parcial** en pedidos («Seña $ 5.000», «Sin seña») y lista de **reservas por
   cobrar con vencimiento** («vence hoy / mañana») y acción «Cobrada».
2. **Canal de venta** como dato de primera clase (WhatsApp / Instagram / TikTok / Local) en
   pedidos, panel y reportes.
3. **Publicación multi-canal por prenda** («Publicar en»: Web, Instagram, WhatsApp) — no solo el
   catálogo web.
4. **Estados de disponibilidad de la prenda** (Disponible / Reservada / Vendida) **distintos del
   estado de condición física** (Muy bueno / Bueno / Con detalles).
5. **La regla de oro del Kanban**: al pasar un pedido a «Pagado», la prenda queda **vendida en el
   catálogo** automáticamente.
6. **Estado de preparación del envío** («Etiqueta lista» / «Falta embalar» / «Coordinar») y medio
   de envío (Correo / Encomienda / Retiro) con **ciudad de la clienta**.
7. **Hasta 6 fotos** en la carga (la ficha pública muestra 4 thumbs — inconsistencia a resolver).
8. **Etiqueta de precio imprimible desde el alta**, con preview y «Imprimir etiqueta» (código +
   talle + precio) — aparece ANTES de lo que decías («lo vemos en el siguiente paso»).
9. **Costo + ganancia/margen calculado en vivo** y regla de acceso «solo la dueña ve costos y
   ganancias».
10. **Multiusuario con roles** (Dueña con todo, Vendedora sin costos ni reportes) + invitación —
    hoy el sistema solo tiene `admin`.
11. **Panel con KPIs** y tres listas de pendientes (reservas por cobrar, para enviar, últimas
    ventas) + buscador global + avisos.
12. **Reportes completos**: ingresos, costo de mercadería, ganancia, margen, ticket promedio,
    ventas por semana y por categoría, **top clientas con última compra**.
13. **Favoritas y «Mi bolsita»** en la web pública (selección para consultar por WhatsApp) —
    choca con ADR-12 «vidriera sin carrito».
14. **Filtro «Ocultar vendidas»** y avisos «Reservada · consultá» en la vidriera.
15. **Drops** («Nuevo drop · [FECHA]») como novedades de la home.
16. **Guía de talles**, cambios/devoluciones, medios de pago con **Mercado Pago**, envíos
    nacionales con costo cotizado por WhatsApp, punto físico con horario.
17. Números propios de pedido (`V-0231`) y de prenda (`PK-0143`) con prefijo autogenerado.

## 4. Choques e inconsistencias detectadas

| # | Choque | Dónde |
|---|---|---|
| C1 | «Mi bolsita» es un carrito-lite; ADR-12 decía «vidriera, sin carrito» | web/index, producto |
| C2 | **4 fotos** (ficha pública) vs **«Hasta 6»** (carga) | producto.html vs nueva-prenda.html |
| C3 | Sidebar «Clientas y reportes» vs tabbar «Reportes» | panel.html |
| C4 | Reporte «por categoría» mezcla categorías de prenda (Second hand) y de producto (Cositas, Accesorios) | reportes.html |
| C5 | El requisito dice «las prendas se mueven entre sucursales» pero **ninguna pantalla del sistema muestra ubicación/depósito/sucursal** | nueva-prenda.html |
| C6 | Roles Dueña/Vendedora vs el sistema actual con un solo rol `admin` + proxy | reportes.html |
| C7 | «Etiquetas nuevas» dijiste que iban después, pero el alta ya trae preview + imprimir | nueva-prenda.html |
| C8 | Prenda «Reservada» (por pedido) y pedido «Reservado» comparten palabra pero son estados de entidades distintas | prendas.html vs ventas.html |

## 5. Plan de adaptación al front actual (borrador, sin implementar)

- **Vidriera pública**: los 8 HTML comparten un **tema** (tokens) y varios componentes que ya
  existen con otra piel: chips ↔ chips actuales, bottom sheet de filtros ↔ patrón de sheet del
  repo, tarjetas 4:5 ↔ grilla del catálogo F1, galería con dots ↔ PDP de F1. La adaptación es:
  tema nuevo (crema/frutilla/cacao + Fraunces) vía tokens de Tailwind, **manteniendo** la
  estructura de componentes del repo; el «estilo Polkalinas» es skin, no arquitectura.
- **Sistema interno**: hoy el repo es **mobile-first con BottomNav**; el mockup imagina sidebar
  desktop + tabbar móvil. El patrón repo (BottomNav + `OptionsMenuModal`) cubre el caso móvil
  casi igual; el sidebar desktop es la pieza genuinamente nueva.
- **Kanban**: drag & drop desktop + long-press móvil no existen en el repo; es un componente nuevo
  (los HTML lo resuelven con ~20 líneas de JS, sin librería).
- Los KPIs, barras y gráficos del panel/reportes: el repo ya usa **Recharts**; los mockups usan
  barras CSS. Decisión de implementación, no de diseño.
- Fraunces/Work Sans por `next/font`; el itálico de Fraunces es parte de la identidad (títulos y
  etiquetas), no decoración.

## 6. Preguntas nuevas que abre esta exploración

Las numeré P10+ en `docs/adr/prendas-pedidos.md` §2: bolsita/favoritas (C1), señas y vencimientos,
canales, multi-publicación, roles (C6), 4 vs 6 fotos (C2), etiqueta en el alta (C7), reportes de
costo y top clientas, depósito sin UI (C5).
