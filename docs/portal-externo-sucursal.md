# Catálogo público de sucursal (solo lectura)

El catálogo `/sucursal/[branchId]/inventory` se comparte **sin login** únicamente cuando la sucursal existe, está activa y tiene `isPublic=true`. Desactivar su publicación impide que la acción devuelva el inventario. El antiguo login `branch_user` del portal fue retirado.

## Acceso rápido

1. El admin entra en **Sucursales** y habilita la publicación de la sucursal que quiere compartir.
2. Comparte `/sucursal/<branchId>/inventory`.
3. El visitante abre el catálogo sin credenciales; puede consultar el inventario, no modificarlo.
4. Para retirar el acceso, desactivar la publicación o la sucursal desde el panel autorizado.

Los usuarios de Auth que conserve el aprovisionamiento heredado no son un requisito para visitar este catálogo.

## Controles actuales

| Capa | Responsabilidad |
|---|---|
| `src/proxy.ts` y `src/middleware/branch.ts` | Tratamiento de la ruta externa y restricción del recorrido de catálogo a `GET` |
| `src/app/actions/inventory.external.ts` | Validar `branchId` entero positivo; consultar `isPublic` e `isActive` antes de devolver inventario |
| `src/app/sucursal/[branchId]/inventory/page.tsx` | Mostrar el catálogo o `notFound()` cuando la consulta no lo permite |

Una sucursal inexistente, inactiva o no publicada produce la misma respuesta de indisponibilidad, también para un admin que visite el catálogo. Publicar el catálogo no habilita mutaciones ni las rutas internas del panel.

## Qué muestra

Productos activos que tienen un registro de inventario en esa sucursal, con código, nombre, stock y precio. El catálogo puede incluir stock cero; no confundirlo con el asistente PDF, cuya selección exige stock positivo.

## Troubleshooting

| Síntoma | Qué revisar |
|---|---|
| 404 al abrir el catálogo | ID válido, sucursal existente, activa y publicada; después, posibles fallos de consulta registrados en servidor |
| Catálogo sin productos | Inventario asignado a esa sucursal y productos activos; publicar no crea stock |
| Se buscan credenciales o `/sucursal/<id>/login` | Es el flujo retirado; usar directamente el enlace de inventario publicado |
| Admin enviado a `/unauthorized` en el panel | Sesión y claim `app_metadata.role=admin`; no es una restricción del catálogo público |

Los scripts administrativos de claims no forman parte del acceso al catálogo. Antes de usarlos hay que confirmar destinatario, entorno y autorización: no ejecutarlos como respuesta automática a un fallo de login.

## Seguridad pendiente de comprobación de entorno

La visibilidad de la aplicación **no demuestra** que las tablas estén protegidas en la Data API de Supabase. Existen advertencias históricas de RLS deshabilitado; su vigencia y las políticas/permisos deben comprobarse en el entorno autorizado. Esta guía no certifica el estado actual de producción.

## Checklist manual (no ejecutado por esta actualización documental)

- [ ] Anónimo abre una sucursal activa y publicada.
- [ ] Sucursal no publicada, inactiva o inexistente no devuelve inventario.
- [ ] El catálogo no ofrece modificaciones ni exige login de sucursal.
- [ ] El panel interno mantiene su autenticación y autorización.
