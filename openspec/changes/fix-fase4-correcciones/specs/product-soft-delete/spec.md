# Delta para Product Soft-Delete (fix-fase4-correcciones)

## MODIFIED Requirements

### Requirement: Excluir Productos Inactivos de Selectores y Listados

Todos los listados (`/productos`, `/inventario`) y todos los selectores de productos en formularios de compra, venta y modales de movimiento DEBEN excluir por defecto los productos con active=false. La acción `getProducts` DEBE filtrar `active: true` por defecto, y `getProductsWithBranchStock` DEBE aplicar `activeOnly` por defecto (active=true). La consulta explícita de inactivos de `/inventario/inactivos` NO DEBE verse afectada. (FIX-FASE4 issue 1)
(Previously: solo los selectores excluían inactivos; los listados /productos e /inventario mostraban todos los productos)

#### Scenario: Selector oculta inactivos
- GIVEN Producto A (active=true) y Producto B (active=false)
- WHEN se abre un selector de productos en un formulario de compra
- THEN solo Producto A DEBE aparecer en la lista

#### Scenario: /productos lista solo activos
- GIVEN Producto A activo y Producto B inactivo
- WHEN el admin abre /productos
- THEN solo Producto A DEBE listarse

#### Scenario: getProductsWithBranchStock filtra activos por defecto
- GIVEN inventario con productos activos e inactivos
- WHEN se invoca getProductsWithBranchStock sin opciones
- THEN solo los productos activos DEBEN devolverse

#### Scenario: La página de inactivos conserva su consulta
- GIVEN productos inactivos en la BDD
- WHEN se abre /inventario/inactivos
- THEN todos los inactivos DEBEN listarse con su botón "Activar"
