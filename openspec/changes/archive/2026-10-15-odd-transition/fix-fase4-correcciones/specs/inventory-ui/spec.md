# Delta para Inventory UI (fix-fase4-correcciones)

## ADDED Requirements

### Requirement: Botón de Acceso a Productos Inactivos

El sistema DEBE mostrar en la cabecera de `/inventario`, junto al botón "Exportar productos", un botón "Inactivos" con estilo secundario (color neutro, min-h-[44px], touch-manipulation) que navegue a `/inventario/inactivos`. La navegación inferior (BottomNav) NO DEBE incluir la entrada "Inactivos". (FIX-FASE4 issue 2)

#### Scenario: Botón visible y navegación
- GIVEN el admin en /inventario
- WHEN pulsa el botón "Inactivos"
- THEN el sistema navega a /inventario/inactivos

#### Scenario: Entrada removida de BottomNav
- GIVEN la barra de navegación inferior
- WHEN se renderiza
- THEN NO DEBE contener la ruta "/inventario/inactivos"

### Requirement: Operatividad de Exportar, Mover y Editar Stock

El sistema DEBE mantener `/inventario` responsivo para que Exportar productos, Mover stock y Editar stock se completen sin cuelgues (una vez eliminada la consulta N+1 por tarjeta). Mover stock DEBE refrescar la lista al confirmar. (FIX-FASE4 issues 9-11)

#### Scenario: Exportar productos
- GIVEN /inventario cargado sin consultas por tarjeta
- WHEN el admin abre "Exportar productos"
- THEN el asistente DEBE mostrar los datos y exportar sin cuelgues

#### Scenario: Mover stock refresca la lista
- GIVEN Producto A con stock en 2 sucursales
- WHEN se mueve stock y se confirma en MoveStockModal
- THEN la lista DEBE recargarse con el stock actualizado

#### Scenario: Editar stock persiste
- GIVEN Producto A en /inventario
- WHEN el admin edita el stock y guarda
- THEN el nuevo stock DEBE persistir y mostrarse

## MODIFIED Requirements

### Requirement: Página de Inventario con Filtros

El sistema DEBE renderizar `/inventario` como página admin-only que muestra SOLO productos activos con su stock por sucursal. Los filtros DEBEN incluir selector de sucursal (por defecto "Todas") y multi-select de categorías. La página DEBE mostrar: nombre, código, stock por sucursal visible, stock total y botones de acción. La página DEBE cargar las categorías UNA sola vez y pasarlas a las tarjetas; las tarjetas NO DEBEN ejecutar consultas de categorías individuales. (FIX-FASE4 issues 1, 4, 6, 8)
(Previously: listaba todos los productos sin filtro activo, cada tarjeta consultaba getCategoryOptions (N+1) y "Todas" leía solo el stock de la primera sucursal)

#### Scenario: Carga con todas las sucursales suma stock
- GIVEN 2 sucursales y 3 productos con stock
- WHEN el admin abre /inventario con filtro "Todas"
- THEN el stock mostrado por producto DEBE ser la SUMA del stock de todas las sucursales
- AND el total DEBE igualar la suma

#### Scenario: Solo productos activos por defecto
- GIVEN Producto A activo y Producto B inactivo
- WHEN el admin abre /inventario
- THEN solo Producto A DEBE mostrarse

#### Scenario: Filtro por sucursal
- GIVEN productos con stock en Sucursal 1 y Sucursal 2
- WHEN se selecciona "Sucursal 1" en el filtro
- THEN solo la columna de stock de Sucursal 1 DEBE mostrarse
- AND los productos con stock 0 en Sucursal 1 DEBEN mostrar 0

#### Scenario: Filtro por categoría sin colgarse
- GIVEN productos en categorías "Electronics" y "Food" y categorías ya cargadas por la página
- WHEN se selecciona "Electronics" en el filtro
- THEN solo los productos electrónicos DEBEN mostrarse
- AND el sistema NO DEBE ejecutar getCategoryOptions por tarjeta

#### Scenario: Una sola consulta de categorías por render
- GIVEN N productos en /inventario
- WHEN la página carga o se cambia un filtro
- THEN el sistema DEBE ejecutar a lo sumo UNA consulta de categorías por render

### Requirement: Componente BranchSelector

El sistema DEBE proporcionar un componente reutilizable `BranchSelector` con modos `single` y `multiple`. En modo single renderiza un dropdown; en modo multiple, checkboxes. La selección NO DEBE persistirse en localStorage y DEBE reiniciarse cuando cambia la ruta (pathname); cada página DEBE iniciar el filtro de sucursal sin seleccionar ("Todas" por defecto). (FIX-FASE4 issue 5)
(Previously: persistía la selección en localStorage (preferredBranch) y la hidrataba al montar, sobreviviendo a la navegación)

#### Scenario: Modo single renderiza dropdown
- GIVEN BranchSelector con mode="single"
- WHEN se renderiza
- THEN DEBE mostrar un dropdown con las sucursales activas y la opción "Todas"

#### Scenario: Modo multiple renderiza checkboxes
- GIVEN BranchSelector con mode="multiple"
- WHEN se renderiza
- THEN DEBEN mostrarse checkboxes por cada sucursal activa

#### Scenario: Se reinicia al navegar entre páginas
- GIVEN el admin selecciona "Sucursal 1" en /ventas
- WHEN navega a /productos
- THEN el selector DEBE mostrar "Todas" (selección reiniciada)

#### Scenario: Sin persistencia en localStorage
- GIVEN el admin selecciona una sucursal
- WHEN se recarga la página o se navega
- THEN el selector DEBE iniciar en "Todas" y la clave preferredBranch NO DEBE usarse
