# Gestión de sucursales

Guía de sucursales: creación, edición, eliminación con guards, catálogo público opt-in, dashboard por periodo/sucursal y búsquedas en ventas e inventario. El aprovisionamiento heredado de usuarios de Auth no es un requisito para consultar el catálogo.

## Crear una sucursal

Desde el módulo **Sucursales**:

| Campo | Regla |
|-------|-------|
| Nombre | Requerido, hasta 255 caracteres |
| Código (`code`) | **2 a 10 caracteres alfanuméricos**, se guarda en **mayúsculas** (ej. `cen` → `CEN`). Debe ser único. |
| Dirección / Teléfono / Email | Opcionales |
| Activa | Por defecto `true` |

Al guardar, además del registro en la base, se crea automáticamente un usuario en Supabase Auth (rol `branch_user`, email `sucursal-<code>@<domain>`). Las **credenciales temporales se muestran una sola vez** en pantalla: copialas antes de cerrar, no se persisten en la base de datos.

## Editar una sucursal

Se pueden editar nombre, dirección, teléfono, email y estado activo. El `code` también es editable (se re-valida con la misma regla de 2-10 alfanuméricos). El `authUserId` **no** se modifica: el usuario de Auth queda ligado a la sucursal original.

## Eliminar una sucursal

La eliminación está protegida por guards que abortan la operación con un error específico:

| Guard | Motivo |
|-------|--------|
| `DEFAULT_BRANCH` | No se puede eliminar la sucursal por defecto (id 1, "Principal") |
| `HAS_DEPENDENT_DATA` | La sucursal tiene compras o ventas asociadas |
| `HAS_STOCK` | La sucursal tiene stock (`stock > 0`) en `BranchInventory` |

Si pasa los guards, se elimina primero el usuario de Auth asociado (vía `deleteBranchUser`) y luego el registro. Si falla la eliminación del usuario, **se aborta todo** (transacción).

## Portal externo de sucursal

Cualquier visitante puede consultar `/sucursal/[branchId]/inventory` sin login si la sucursal existe, está activa y tiene `isPublic=true` (solo lectura, solo `GET`). La publicación se administra desde Sucursales; los usuarios `branch_user` heredados no controlan el acceso al catálogo. Detalles y troubleshooting en [portal-externo-sucursal.md](./portal-externo-sucursal.md).

## Dashboard por periodo y sucursal

El dashboard ahora es configurable:

| Selector | Opciones |
|----------|----------|
| Periodo | 7 / 30 / 90 días, o **Personalizado** (rango de fechas) |
| Sucursal | **Todas** (agrega todas las sucursales) o una sucursal activa específica |

- Al cambiar cualquiera de los dos, las métricas se recalculan.
- **Un solo período para todo el tablero**: las tarjetas (`getStats`) y el gráfico de ingresos vs egresos (`getPerformanceData`) usan el mismo rango. El gráfico dibuja un punto por cada día calendario local del rango, incluidos los días sin movimientos, y acumula todas las ventas y compras de un mismo día.
- Las tarjetas muestran una etiqueta de contexto: **"(Sucursal X)"** cuando se filtra por sucursal o **"(Todas)"** cuando se agregan todas.
- El título del gráfico nombra el rango elegido: **"Últimos N días"** o **"Del DD/MM/AAAA al DD/MM/AAAA"**.
- Los rangos se arman con **días calendario locales** (00:00:00 del día inicial a 23:59:59.999 del final). `new Date("YYYY-MM-DD")` es medianoche UTC y dejaba el día elegido afuera en UTC-3; el mismo criterio se usa para rotular el eje del gráfico (helper `src/lib/dates.ts`).
- La Server Action `getStats(type, startDate, endDate, branchId?)` rechaza rangos inválidos (fecha de inicio después de la de fin); `getPerformanceData({ days | startDate+endDate, branchId })` usa el mismo criterio: un rango de fechas manda sobre `days` y un rango incompleto o inválido devuelve error.

## Búsquedas

- **Ventas**: buscador con **debounce de 300 ms** + paginación **"Cargar más"**.
- **Inventario**: búsqueda unificada **server-side** que matchea nombre, código, descripción o nombre de categoría (case-insensitive). Una búsqueda vacía devuelve la lista completa sin filtrar. El listado admite también filtros por sucursal y por categoría (multi-select).

## Checklist de verificación

- [ ] Crear sucursal muestra código normalizado en mayúsculas y credenciales de una sola vez.
- [ ] Duplicar un código de sucursal se rechaza.
- [ ] Eliminar la sucursal por defecto, con compras/ventas o con stock se bloquea con su guard correspondiente.
- [ ] El catálogo de una sucursal activa y publicada es accesible sin login; una no publicada, inactiva o inexistente no devuelve inventario.
- [ ] El dashboard reacciona a cambios de periodo y sucursal y muestra la etiqueta correcta.
- [ ] El gráfico de ingresos vs egresos muestra el período elegido (7 / 30 / 90 días o el rango personalizado) y cada día con el total de sus movimientos.
