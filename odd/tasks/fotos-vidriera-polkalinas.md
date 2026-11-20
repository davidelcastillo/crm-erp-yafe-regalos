# Fotos por prenda/producto y vidriera pública Polkalina's

Objetivo: (1) cargar hasta 4 fotos por prenda **y producto** (con portada),
guardadas en Supabase Storage, desde el alta y la edición; (2) la vidriera
pública **/polkalinas** — tienda de solo lectura con el estilo de los mockups
`polkalinas-html/polkalinas-html/web/` (catálogo con chips y ficha con
galería), mostrando prendas y productos marcados «Publicar en: Web», con botón
de consulta por WhatsApp.

Elección del dueño (2026-11-20): fotos y vidriera encadenadas; **prendas +
productos** en fotos y en la vidriera; **WhatsApp** como contacto; ruta
**/polkalinas en la misma app** (con la opción de dominio propio apuntando al
mismo deploy más adelante; repo aparte descartado por ahora).

Rama: por definir al implementar (main ya tiene la línea Polkalina's completa,
PR #14 mergeado y deployado el 2026-11-20).

Fuera de alcance v1: carrito/checkout online, favoritas («Mi bolsita»),
recorte/edición de fotos, videos, fotos por variante (no hay variantes).

## Specs

- **S1. Fotos (dueño: «Prendas + productos»)**: hasta 4 fotos por producto de
  cualquier `kind` (PRENDA o PRODUCT), una portada (posición 0). Se cargan
  desde el alta y se administran en la edición; se comprimen y redimensionan en
  el navegador antes de subir. La escritura va por **URL firmada emitida por
  una Server Action con `requireAdmin`** (ADR-08: nunca service-role en el
  cliente; el body de las Server Actions no sirve para archivos grandes).
- **S2. Vidriera (dueño: «Prendas + productos», «WhatsApp»)**: ruta pública
  `/polkalinas` sin login, solo lectura. Lista las prendas y productos con
  publicación en canal «Web» (tabla `PrendaPublicacion`, que cuelga de
  `Product` y sirve para ambos kinds). Estados por ítem: prendas →
  Disponible/Reservada/Vendida (derivado de pedidos/ventas, diseño lógica
  existente); productos → Disponible/Agotado por stock. Cada ficha muestra la
  galería y un botón «Consultar por WhatsApp» con el número del dueño y el
  código/nombre en el mensaje.
- **S3. Publicar productos normales**: el alta/edición de producto gana
  «Publicar en: Web» (mismo patrón que las prendas; reutiliza `PrendaPublicacion`,
  sin tabla nueva).
- **S4. Acceso público seguro**: la vidriera no expone costos, clientes, ni
  stock interno por sucursal; lee por Prisma en el servidor (patrón del catálogo
  público `getExternalBranchInventory`), y el proxy deja pasar `/polkalinas`
  sin sesión. La meta-test de guardián sigue cubriendo toda action nueva.

## Diseño

- **`ProductImage`** (ADR `catalogo-externo.md:123-131`, no reinventado):
  `productId`, `position Int 0..3` (único por producto), `path String` (ruta en
  el bucket, no URL), `alt?`, `bytes Int`. Cuelga de `Product` (ADR-12).
- **Storage**: bucket `product-images` público para leer (URLs estables
  cacheables vía `getPublicUrl`) y **escritura solo firmada** tras
  `requireAdmin`. Cliente admin: `src/lib/supabase/admin.ts` (service-role,
  solo servidor). Bucket nuevo que hay que crear en el stack local
  (`supabase/config.toml [storage.buckets.product-images] public = true`) y en
  el proyecto remoto (paso manual documentado).
- **Dos tamaños, una columna**: `path` guarda el prefijo del hash; los archivos
  son `<hash>_lg.webp` (ficha) y `<hash>_sm.webp` (miniatura) — convención
  derivable, decisión del coordinador sobre el punto abierto del ADR-08.
- **Flujo de subida** (ADR-08): el formulario redimensiona en el navegador
  (máx. ~1200px lg / ~400px sm, WebP) → pide a la action `firmarSubida`
  (`requireAdmin`) la URL firmada → sube directo al bucket → llama a la action
  `confirmarFoto` que escribe la fila `ProductImage` en una transacción con
  posición libre. Borrar foto: action `quitarFoto` que borra fila + objeto.
- **Vidriera**: páginas server-render con `dynamic = "force-dynamic"` (patrón
  del catálogo público). Catálogo: chips de filtro por categoría de prenda +
  tabs (mockup `catalogo.html`); ficha: galería 1 foto + thumbs (mockup
  `producto.html`). Estados derivados en el servidor.

## Tasks

| ID | Tarea | Specs | Ruta principal | Estado | Commit |
|---|---|---|---|---|---|
| T1 | Esquema `ProductImage` + lib de storage (firmar/confirmar/quitar, bucket local y remoto documentado) + actions de foto con `requireAdmin` y meta-test al día | S1, S4 | `prisma/schema.prisma`, `src/lib/storage.ts`, `src/app/actions/foto.ts` | hecho | `5a7d3f0` |
| T2 | Dropzone en `PrendaForm` y `ProductForm`: hasta 4 fotos, portada, redimensionado en el navegador, alta y edición | S1 | `src/app/inventario/components/PrendaForm.tsx`, `src/app/productos/components/ProductForm.tsx` | pendiente | — |
| T3 | «Publicar en: Web» para productos normales (alta/edición, misma tabla `PrendaPublicacion`) | S3 | `src/app/actions/product.ts`, `ProductForm` | pendiente | — |
| T4 | Vidriera `/polkalinas`: catálogo público (prendas+productos Web) con chips, tarjetas con foto y estado | S2, S4 | `src/app/polkalinas/page.tsx`, `src/proxy.ts` | pendiente | — |
| T5 | Ficha pública `/polkalinas/[id]`: galería, estado, WhatsApp, datos públicos | S2 | `src/app/polkalinas/[id]/page.tsx` | pendiente | — |
| T6 | Suite completa, lint, tsc, build, prueba visual del dueño, docs y cierre | S1–S4 | — | pendiente | — |

Orden: T1 → T2/T3 → T4 → T5 → T6. La creación del bucket en el Supabase
**remoto** es un paso manual con autorización explícita del dueño (igual que
cualquier operación de producción).

## Log

- **L1 — Pedido y elección (2026-11-20, verbatim)**: «sigamos con lo demas» →
  selección: «Fotos por prenda» + «Vidriera pública Polkalina's». Contexto
  previo: «ya pasas a temas de imagenes y el catalogo Polkalinas?».
- **L2 — Decisiones del dueño (2026-11-20)**: fotos y vidriera para **prendas
  y productos**; contacto **WhatsApp**; URL: pregunta del dueño («que es mas
  seguro? capaz alguno entra a la url… tienen todo viviendo en el mismo repo? o
  son repos distintos?») → recomendación del coordinador aceptada:
  **/polkalinas en la misma app** (el perímetro real es auth+servidor, no la
  URL; dominio propio opcional apuntando al mismo deploy; repo aparte
  descartado por ahora).
- **L3 — Exploración de infraestructura** (gentle-ai-explore, solo lectura):
  cero uploads implementados hoy; `createAdminClient` service-role solo en
  servidor (`src/lib/supabase/admin.ts:1-11`); `[storage] enabled` en el stack
  local sin buckets declarados; sin `images.remotePatterns` ni límites de body
  (por eso URL firmada); `ProductImage` diseñado en
  `docs/adr/catalogo-externo.md:123-131` (position 0..3, path, bytes); ADR-08
  pendiente ya recomienda bucket público-lectura + escritura firmada; el
  catálogo público `getExternalBranchInventory` es el patrón de acceso sin
  login; puntos abiertos resueltos por el coordinador: convención de dos
  tamaños sobre una sola columna `path` (`<hash>_lg/_sm.webp`) y reutilización
  de `PrendaPublicacion` para productos.
- **L4 — WhatsApp del dueño (2026-11-20, verbatim)**: «te paso el número: +5493876360163». El botón «Consultar» de la vidriera abre `https://wa.me/5493876360163` con mensaje precargado (nombre/código del ítem). Va como constante en el módulo de la vidriera (dato público de la marca, no un secreto).
