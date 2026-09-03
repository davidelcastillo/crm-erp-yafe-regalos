# Domain: app-navigation — Delta

## Delta

La navegación deja de exponer la página `/productos`: (1) `BottomNav.tsx` elimina el ítem `{ href: "/productos", label: "Productos", icon: ProductIcon }` (línea 53) y el componente `ProductIcon` (líneas 14-18), quedando `navItems` con 6 entradas (Dashboard, Compras, Ventas, Inventario, Sucursales, Clientes); (2) `src/app/productos/page.tsx` deja de ser una client page y pasa a ser una server page cuyo único contenido es `redirect("/inventario")` (HTTP 307 temporal), preservando bookmarks y links existentes; (3) el link de retorno de `inactivos/page.tsx:99` apunta a `/inventario`. El spec base (delta previo de rutas auth en Navbar/BottomNav) permanece intacto; este delta es acumulativo sobre el mismo spec.

## Requirements

1. **BottomNav con 6 ítems (SHALL)** — `navItems` en `BottomNav.tsx` SHALL contener exactamente 6 entradas: `/dashboard`, `/compras`, `/ventas`, `/inventario`, `/sucursales`, `/clientes`. El sistema SHALL NOT renderizar un link "Productos" en la navegación inferior.
2. **`ProductIcon` eliminado (SHALL)** — el componente `ProductIcon` (`BottomNav.tsx:14-18`) SHALL ser removido junto con su uso; SHALL NOT quedar código muerto ni referencias.
3. **`/productos` redirige a `/inventario` (SHALL)** — `src/app/productos/page.tsx` SHALL convertirse en una server page sin la directiva `'use client'`, cuyo único contenido sea `redirect("/inventario")` de `next/navigation` (HTTP 307 temporal). La página SHALL NOT renderizar UI ni datos propios.
4. **Link de retorno de inactivos (SHALL)** — `src/app/inventario/inactivos/page.tsx:99` SHALL apuntar a `href="/inventario"` (antes `/productos`), manteniendo el estilo del botón secundario actual.
5. **Copy del link de inactivos (SHOULD)** — el texto del link SHALL actualizarse de "Volver a productos" a "Volver a inventario" (mismo criterio de copy-staleness que la decisión resuelta sobre `AddPurchaseButton.tsx:193`).
6. **Tests de BottomNav actualizados (SHALL)** — `BottomNav.test.ts` SHALL: (a) esperar 6 links en vez de 7 (`toHaveLength(6)`), (b) retirar "Productos" del `arrayContaining`, y (c) reemplazar el escenario de highlight que usaba `/productos` (líneas 39-44) por otro ítem existente, p. ej. `/inventario`.
7. **Sin links navegables residuales a `/productos` (SHALL)** — tras el cambio, SHALL NOT existir ningún `Link`/`href` navegable a `/productos` en la app. Los imports por ruta de archivo (`@/app/productos/components/ProductForm` en `AddPurchaseButton`) SHALL permanecer intactos (no son navegación) y el único destino de `/productos` SHALL ser el redirect server.

## Scenarios

#### Scenario: BottomNav con 6 ítems
- GIVEN el admin autenticado en una ruta interna con BottomNav renderizado
- THEN la barra SHALL mostrar exactamente 6 links: Dashboard, Compras, Ventas, Inventario, Sucursales y Clientes
- AND SHALL NOT existir un link "Productos"

#### Scenario: Highlight reemplazado en el test
- GIVEN `usePathname()` devuelve `/inventario`
- THEN el link "Inventario" SHALL tener la clase activa `text-[#ff385c]`
- AND el test SHALL NOT referenciar `/productos` para el highlight

#### Scenario: GET /productos redirige con 307
- GIVEN un navegador (o un bookmark) solicita `/productos`
- WHEN la server page se ejecuta
- THEN el servidor SHALL responder HTTP 307 con `Location: /inventario`
- AND el usuario SHALL terminar en `/inventario` sin renderizar contenido de productos

#### Scenario: Link de inactivos apunta a /inventario
- GIVEN el admin en `/inventario/inactivos`
- WHEN toca el botón "Volver a inventario"
- THEN el navegador SHALL navegar a `/inventario` (y no a `/productos`)

#### Scenario: Sin links navegables residuales
- GIVEN el cambio aplicado
- WHEN se inspecciona la codebase por `href="/productos"` / `Link href="/productos"`
- THEN SHALL NOT existir coincidencias navegables fuera del `redirect("/inventario")` de la server page
- AND los imports de `ProductForm` por ruta de archivo SHALL NOT contarse como navegación

## Out of Scope

- No se toca `BottomNavMasMenu` (componente sin uso activo).
- No se eliminan `ProductCard`/`DeleteButton` ni sus tests (huérfanos tras el redirect; permanecen en el repo).
- No se modifica el comportamiento de ocultamiento de BottomNav en rutas auth del delta previo.
- No se introduce un redirect permanente (308) ni se borra el directorio `src/app/productos/`: la server page reemplaza el contenido de `page.tsx`, pero `productos/components/` sigue siendo importado por ruta de archivo.