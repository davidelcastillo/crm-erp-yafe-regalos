# Gestión de sucursales

Guía de las funcionalidades de sucursales de la v3: creación con usuario automático, edición, eliminación con guards, portal externo, dashboard por periodo/sucursal y búsquedas en ventas e inventario.

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

Cada usuario de sucursal puede consultar el inventario de su propia sucursal en `/sucursal/[branchId]/inventory` (solo lectura, solo `GET`). Detalles y troubleshooting en [portal-externo-sucursal.md](./portal-externo-sucursal.md).

## Dashboard por periodo y sucursal

El dashboard ahora es configurable:

| Selector | Opciones |
|----------|----------|
| Periodo | 7 / 30 / 90 días, o **Personalizado** (rango de fechas) |
| Sucursal | **Todas** (agrega todas las sucursales) o una sucursal activa específica |

- Al cambiar cualquiera de los dos, las métricas se recalculan.
- Las tarjetas muestran una etiqueta de contexto: **"(Sucursal X)"** cuando se filtra por sucursal o **"(Todas)"** cuando se agregan todas.
- La Server Action `getStats(type, startDate, endDate, branchId?)` rechaza rangos inválidos (fecha de inicio después de la de fin).

## Búsquedas

- **Ventas**: buscador con **debounce de 300 ms** + paginación **"Cargar más"**.
- **Inventario**: búsqueda unificada **server-side** que matchea nombre, código, descripción o nombre de categoría (case-insensitive). Una búsqueda vacía devuelve la lista completa sin filtrar. El listado admite también filtros por sucursal y por categoría (multi-select).

## Checklist de verificación

- [ ] Crear sucursal muestra código normalizado en mayúsculas y credenciales de una sola vez.
- [ ] Duplicar un código de sucursal se rechaza.
- [ ] Eliminar la sucursal por defecto, con compras/ventas o con stock se bloquea con su guard correspondiente.
- [ ] Un usuario de sucursal solo ve su propio inventario y no puede modificarlo.
- [ ] El dashboard reacciona a cambios de periodo y sucursal y muestra la etiqueta correcta.
