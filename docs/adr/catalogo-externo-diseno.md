# Diseño — Catálogo externo público (UI y flujos)

Estado: **borrador de diseño, sin código**. Encargo: `docs/adr/catalogo-brief-claude.md`.
Fuente de verdad del modelo y las reglas: `docs/adr/catalogo-externo.md` (en adelante, «el ADR»).
Fecha: 2026-11-18.

Este documento describe pantallas, estados y flujos. No decide nada que el ADR deje pendiente: donde
el diseño depende de un ADR abierto, se marca **[depende de ADR-NN]** y la decisión va a §4.

---

## 0. Puntos de partida

### 0.1 Reglas que el diseño respeta

- **El stock nunca decide visibilidad; la curaduría nunca escribe stock** (ADR §0). Ninguna pantalla
  de este documento escribe `BranchInventory`. Los modales de stock (`StockAdjustmentModal`,
  `MoveStockModal`) se usan como **referencia de forma** (estructura del modal, `BranchPicker`, pie de
  acciones), no como componentes a reutilizar: son los que escriben stock.
- **Supuesto de trabajo: catálogo global** (ADR-01 pendiente). Una sola URL pública; las sucursales
  aparecen como etiqueta.
- **Sin rediseño.** Se usan las piezas del front actual: banda `brand-gradient`, hoja `glass`,
  tarjetas `glass` / `glass-strong`, botones `btn btn-*`, `PageHeader`, `ActionCard`,
  `OptionsMenuModal`, `Spinner` + esqueletos, `Reveal`, tonos de `src/lib/status-tones.ts`.
  Del `STYLE.md` se toma la parte del sistema propio (Botones, Marca, Tonos, Tablas en celular,
  Modales, Encabezado, Carga, Listas, Badges, Movimiento). El bloque inicial con tokens de Airbnb
  (Rausch `#ff385c`, Cereal) **no** se usa: el propio `STYLE.md` lo declara legado.
- **Plan free**: miniatura en la grilla, foto grande solo en la ficha, máximo 4 fotos, redimensionado
  en el navegador, sin transformaciones del lado del servidor.
- **Lectura por la vista `catalog_public`** (ADR-13), desde un Server Component. Nada de Server
  Actions públicas para leer (ADR §5.3).

### 0.2 Errores del portal actual que no se repiten

Observados en `src/app/sucursal/[branchId]/inventory/page.tsx` y
`src/lib/components/ExternalInventoryTable.tsx`:

| Hoy | Problema | En el catálogo |
|---|---|---|
| `export const dynamic = 'force-dynamic'` (`page.tsx:11`) | Cada visita consulta la base y gasta transferencia | ISR + `revalidateTag('catalog')` (ADR-09) |
| Muestra `{stock} uds` (`ExternalInventoryTable.tsx:170-172`, `:215-217`) | Expone volumen de negocio y se desactualiza | Solo «Disponible» / «Consultar» |
| Publica movimientos desde el último control (`:62-89`) | Dato operativo interno | No existe en el catálogo |
| Precio con `toFixed(2)` (`:174`, `:219`) → `$1500.00` | Sin formato local | `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` |
| `key={item.code}` y búsqueda «por código» (`:123-124`, `:159`) | El código es editable e interno (ADR-12) | Identidad por `product_id`; búsqueda por título |
| Visibilidad = `stock > 0` (`inventory.external.ts:35-55`) | Un agotado desaparece | Visibilidad = `CatalogItem.visible` |
| Tabla en escritorio | Un catálogo vende con foto | Grilla de tarjetas con miniatura en todos los anchos |
| Título «Inventario de la sucursal» | Lenguaje de inventario, no de vidriera | «Catálogo» + nombre comercial (pregunta 1) |
| Vacío: «No hay productos en el inventario de esta sucursal» | Habla del inventario | «Todavía no hay productos publicados» |

---

## 1. Página pública del catálogo

### 1.1 Rutas

| Ruta | Qué es | Render |
|---|---|---|
| `/catalogo` | Grilla | Server Component, ISR, `loading.tsx` con banda + hoja + esqueletos |
| `/catalogo/[productId]` | Ficha | Server Component, ISR; `notFound()` idéntico para inexistente, oculto o inactivo (no filtra existencia, igual que el portal) |

- `productId` es `Product.id` (ADR-12): estable, no editable. Ver pregunta 12 sobre si conviene un
  `slug`.
- Anónimas: el proxy suma **solo** el prefijo exacto `/catalogo` (ADR §5.1). Consecuencia de diseño:
  **ninguna pantalla de administración puede vivir bajo `/catalogo`** (por ejemplo
  `/catalogo-admin` también empezaría con `/catalogo`). La curaduría vive en `/inventario/catalogo`
  (§2.1), que el proxy ya protege.
- `BottomNav` se oculta en `/catalogo` igual que en `/sucursal/` (`BottomNav.tsx:54-60`). El
  catálogo no tiene navegación interna ni acciones de cuenta.

### 1.2 Grilla (`/catalogo`)

Celular (< `md`), de arriba hacia abajo:

```text
┌──────────────────────────────┐  banda brand-gradient
│ ┌──────────────────────────┐ │
│ │ CATÁLOGO                 │ │  glass-strong, como el portal
│ │ <Nombre comercial>       │ │  (pregunta 1)
│ └──────────────────────────┘ │
├──────────────────────────────┤  hoja glass redondeada (-mt-12)
│ ┌──────────────────────────┐ │
│ │ 🔍 Buscar productos       │ │  glass-strong, input 44 px
│ └──────────────────────────┘ │
│ [Todas] [Tazas] [Velas] [...]→  chips de categoría, scroll propio
│                              │
│ ┌───────────┐ ┌───────────┐  │  grilla 2 columnas
│ │  miniatura│ │  miniatura│  │  1:1, rounded-2xl
│ │ ★Destacado│ │           │  │
│ └───────────┘ └───────────┘  │
│ Taza cerámica  Vela de soja   │  título, 2 líneas máx.
│ $ 4.500        $ 2.800        │  precio
│ ● Disponible   ○ Consultar    │  badge con palabra
│ En Centro y                   │  etiqueta de sucursales
│ Norte                         │
└──────────────────────────────┘
```

- **Columnas**: 2 en celular, 3 desde `md`, 4 desde `lg`. Al achicar se quitan columnas, nunca se
  reacomodan filas (`STYLE.md`, Responsive). Gutter 12–16 px.
- **Tarjeta**: toda la tarjeta es un enlace a la ficha (target táctil completo). Columna de texto con
  `min-w-0`; título con `line-clamp-2` y `break-words` (`STYLE.md`, Listas en celulares chicos).
  Superficie `glass` (está sobre la hoja con degradé detrás). Aparición con `Reveal` en cascada.
- **Miniatura**: archivo de ~480 px (ADR §2), `<img loading="lazy" decoding="async">` con
  `width`/`height` fijos para no saltar el layout. Solo la primera fila sin `lazy`. **No** se usa el
  optimizador de `next/image`: transformaría la imagen del lado del servidor (Vercel), que es justo
  lo que el brief excluye. Sin foto: placeholder `bg-surface-strong` con ícono y texto «Sin foto»
  (no solo ícono).
- **Destacado**: badge «Destacado» arriba a la izquierda de la miniatura y los destacados primero en
  el orden (§2.5). Sin carrusel ni fila aparte (pregunta 9).
- **Buscador**: filtra por título en el cliente sobre la lista ya cargada (como hoy). No usa
  `searchParams`: leerlos vuelve dinámica la página y anula el ISR.
- **Chips de categoría**: `btn btn-sm` y el elegido `btn btn-active`; «Todas» primero; solo
  categorías con al menos un producto publicado. Si no hay categorías, la fila no se muestra.
- **Sin paginación en v1**: el listado completo viaja como datos (texto); las imágenes son lo caro y
  ya cargan perezosas. Si el catálogo pasa de ~300 productos, se agrega «Ver más» del lado del
  cliente (pregunta 10).
- **Estados**:
  - Cargando: `loading.tsx` con banda, hoja, `Spinner` y esqueletos de tarjeta en grilla.
  - Catálogo vacío: «Todavía no hay productos publicados.»
  - Búsqueda sin resultados: `role="status"`, «No encontramos productos para "<texto>"» + botón
    `btn btn-ghost` «Limpiar búsqueda».
  - Error en la primera carga: `error.tsx` con `role="alert"` y el par `#ffe4ea` / `#8f0020`. Si
    falla una revalidación, ISR sigue sirviendo la última versión buena.

### 1.3 Etiqueta de sucursales y estado de disponibilidad

La vista ya calcula `branches` (solo sucursales **nombrables y con stock > 0**) y `available`
(ADR §3.1). Eso deja **dos estados**, no tres:

| `branches` | Badge | Etiqueta en la grilla | En la ficha |
|---|---|---|---|
| 1 | **Disponible** | «En Centro» | «Disponible en: Centro» |
| 2 | **Disponible** | «En Centro y Norte» | Lista de las dos |
| 3 o más | **Disponible** | «En 3 sucursales» | Lista completa |
| 0 | **Consultar** | (sin etiqueta) | «Consultá disponibilidad» + acción de contacto (pregunta 3) |

- El estado nunca va solo por color: el badge lleva siempre su palabra (`STYLE.md`, Badges).
- Tonos: «Disponible» y «Consultar» son badges **nuevos**. Se agregan a `status-tones.ts` con su
  test y contraste medido (≥ 4,5:1 para texto de 11–12 px), con fondos distintos de los tres que ya
  existen. Propuesta de punto de partida, a medir: «Disponible» con texto `#15803d` (ya verificado
  en `STYLE.md` sobre claro) y «Consultar» neutro, distinto de «Inactiva».
- «Consultar» **no** dice «Agotado»: puede haber stock en una sucursal que no se quiere nombrar
  (allow-list, ADR-05). Decir «agotado» sería falso en ese caso. **[depende de ADR-03]**
- Nombres de sucursal con `break-words`; nunca dirección, teléfono ni email (ADR-06).

### 1.4 Ficha (`/catalogo/[productId]`)

Celular:

```text
┌──────────────────────────────┐
│ ← Catálogo                   │  btn btn-icon btn-round + texto
├──────────────────────────────┤
│ ┌──────────────────────────┐ │  galería: scroll-snap horizontal
│ │                          │ │  foto de ficha (~1600 px)
│ │        foto 1/3          │ │
│ └──────────────────────────┘ │
│            ● ○ ○             │  indicador + «1 de 3» accesible
│ Taza cerámica 350 ml         │  título
│ $ 4.500                      │  precio
│ [● Disponible]               │
│ Disponible en: Centro, Norte │
│ Categoría: Tazas             │
│ <descripción>                │  (pregunta 5)
│ ┌──────────────────────────┐ │
│ │   Consultar por este     │ │  btn btn-primary, única acción
│ │   producto               │ │  (pregunta 3)
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Desde `md`: dos columnas (galería a la izquierda con miniaturas debajo; datos y acción a la
  derecha, `md:sticky md:top-4`), el mismo patrón que los modales de dos columnas.
- **Galería**: CSS `scroll-snap` sin librería. Solo la foto 1 se carga de entrada; las otras con
  `loading="lazy"` (verificar en implementación que el navegador difiere imágenes dentro de un
  contenedor con scroll horizontal; si no, cargar la foto N al llegar a ella). Con una sola foto no
  hay indicador; sin fotos, el mismo placeholder de la grilla en grande.
- `alt` de cada foto: el `alt` guardado o, si falta, «<título> — foto N de M».
- Producto oculto, inexistente o inactivo: `notFound()` igual en los tres casos.

### 1.5 Qué NO se muestra nunca

En ninguna de las dos páginas, ni en el HTML ni en los datos que viajan al cliente:

- Cantidad de stock, ni siquiera «pocas unidades».
- Sucursales sin fila en `CatalogItemBranch`, ni sucursales nombrables sin stock.
- Costo, movimientos, fechas de control, `updatedAt`, `performedBy`.
- Emails, `authUserId`, dirección o teléfono de sucursal (ADR-06).
- `Product.code` **[pendiente, pregunta 4]**.
- Productos con `visible = false` o `active = false`.
- Ningún enlace a pantallas internas ni al login.

---

## 2. Administración de curaduría

### 2.1 Dónde vive

**Página nueva `/inventario/catalogo`**, hermana de `/inventario/inactivos`:

- Ya queda protegida por el proxy (no empieza con `/catalogo` ni con `/sucursal/`) y la pestaña
  «Inventario» del `BottomNav` queda activa por `startsWith`.
- Cada lectura y mutación con `requireAdmin` (una redirección del proxy no autoriza mutaciones).
- **Acceso**: ítem «Catálogo público» en `menuItems` del `PageHeader` de `/inventario` (celular) y en
  `actions` (escritorio). No se agrega una tercera `ActionCard` a la banda de `/inventario`: hoy hay
  dos y quedaría 2+1, que `STYLE.md` prohíbe.
- **No se toca `InventarioCard` en v1**: su fila de tres botones ya está al límite de ancho. Un badge
  «En catálogo» en la card es una mejora posterior (pregunta 8).

Por qué no «desde la card de producto»: la curaduría necesita ver el conjunto (qué está publicado,
qué falta, el orden). Producto por producto desde la card de inventario no da esa vista.

### 2.2 Lista de curaduría

```text
┌──────────────────────────────┐
│ ☰  Catálogo público          │  PageHeader
├──────────────────────────────┤
│ [Publicados 24][Ocultos 3]   │  segmentado btn-active
│ [Sin publicar 112]           │
│ 🔍 Buscar por nombre o código │  acá sí hay código: es interno
│ ┌──────────────────────────┐ │
│ │ ▣ Taza cerámica   $4.500 │ │  glass; miniatura 56 px
│ │   T-0012                 │ │
│ │   [Publicado][Destacado] │ │  badges con palabra
│ │   2/4 fotos · Centro,    │ │
│ │   Norte                  │ │
│ │   ⚠ Sin sucursales: se   │ │  aviso en #b45309
│ │     verá como «Consultar»│ │
│ │ [Editar ficha] [Ocultar] │ │  secondary / ghost
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- **Fuente de datos**: `getProductsWithBranchStock()` ya trae producto, categoría e inventario por
  sucursal (ADR §1); falta sumar la ficha y las fotos.
- **Tres segmentos**: «Publicados» (`visible = true`), «Ocultos» (con ficha y `visible = false`: la
  curaduría se conserva), «Sin publicar» (sin `CatalogItem`). Solo productos `active`.
- **Avisos por tarjeta**, en ámbar `#b45309` con su texto, nunca solo ícono:
  - «Sin sucursales nombradas: se verá como "Consultar"» (consecuencia del allow-list).
  - «Sin fotos».
  - «Ninguna sucursal nombrada tiene stock hoy: se ve como "Consultar"» (informativo).
- **Acción rápida**: «Publicar» / «Ocultar» directamente desde la tarjeta, sin abrir la ficha.
  Publicar por primera vez crea la ficha con `visible = true` y **sin sucursales** (allow-list: nada
  se nombra solo), por eso aparece el aviso. Ocultar no pide confirmación (es reversible); se informa
  con el toast habitual.
- Estados: `Spinner` + esqueletos al cargar; vacío por segmento («No hay productos ocultos»); error
  con `role="alert"`.

### 2.3 Ficha de curaduría (modal)

Se abre con «Editar ficha». Modal, como el resto del sistema, siguiendo «Modales en escritorio»:

- Celular: una columna en este orden: **Vista previa → Fotos → Publicación → Sucursales → Guardar**.
- Desde `md`: dos columnas; izquierda Fotos + Sucursales (lo que se opera), derecha Vista previa +
  Publicación + «Guardar» (`md:sticky md:top-4`).
- Tarjetas internas con `bg-[#f7f7f7] border border-black/10` (no `glass` dentro de un modal).

Bloques:

1. **Vista previa**: la tarjeta pública tal como se verá hoy (miniatura de portada, título, precio,
   badge y etiqueta calculados con las reglas de §1.3). Es la forma más directa de entender el
   allow-list sin explicarlo.
2. **Fotos**: §3. Se guardan al subirlas, no con «Guardar»; el bloque lo dice en una línea.
3. **Publicación**:
   - Interruptor «Visible en el catálogo».
   - Interruptor «Destacado».
   - «Título comercial» (opcional), con `placeholder` = nombre del producto y la ayuda «Si lo dejás
     vacío se usa el nombre del producto».
4. **Sucursales que se pueden nombrar**: tarjetas seleccionables, una por sucursal activa, con
   `aria-pressed` y el anillo de marca de `BranchPicker`. Cada tarjeta muestra al admin si esa
   sucursal tiene stock hoy («Con stock» / «Sin stock», sin cantidad: no hace falta para decidir).
   Ayuda fija: «Solo se nombran las que elijas y, de esas, las que tengan stock.»
   - `BranchPicker` hoy es **de selección única** (`value: number | null`); ver §5, desacuerdo 6.
5. **Acción principal**: «Guardar» (`btn btn-primary`, única). «Cancelar» `btn btn-secondary`.
   Cerrar con cambios sin guardar pide confirmación.

Toda mutación de este modal llama a `revalidateTag('catalog')` para que el público lo vea (ADR-09).

### 2.4 Publicar y despublicar

| Acción | Dónde | Efecto en datos | Confirmación |
|---|---|---|---|
| Publicar (primera vez) | Tarjeta o modal | Crea `CatalogItem` con `visible = true`, sin sucursales | No |
| Ocultar | Tarjeta o modal | `visible = false`; se conservan sucursales, título, orden, destacado | No |
| Volver a publicar | Tarjeta o modal | `visible = true` con la curaduría previa | No |
| Quitar del catálogo (borrar la ficha) | — | No existe en v1: ocultar cubre el caso sin perder trabajo | — |

Producto desactivado (`active = false`): deja de verse aunque su ficha siga `visible` (lo hace la
vista). En la lista de curaduría no aparece; su ficha queda intacta si se reactiva.

### 2.5 Orden y destacados

- **Orden público**: destacados primero; después `sortOrder`; empate por título alfabético. El
  desempate es necesario porque la vista hace `coalesce(sort_order, 0)` y sin él todos los que no
  tienen orden empatan en 0 (orden indefinido entre visitas).
- **v1 sin orden manual en pantalla**: destacado + alfabético alcanza para una vidriera y evita
  construir reordenamiento (que en celular no puede ser arrastrar: tendría que ser «subir/bajar» por
  producto, muy lento con decenas de productos). `sortOrder` queda en el modelo sin UI hasta que se
  pida (pregunta 9).

### 2.6 Alta masiva

No en v1. Si la respuesta a la pregunta 7 es «publicar todo y después excepciones», se agrega una
acción «Publicar seleccionados» con casillas en el segmento «Sin publicar», con la misma regla: sin
sucursales hasta que se elijan.

---

## 3. Subida de fotos

### 3.1 Dónde

En el bloque **Fotos** del modal de curaduría (§2.3). Las fotos cuelgan de `Product` (ADR-12), así
que se pueden cargar antes de publicar. No se agregan a `ProductForm` ni al alta masiva en v1
(pregunta 6).

### 3.2 Forma

Grilla **2×2** de cuatro casilleros (cierra 2×2, regla de `STYLE.md`):

```text
┌───────────┐ ┌───────────┐
│  foto 1   │ │  foto 2   │
│ PORTADA   │ │           │
│ [←][→][✕] │ │ [←][→][✕] │
└───────────┘ └───────────┘
┌───────────┐ ┌───────────┐
│ ⟳ Subiendo│ │  ＋       │  casillero vacío = botón
│           │ │ Agregar   │
└───────────┘ └───────────┘
Fotos 3 de 4 · Se guardan al subirlas
```

- **Casillero 1 = portada**: es la miniatura de la grilla pública. Lleva la palabra «Portada».
- Casillero vacío: un `<label>` con `<input type="file" accept="image/*" multiple>`; en el celular
  ofrece cámara o galería. Solo el primer casillero vacío está activo, así no quedan huecos.
- Selección múltiple: entran hasta completar 4; si se eligen de más: «Solo entran N fotos más; se
  tomaron las primeras N.»
- Con 4 fotos no hay casillero vacío: «Llegaste al máximo de 4 fotos. Quitá una para cambiarla.»

### 3.3 Proceso de cada foto (en el navegador)

1. **Validar entrada**: tipo imagen y hasta **15 MB** de archivo original (pregunta 11). Rechazo
   inmediato con el motivo, sin subir nada.
2. **Redimensionar**: lado mayor 1600 px para la ficha y 480 px para la miniatura, WebP (ADR §2),
   respetando la orientación EXIF. Si la ficha supera ~400 KB, se reintenta con menor calidad.
3. **Pedir permiso de subida**: Server Action con `requireAdmin` que valida el límite de 4 en el
   servidor y devuelve URLs firmadas de subida con nombres con hash (ADR-08).
4. **Subir** los dos archivos directo al bucket con la URL firmada (no pasan por la Server Action,
   así no chocan con el límite de 1 MB del body).
5. **Confirmar**: Server Action que crea `ProductImage` con `bytes` y `revalidateTag('catalog')`.

Estados visibles por casillero:

| Estado | Qué ve el admin |
|---|---|
| Procesando | `Spinner` + «Optimizando…» |
| Subiendo | `Spinner` + «Subiendo…» (sin porcentaje en v1) |
| Lista | La miniatura y, en texto chico, el peso final («210 KB») |
| Error | Mensaje + «Reintentar» (`btn btn-secondary`) + «Descartar» |

Cerrar el modal con una subida en curso pide confirmación: «Hay fotos subiéndose. Si cerrás, se
pierden.»

### 3.4 Mensajes de error

| Causa | Mensaje |
|---|---|
| No es imagen | «Ese archivo no es una imagen.» |
| Más de 15 MB | «La foto pesa más de 15 MB. Probá con otra.» |
| No se puede leer (por ejemplo HEIC en un navegador que no lo abre) | «No pudimos abrir esta foto. Probá sacarla de nuevo o guardarla como JPG.» |
| Red caída o subida interrumpida | «No se pudo subir. Revisá la conexión.» + Reintentar |
| Ya hay 4 (otra pestaña o dispositivo subió en el medio) | «Este producto ya tiene 4 fotos.» |
| Sesión vencida | Redirección al login, como el resto del sistema |
| Almacenamiento lleno (1 GB del plan) | «No hay más espacio para fotos. Avisá al administrador.» |

Todos con `role="alert"` dentro del casillero, en `#c13515` (error de formulario).

### 3.5 Reordenar, portada y borrar

- **Reordenar**: botones «←» y «→» por foto (`btn btn-icon`, 44 px, con `aria-label` «Mover foto 2 a
  la izquierda»). Sin arrastrar: en celular es impreciso y no es accesible. El cambio se guarda en el
  momento.
- **Portada**: mover una foto al casillero 1 la hace portada; no hace falta un botón aparte.
- **Borrar**: «✕» abre la confirmación de SweetAlert con `btn-danger`: «¿Quitar esta foto? Se borra
  del almacenamiento y no se puede recuperar.» Al quitar, las siguientes se corren a la izquierda (no
  quedan huecos; si se quita la portada, la 2 pasa a ser portada).
- **Reemplazar** = quitar + agregar. Los nombres son inmutables (ADR §2.3), así que no existe
  «pisar» una foto.
- `alt`: se genera solo (§1.4) en v1; sin campo de edición (pregunta 6).

---

## 4. Preguntas abiertas para el dueño

Cada una bloquea solo lo que indica.

1. **Nombre comercial**: ¿qué nombre se muestra arriba del catálogo y en el título de la pestaña? Hoy
   el portal dice «Feria Conexx» en `metadata`. ¿Es el nombre que va?
2. **Precios** **[ADR-04]**: ¿se muestra el precio en el catálogo? Si un producto tiene precio 0,
   ¿se muestra «Consultar precio» o no se puede publicar?
3. **Canal de consulta** **[ADR-03, ADR-12]**: el botón «Consultar por este producto», ¿adónde lleva?
   ¿WhatsApp (a qué número: uno general o uno por sucursal), Instagram, o no hay botón y solo se
   informa?
4. **Código del producto**: ¿se muestra al público (sirve para que el cliente pregunte por «el
   T-0012») o es interno?
5. **Descripción**: ¿`Product.description` se puede mostrar al público tal como está hoy, o hay
   productos con notas internas en ese campo?
6. **Fotos**: ¿quién las saca y desde dónde (el celular del local, una compu)? ¿Hace falta subirlas
   también desde el alta o la edición del producto, o alcanza con la pantalla de catálogo? ¿Hace
   falta escribir un texto alternativo por foto?
7. **Forma de curar**: ¿se publica producto por producto, o «todo y después las excepciones»?
8. **Señal en inventario**: ¿quieren ver en la card de `/inventario` si el producto está en el
   catálogo, o alcanza con la pantalla aparte?
9. **Orden y destacados**: ¿alcanza con «destacados primero y después alfabético», o necesitan
   ordenar a mano? ¿Los destacados van mezclados al principio o en una fila propia arriba?
10. **Tamaño**: ¿cuántos productos se van a publicar al principio y en un año? Decide si hace falta
    «Ver más» y si 1 GB alcanza (ADR §2).
11. **Límite de archivo**: ¿15 MB por foto original está bien? (Fotos de celular de 48 MP pueden
    pasar los 10 MB.)
12. **URL**: ¿basta con un número (`/catalogo/154`), o quieren un nombre legible
    (`/catalogo/taza-ceramica-350`)? El número deja ver cuántos productos hay en total.
13. **Sucursales en la etiqueta** **[ADR-06, ADR-10]**: el nombre de la sucursal, ¿lleva enlace al
    portal `/sucursal/[id]/inventory` cuando es pública? Ese portal muestra cantidades de stock, que
    el catálogo esconde.
14. **Filtro por sucursal** **[ADR-01]**: ¿el cliente necesita filtrar «lo que hay en mi sucursal»,
    o alcanza con la etiqueta?
15. **Atraso aceptable**: con ISR, «Disponible» puede tardar unos minutos en pasar a «Consultar»
    después de una venta. ¿Cuánto atraso es aceptable (1, 5, 15 minutos)?
16. **Disponible sin decir dónde**: hoy, si no se nombra ninguna sucursal, el producto se ve siempre
    como «Consultar» aunque haya stock. ¿Está bien, o quieren poder decir «Disponible» sin nombrar
    sucursales?

---

## 5. Desacuerdos e inconsistencias detectadas

No se resuelven acá; se reportan para decidir.

1. **ADR-11(b) contra ADR-13.** ADR-11(b) dice que el catálogo **no puede** leer con la clave anónima
   y que la garantía tiene que ser una consulta del servidor con Prisma y `select` cerrado. ADR-13
   decide la vista con `grant select` a la vista (para `anon`, por la Data API). Si la página la lee
   un Server Component, el `grant` a `anon` no hace falta para la página: solo abre la vista a
   cualquiera por API. Falta decidir **quién** lee la vista (Prisma `$queryRaw` en el servidor o
   `supabase-js` con la clave anónima) y si el `grant` a `anon` se quiere de verdad.
2. **El mapa contradice a ADR-13.** `docs/adr/catalogo-externo-mapa.mmd` dice «opcion A vista SQL
   publica / opcion B consulta server only», pero en ADR-13 la A son grants sobre tablas, la B la
   vista y la C la consulta server-only. Además el mapa afirma «RLS sigue activo», que `AGENTS.md`
   §0.2 y ADR-11 dan como **no verificado**.
3. **La vista no trae las fotos.** `catalog_public` devuelve `photos` (cantidad), pero la grilla
   necesita la ruta de la portada y la ficha las rutas de las cuatro. Falta una segunda vista (por
   ejemplo de imágenes de productos publicados) o una columna con la portada, también con su `grant`
   acotado.
4. **`ProductImage` tiene una sola `path` para dos archivos.** El ADR pide ficha + miniatura (§2,
   ADR-08), pero el modelo guarda una ruta y un `bytes`. Hace falta decidir una convención de nombre
   (miniatura derivable de la ruta de la ficha) o una segunda columna; y `bytes`, ¿de cuál de los dos?
5. **La vista no expone lo que la etiqueta necesita para ADR-06.** Devuelve solo nombres de sucursal
   (`json_agg(b.name)`), sin `id` ni `isPublic`, así que no se puede armar el enlace al portal que
   recomienda ADR-06. Y filtra por `is_active` pero no por `is_public`, que ADR-06 deja abierto.
6. **`BranchPicker` es de selección única.** El brief lo propone para elegir sucursales nombrables,
   que es selección múltiple. Usarlo exige extender un componente compartido (lo usan venta, mover
   stock, caja, exportar) o hacer una variante; ninguna de las dos es «reutilizar» sin costo.
   `CategorySelector` también es de selección única y es un selector de formulario, no una fila de
   filtros; para los chips públicos no aplica.
7. **Los modales de stock como «reutilizables».** `StockAdjustmentModal` y `MoveStockModal` escriben
   stock. Reutilizarlos en curaduría choca con «la curaduría nunca escribe stock». Este diseño los toma
   solo como referencia de forma.
8. **ISR contra la regla «el stock no decide visibilidad».** La visibilidad no depende del stock,
   pero el badge sí. Las acciones de stock y de ventas no llaman a `revalidateTag('catalog')`, así que
   el badge se atrasa hasta el `revalidate`. Hacer que las ventas revaliden el catálogo **toca código
   de stock y ventas** (riesgo §0.4 de `AGENTS.md`). Ver pregunta 15.
9. **El ADR deja el diseño fuera de alcance hasta cerrar ADR-01 a 04** (§7), pero ADR-03 y ADR-04
   siguen pendientes. Este documento asume «publicar también agotados» y «precio sí, cantidades no»;
   si el dueño decide distinto, cambian §1.3 y §1.4.
10. **`@unique([productId, position])` y reordenar.** Intercambiar dos posiciones viola la unicidad a
    mitad de la operación salvo que se use una posición temporal o una restricción diferible. No es un
    problema de UX, pero condiciona el «←/→» de §3.5.
11. **Fotos huérfanas.** Si la subida al bucket funciona y la confirmación (crear `ProductImage`)
    falla, queda un archivo sin fila que consume el 1 GB. Igual al revés al borrar. El ADR no define
    limpieza.
12. **Redimensionado en Safari.** Algunas versiones de Safari no codifican WebP desde `canvas` y
    devuelven PNG. Hace falta verificar y, si aplica, caer a JPEG; si no, una «miniatura» PNG puede
    pesar más que la foto que reemplaza.
