# ADR — Catálogo externo público

Estado: **borrador de plan, ninguna decisión tomada**. Hay decisiones que dependen del cliente y no se
pueden cerrar acá. Este documento es el insumo para esa conversación y para el posterior documento ODD.

Fecha: 2026-08-27. Autor: sesión de arquitectura con el dueño del producto.

---

## 0. El problema arquitectónico real

Hoy el sistema mezcla tres cosas distintas en los mismos campos:

| Capa | Pregunta que responde | Dónde vive hoy |
|---|---|---|
| **Existencias** | ¿Dónde hay stock y cuánto? | `BranchInventory` (`prisma/schema.prisma:78`) |
| **Publicación** | ¿Qué queremos que el mundo vea? | `Branch.isPublic` (`prisma/schema.prisma:39`) |
| **Presentación** | ¿Cómo lo contamos? | nada: se deriva de las otras dos |

Un catálogo global curado rompe esa mezcla, porque necesita publicar **por producto** (capa 2) y
nombrar sucursales **por producto** (capa 3), y ninguna de las dos es consecuencia del stock ni de si
la sucursal es pública.

Por eso la regla que ordena todo el diseño:

> **El stock nunca decide visibilidad. La curaduría nunca escribe stock.**

Si `stock > 0` fuera el criterio de publicación, no se podría mostrar un producto agotado, que es
justamente lo que un catálogo quiere mostrar para que el cliente pregunte. Y si publicar tocara
`BranchInventory`, una operación de inventario podría despublicar mercadería sin que nadie lo pida.

---

## 1. Estado actual observado

Verificado en el repo, con evidencia:

- **Ya existe un catálogo público, pero es por sucursal y sin curaduría**: `/sucursal/[branchId]/inventory`
  (`src/app/sucursal/[branchId]/inventory/page.tsx:11`, `dynamic = 'force-dynamic'`).
- Ese portal se habilita con `Branch.isPublic` + `isActive`, chequeado en el servidor
  (`src/app/actions/inventory.external.ts:25-32` y `:96-115`).
- Su consulta filtra `product.active = true` **y** `inventory.some({ branchId, stock: { gt: 0 } })`
  (`inventory.external.ts:35-55`): la visibilidad hoy **es** el stock. Devuelve
  `{code, name, stock, price, updatedAt}`, sin categoría y sin imagen (`:57-70`).
- **No existe ninguna foto en el sistema**: ni columna en `Product` (`prisma/schema.prisma:11-22`), ni
  bucket, ni código de `supabase.storage`. Cero.
- **No hay pipeline de imágenes**: `next.config.ts:3-6` solo tiene `reactCompiler`. Sin `images`
  (`remotePatterns`), sin `serverActions.bodySizeLimit`.
- **Hay clientes con service role disponibles**: `createServiceClient()`
  (`src/lib/supabase/server.ts:60-66`) y `createAdminClient()` (`src/lib/supabase/admin.ts:7-12`).
  Hoy solo los usa `src/app/actions/branch.ts:58,245` para alta/baja de usuarios de auth.
- **No hay caché de catálogo**: ningún `unstable_cache` en `src/`, y `revalidatePath` nunca apunta a
  `/sucursal` ni a un catálogo (`inventory.ts:200-203`, `product.ts:349-351`, `branch.ts:86,169-170`).
- **El acceso anónimo se permite solo a `/sucursal/`** (`src/proxy.ts:51-58`); todo lo demás exige
  sesión. Un catálogo nuevo toca esa frontera.
- **La pantalla de curaduría ya tiene los datos**: `getProductsWithBranchStock()`
  (`src/app/actions/inventory.ts:238`, `requireAdmin()` en `:240`) devuelve producto completo,
  categoría e inventario por sucursal con `branch {id, name}` (`:267-278`). Le falta solo la foto.
- El precio **es global al producto** (`Product.price`, `schema.prisma:18`), no por sucursal.

---

## 2. Límites del plan free de Supabase (restricción dura)

Datos de la documentación y el pricing vigente: **500 MB de base, 1 GB de archivos, 10 GB de
transferencia** (5 GB sin caché + 5 GB cacheado), 2 proyectos activos, y **el proyecto se pausa tras
una semana de inactividad**.

Consecuencia directa: el catálogo no es un problema de base de datos, es un problema de **bytes de
imagen**. Dos techos separados, y el segundo llega antes:

### Techo de almacenamiento (1 GB)

Supuesto: foto de ficha subida ya redimensionada a ~1600 px WebP q80 ≈ **200 KB**, más su miniatura
de ~480 px WebP q75 ≈ **25 KB**.

| Fotos por producto | Peso por producto | Productos que entran en 1 GB |
|---|---|---|
| 1 | ~225 KB | ~4.500 |
| 2 | ~450 KB | ~2.200 |
| 3 | ~675 KB | ~1.500 |
| 4 (el máximo pedido) | ~900 KB | **~1.100** |

### Techo de transferencia (10 GB/mes)

| Escenario | Bytes por visita | Visitas/mes que aguanta |
|---|---|---|
| Grilla de 24 productos **con miniaturas** | ~600 KB | ~16.000 |
| Grilla de 24 productos **con la foto grande** | ~4,8 MB | ~2.000 |

Ocho veces más tráfico usando miniaturas. Eso no es una optimización: es la diferencia entre que el
catálogo funcione o se corte a mitad de mes.

### Reglas que salen de esos números

1. **Nunca se sube la foto original del celular** (3–5 MB). Se redimensiona en el navegador antes de
   subir. Si no, una sola foto rompe además el límite de 1 MB del body de las Server Actions, que hoy
   no está configurado (`next.config.ts`).
2. **Miniatura para la grilla, foto grande solo en la ficha.** Sin excepciones.
3. **Nombres inmutables + `cache-control: 1 año`**: así las repeticiones pegan en el CDN y consumen
   los 5 GB cacheados, no los otros 5.
4. **Las transformaciones de imagen al vuelo de Supabase son de plan Pro** (verificar en la doc antes
   de diseñar sobre esto). En free: el archivo ya se guarda en el tamaño final.
5. **Disparador para revisar la decisión**: pasar de ~1.000 productos fotografiados, o acercarse a los
   10 GB de transferencia, o que la pausa por inactividad sea un riesgo aceptable. Ahí toca Pro o
   mover las imágenes a un CDN externo. No antes: pagar por adelantado no compra nada.

---

## 3. Modelo de datos propuesto (sujeto a ADR-02)

```text
CatalogItem                    -- grano: producto publicado en el catálogo
  productId      @unique       -- una ficha por producto
  visible        Boolean       -- despublicar sin perder la curaduría
  featured       Boolean       -- destacados
  sortOrder      Int?
  title?         String?       -- título comercial; si falta, Product.name

CatalogItemBranch              -- grano: qué sucursales puedo nombrar de ese producto
  catalogItemId
  branchId
  @unique([catalogItemId, branchId])

ProductImage                   -- grano: foto
  productId
  position       Int           -- 0..3, único por producto
  path           String        -- ruta en el bucket, no URL completa
  alt?           String?
  bytes          Int
  @unique([productId, position])
```

### Las dos reglas que hacen que esto funcione

**Regla de existencia + etiqueta.** Una sucursal se nombra en la tarjeta si y solo si
`CatalogItemBranch` la permite **y** esa sucursal tiene stock > 0 hoy. La curaduría es un
**allow-list**: si querés que no se sepa que el producto está en la sucursal X, no existe la fila. El
stock no agrega sucursales por su cuenta, así que una sucursal nueva nunca aparece sola.

**Regla de reversibilidad.** `CatalogItemBranch` ya tiene la sucursal adentro, así que el ADR-01
(catálogo global vs por sucursal) es **una decisión de ruta y consulta, no de migración**. Se puede
cambiar de opinión sin tocar la base. Ese es el argumento más fuerte para elegir este modelo y no los
flags en `BranchInventory`.

### Por qué no alcanza con dos columnas nuevas

La alternativa barata es `BranchInventory.published` + `BranchInventory.showLabel`. Cuesta dos
columnas, pero: (a) mezcla curaduría con existencias, que es lo que este documento intenta separar;
(b) un producto sin fila de inventario en ninguna sucursal no tiene dónde colgar el flag, y no se
puede publicar; (c) cualquier proceso que recree filas de inventario se lleva puesta la curaduría.

---

### 3.1 Escalado del modelo: campos, restricciones, índices y consulta de lectura

Diagramas: `docs/adr/catalogo-externo-er.mmd` (modelo) y `docs/adr/catalogo-externo-mapa.mmd` (capas).

**Restricciones que sostienen las reglas**

- `CatalogItem.productId` **único**: una ficha por producto. Si un producto debe aparecer en dos secciones, eso se resuelve con `featured` o con categoría, no duplicando la ficha.
- `CatalogItemBranch` único en `(catalogItemId, branchId)`.
- `ProductImage` único en `(productId, position)`. El rango `0..3` se valida en Zod; si se quiere garantizar en la base, hace falta un `CHECK` que Prisma no genera solo.
- **Borrados en cascada**: `ProductImage` y `CatalogItem` caen con el `Product`; `CatalogItemBranch` cae con la ficha **y también con la sucursal**, así no quedan etiquetas huérfanas apuntando a una sucursal borrada.

**Índices**

- `CatalogItem(visible, sortOrder)`: es el orden del listado.
- `CatalogItemBranch(catalogItemId)` y `(branchId)`.
- `ProductImage(productId, position)`.
- `BranchInventory` **no necesita nada nuevo**: ya tiene `@@unique([branchId, productId])` e índices por ambas columnas (`prisma/schema.prisma:87-90`), que es exactamente lo que usa el join por stock.

**Consulta de lectura** (bosquejo, no es una migración; hay que probarla contra el esquema real)

```sql
create view catalog_public as
select
  p.id                             as product_id,
  coalesce(ci.title, p.name)       as title,
  p.description,
  p.price,
  cat.name                         as category,
  ci.featured,
  coalesce(ci.sort_order, 0)       as sort_order,
  coalesce(lb.branches, '[]'::json) as branches,
  coalesce(lb.available, false)    as available,
  (select count(*) from product_image pi where pi.product_id = p.id) as photos
from catalog_item ci
join product p          on p.id = ci.product_id
left join category cat  on cat.id = p.category_id
left join lateral (
  select json_agg(b.name order by b.name) as branches, true as available
    from catalog_item_branch cib
    join branch b           on b.id = cib.branch_id
    join branch_inventory bi on bi.branch_id = b.id and bi.product_id = p.id
   where cib.catalog_item_id = ci.id
     and b.is_active
     and bi.stock > 0
  having count(*) > 0
) lb on true
where ci.visible = true and p.active = true;
```

Dos detalles que la consulta ya resuelve bien y conviene no perder de vista: `available` se calcula **solo sobre las sucursales nombradas**, no sobre cualquier sucursal (si no, un producto disponible únicamente en una sucursal oculta se mostraría como disponible), y `branches` sale vacío cuando no hay ninguna, que es un estado válido y visible («consultar disponibilidad»).

### 3.2 ¿Esto reemplaza al stock? No: lo lee

`CatalogItem` y `CatalogItemBranch` **no tienen clave foránea a `BranchInventory`** y no escriben una sola fila de stock. Son una capa de curaduría **al lado** de las existencias, unida recién al leer. Consecuencias concretas:

- Un ajuste de stock no puede despublicar un producto ni borrar una etiqueta.
- Un producto sin ninguna fila de inventario **sí se puede publicar** (no tiene dónde colgar un flag si la curaduría viviera en `BranchInventory`).
- El mismo modelo sirve para catálogo global y para catálogo por sucursal: es filtrar `catalog_item_branch` por sucursal.

## 4. ADRs pendientes

Cada uno con estado, opciones, recomendación y qué lo daría vuelta. Ninguno está decidido.

### ADR-01 — Alcance del catálogo: global o por sucursal
**Estado: pendiente. Requiere conversación con el cliente.** Es el que pidió anotar.
- **Global (recomendado)**: una sola URL pública, un solo conjunto de productos, las sucursales
  aparecen como etiqueta. Coincide con el precio, que ya es global al producto.
- **Por sucursal**: replica el portal actual y multiplica la curaduría por sucursal; con 4 sucursales
  es curar 4 veces lo mismo.
- **Global con filtro por sucursal**: el global más un filtro; no cambia el modelo, es UI.
- **Qué lo daría vuelta**: que el cliente quiera precios u ofertas distintas por sucursal. Eso obliga
  a mover el precio a la sucursal y rompe la premisa global.

### ADR-02 — Grano de la curaduría: tabla propia o flags en `BranchInventory`
**Estado: pendiente.** Recomendación: `CatalogItem` + `CatalogItemBranch` (§3). Lo daría vuelta solo
un requisito explícito de "publicar es lo mismo que tener stock".

### ADR-03 — Qué significa "publicado": solo con stock, o también agotados
**Estado: pendiente, decisión de producto.** Hoy el portal oculta todo lo que no tiene stock
(`inventory.external.ts:35-55`). Un catálogo comercial suele querer lo contrario: mostrarlo con un
"consultar reposición". **Recomendación**: publicar sin importar el stock; que la tarjeta muestre
"Disponible" o "Consultar" según haya stock en las sucursales nombradas.

### ADR-04 — ¿Se muestran precios y cantidades de stock?
**Estado: pendiente, decisión de producto.** Recomendación: precio sí (es global), **cantidades no**.
Un número de stock en un catálogo se desactualiza solo y expone volumen de negocio.

### ADR-05 — Allow-list o deny-list de sucursales por producto
**Estado: pendiente.** Recomendación: **allow-list** (fila existente = se puede nombrar). La
deny-list parece más barata, pero hace que una sucursal nueva aparezca sola en productos viejos.

### ADR-06 — Qué datos de sucursal se exponen y con qué permiso
**Estado: pendiente, decisión de producto y de privacidad.** ¿Solo el nombre? ¿Dirección y teléfono?
¿La etiqueta respeta `isPublic` además de `isActive`? Recomendación: nombre + link al portal de esa
sucursal si `isPublic`, nada más; el resto se agrega cuando el cliente lo pida por escrito.

### ADR-07 — 4 fotos: tabla `ProductImage` o cuatro columnas en `Product`
**Estado: pendiente.** Recomendación: tabla. Las columnas `image1..image4` ahorran un join y pierden
orden explícito, `alt` por foto y el día que quieran 6 fotos.

### ADR-08 — Pipeline y almacenamiento de imágenes
**Estado: pendiente.** Recomendación: bucket `product-images` de lectura pública y escritura **solo**
por URL firmada emitida por una Server Action con `requireAdmin`; redimensionado en el navegador;
dos tamaños (ficha + miniatura); nombres con hash e inmutables. Lo daría vuelta: la verificación de
RLS en el entorno real, que hoy está pendiente y no se puede suponer.

### ADR-09 — Entrega y caché de la página
**Estado: pendiente.** El portal actual es `force-dynamic` (`page.tsx:11`). Recomendación para el
catálogo: ISR con `revalidate` corto + `revalidateTag('catalog')` desde las acciones de curaduría.
`force-dynamic` en un catálogo público es justo lo que gasta transferencia sin necesidad.

### ADR-10 — Convivencia con el portal por sucursal
**Estado: pendiente.** ¿`/sucursal/[branchId]/inventory` se retira, se mantiene, o el catálogo global
lo absorbe? Mantener los dos significa dos caminos públicos que pueden contradecirse (uno muestra
stock 0, el otro no).

### ADR-11 — Riesgos aceptados del plan free
**Estado: riesgo registrado, no decidido.** (a) El proyecto se pausa tras una semana sin actividad: un
catálogo con tráfico lo evita, uno vacío lo acelera. (b) **RLS y permisos de la Data API no están
verificados en el entorno real** (`AGENTS.md` §0.2): por eso el catálogo **no puede** leer desde el
navegador con la clave anónima. La garantía tiene que ser la consulta del servidor con Prisma, en un
módulo dedicado, con un `select` cerrado a campos públicos.

---

### ADR-12 — Catálogo vidriera hoy, ecommerce en el futuro
**Estado: decidido por el dueño (2026-08-27).** Hoy el catálogo **no** termina en un pedido: es vidriera. La dirección declarada es que en el futuro sí sea ecommerce, así que el modelo no debe cerrar esa puerta, sin construirla ahora.

Lo que **sí** se prepara desde el día uno, porque es gratis o casi:

- **Identificador estable en la URL**: no usar `Product.code` como identificador público. El código es editable (prefijo + número) y si alguien lo cambia, todos los links compartidos mueren. Usar `Product.id` o un `slug` propio que no se edite.
- **Precio como número, no como texto formateado**: el día que haya carrito, el importe tiene que ser operable.
- **Fotos por producto, no por publicación**: `ProductImage` cuelga de `Product`, así el futuro pedido puede mostrarlas sin duplicar.
- **Una capa de consulta server-only reutilizable** (`src/lib/catalog/queries.ts`), para que un módulo de pedidos lea el mismo catálogo en vez de tener su propia copia de la verdad.

Lo que **no** se construye ahora, para no pagar deuda especulativa: carrito, checkout, cuentas de cliente, pagos, reserva de stock, listas de precios, cupones. Todo eso toca dinero y merece su propio ODD cuando exista el requisito. La migración a ecommerce no requiere rediseñar el catálogo: solo agregar `Order`/`OrderItem` que referencien `Product.id`, que ya existe.

### ADR-13 — Cómo se expone la lectura pública: vista acotada o tablas abiertas
**Estado: DECIDIDO por el dueño (2026-08-27): opción (B), vista `catalog_public` con `grant select` solo a la vista; cero grants sobre las tablas.** En la conversación apareció la idea de hacer públicas las tablas de stock, “total es solo un `select`”. Registro del por qué se descartó:

- **(A) `grant select` a `anon` sobre `branch_inventory` y `product`.** Es lo más corto de escribir y lo más caro después:
  1. **La clave anónima es pública por diseño.** Viaja al navegador y cualquiera la extrae. La frontera no es la página, es el `grant`: con A, cualquiera puede consultar el stock de **todas** las sucursales, incluidas las que no son parte del catálogo.
  2. **La curaduría queda cosmética.** El filtro de la página es evitable consultando la tabla directamente, así que “ocultar que el producto está en esta sucursal” deja de tener garantía.
  3. **Una columna futura se publica sola.** Hoy `Product` no tiene costo, pero un ERP termina teniéndolo. Con grant sobre la tabla, agregar `cost` publica los márgenes en el mismo commit sin que nadie lo note.
  4. **RLS no está verificado en producción** (`AGENTS.md` §0.2). Sumar una policy no certifica el resto del esquema.
- **(B) Vista `catalog_public` con `grant select` solo a la vista (recomendado).** Sigue siendo “solo un `select`”, pero acotado a filas y columnas curadas: el objeto expuesto es un contrato explícito, no la tabla.
  - Trampa concreta: **no** usar `security_invoker = true`. Esa opción hace que la vista corra con los permisos de quien consulta, obliga a dar grant sobre las tablas y anula toda la ventaja. Para este caso la vista tiene que correr con los permisos de su dueño (el default).
- **(C) Consulta server-only con Prisma, nada público en la Data API.** Es la más cerrada y la más lenta de iterar; sirve si se prefiere que la Data API no exponga nada nuevo.

Si igual se eligiera A, habría que verificar RLS activo en cada tabla, con una policy por objeto, y aceptar por escrito que toda sucursal oculta es descubrible por API.

## 5. Fronteras de seguridad del cambio

1. **Ruta pública nueva**: hay que sumarla a la allowlist anónima de `src/proxy.ts:51-58`. Es una
   frontera de confianza: se agrega el prefijo exacto (`/catalogo`), nunca un comodín.
2. **Consulta dedicada, no reuso**: el catálogo no puede usar `getExternalBranchInventory` (filtra
   stock y no trae categoría ni imagen) ni `getProductsWithBranchStock` (exige `requireAdmin`).
   Propuesta: módulo `src/lib/catalog/queries.ts` server-only con `select` explícito.
3. **Lectura, no acción**: la página lee desde un Server Component. No exponer una Server Action
   pública (son endpoints POST) para leer datos.
4. **Imágenes**: bucket público para leer (el catálogo es público), escritura solo con URL firmada
   emitida tras `requireAdmin`. Nunca `SUPABASE_SERVICE_ROLE_KEY` en el cliente.
5. **Campos que jamás salen**: costo, stock exacto, `performedBy`, emails de sucursal, `authUserId`.

---

## 6. Preguntas para el cliente (bloquean ADR-01, 03, 04, 06)

1. ¿El catálogo muestra precios? ¿Y si mañana los precios fueran distintos por sucursal?
2. ¿Se muestran los productos agotados, o solo los que tienen stock?
3. ¿Qué se puede decir de una sucursal al público: nombre, dirección, teléfono, horario?
4. ¿Quién cura el catálogo y desde dónde: producto por producto, o todo de una y después excepciones?
5. ¿Cómo llega el cliente al catálogo: link de la página, QR, redes?
6. ¿El catálogo termina en un carrito/pedido, o es vidriera y el pedido se cierra por WhatsApp?
   (Si hay pedido, esto deja de ser catálogo y es otra arquitectura.)
7. **Cuántos productos activos hay hoy y cuántos se van a fotografiar**: es el número que decide si 1 GB
   alcanza (§2).
8. ¿Las fotos las saca el cliente con el celular, o las sube alguien del equipo?

---

## 8. Diseño de UI y reconciliación

**Actualización 2026-11-19 (decisión del dueño, ADR prendas §1cuater):** el catálogo público **es el
sitio web de Polkalina's** — un solo sitio, con el estilo de `polkalinas-html/web` adaptado sobre
los componentes del repo (`polkalinas-front.md` §5). Consecuencias sobre este ADR: ADR-01 (global)
queda resuelto de facto; la vidriera muestra **cuatro** estados (Disponible / Reservada / Vendida /
Consultar) con filtro «Ocultar vendidas», extendiendo los dos del diseño de §1.3 de
`catalogo-externo-diseno.md`; y la vidriera de Polkalina's **muestra etiquetas de sucursal** por
  prenda (decisión del dueño, 2026-11-19: allow-list de `CatalogItemBranch`, con «En Centro y Norte»;
  el footer suma el punto físico como los mockups) — `CatalogItemBranch` conserva su rol público.

El diseño de pantallas y flujos está en `docs/adr/catalogo-externo-diseno.md` (Claude, modo plan,
2026-11-18). Respeta el estilo actual sin rediseño y no decide nada que este ADR deje pendiente.

De su §5 de desacuerdos, **cuatro requieren decisión del dueño antes de implementar F1**:

1. **Quién lee la vista**: si la página pública lee por Prisma en el servidor (Server Component),
   el `grant select` a `anon` sobre la vista **no hace falta para la página** y solo abre la vista a
   cualquiera por Data API. Decidir: vista como contrato interno (lectura server-only, sin grant a
   `anon`) o vista públicamente consultable. ADR-11(b) y ADR-13-B conviven solo con la primera.
2. **La vista no devuelve rutas de fotos**: la grilla necesita la portada y la ficha hasta cuatro.
   Extender `catalog_public` o agregar una segunda vista de imágenes, con su grant acotado.
3. **`ProductImage` guarda una sola `path` para dos archivos** (ficha + miniatura): falta convención
   de nombre derivable o segunda columna, y definir de cuál archivo es `bytes`.
4. **`BranchPicker` es de selección única** y la curaduría de sucursales nombrables es múltiple:
   extender un componente compartido (riesgo para venta/caja/stock) o hacer una variante.

Las 16 preguntas de su §4 y las 8 del §6 de este ADR siguen abiertas para el dueño y el cliente.

## 7. Fuera de alcance de este plan

Diseño visual y de interacción, buscador, filtros, paginación fina, destacados, SEO/OpenGraph, y
cualquier forma de pedido o checkout. Todo eso se decide después de ADR-01 a ADR-04.
