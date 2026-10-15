# app-navigation — Delta (New Capability)

## Delta

Capacidad nueva, sin spec base. Define la estructura de navegación: "Sucursales" como ítem primario del BottomNav (fuera del menú "Más"), link a `/inventario/inactivos` desde inventario, e icono de ventas estable.

## Requirements

### Requirement: Sucursales como ítem primario del BottomNav

El BottomNav MUST renderizar "Sucursales" como ítem de navegación primario (en `navItems`, no en overflow). La barra SHALL mostrar exactamente 7 links y MUST NOT renderizar el botón "Más".

#### Scenario: Sucursales visibles sin menú Más

- GIVEN el BottomNav renderizado
- WHEN el admin navega la app móvil
- THEN "Sucursales" aparece como ítem primario
- AND NO se muestra el botón "Más"
- AND el total de links es 7

### Requirement: Link a inventario de inactivos

La página `/inventario` MUST proveer un link "Ver inactivos" que navega a `/inventario/inactivos`.

#### Scenario: Acceso a inactivos desde inventario

- GIVEN el admin en `/inventario`
- WHEN toca el link "Ver inactivos"
- THEN la app navega a `/inventario/inactivos`

### Requirement: Icono de ventas estable

El ítem "Ventas" del BottomNav SHALL mantener el icono actual (signo de dólar dentro de círculo). No se modifica.

#### Scenario: Icono de ventas sin cambios

- GIVEN el BottomNav renderizado
- WHEN se inspecciona el ítem Ventas
- THEN muestra el icono de dólar en círculo

## Acceptance Criteria

- [ ] `BottomNav.test.ts` verifica 7 links y ausencia del botón "Más"
- [ ] E2E móvil: "Sucursales" alcanzable en un tap desde cualquier pestaña
- [ ] Link "Ver inactivos" presente en `/inventario` y navega correctamente

## Notes

- Decisión: el icono de ventas NO se cambia (fuera de scope).
- La prueba unitaria se actualiza junto con el componente (7 links).
