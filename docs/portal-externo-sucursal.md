# Portal externo de sucursal (solo lectura)

El portal externo permite que cada **usuario de sucursal** consulte el inventario de su propia sucursal **sin poder modificarlo**. Vive en `/sucursal/[branchId]/inventory` y solo es accesible para el rol `branch_user`.

## Acceso rápido

1. El admin crea la sucursal desde **Sucursales** → el usuario de sucursal se crea automáticamente (email + contraseña temporal que se muestran **una sola vez**).
2. El usuario ingresa en `/login` con esas credenciales.
3. Abre `/sucursal/<branchId>/inventory` y ve su inventario con búsqueda.
4. Cualquier intento de ver otra sucursal, de usar otro verbo HTTP o de un rol distinto → se redirige a `/unauthorized`.

## Cómo se crea el usuario de sucursal

Al crear una sucursal, el sistema provisiona automáticamente un usuario en Supabase Auth:

| Campo | Valor |
|-------|-------|
| Rol | `branch_user` (en `app_metadata`) |
| Reclamo de sucursal | `branchId` (en `app_metadata`) |
| Email | `sucursal-<code>@<domain>` (ej. `sucursal-cen@feriaconexx.com`) |
| Dominio | `BRANCH_EMAIL_DOMAIN` (default `feriaconexx.com`) |
| Contraseña temporal | ≥ 12 caracteres, 4 clases (mayúscula, minúscula, dígito, símbolo), generada con `crypto` |

> La contraseña temporal **solo se muestra una vez** al crear la sucursal. No se persiste en la base de datos. Si se pierde, se debe gestionar el reset del usuario en Supabase Auth.

## Restricciones de acceso

La decisión la toma `decideBranchAccess` (`src/middleware/branch.ts`), invocada desde `src/proxy.ts` (Next 16 proxy). Se permite la petición **solo** si se cumplen TODAS:

| Regla | Condición |
|-------|-----------|
| Rol | el usuario tiene `role: branch_user` |
| Reclamo | el usuario tiene `branchId` en `app_metadata` |
| Verbo HTTP | es `GET` |
| Sucursal | el `branchId` de la URL coincide con el reclamo |

Cualquier falla → redirect a `/unauthorized`. Las rutas internas del admin (`/inventario`, `/ventas`, `/sucursales`, etc.) quedan bloqueadas para este rol.

## Backfill del reclamo `admin` (importante)

El gating de rutas internas exige que el usuario admin tenga `role: admin` en `app_metadata`. Si el admin se creó antes de esta funcionalidad, **no tiene el reclamo** y quedaría lockeado de la app.

```bash
node scripts/backfill-admin-claim.mjs
```

- **OJO: correr ANTES de habilitar el gating estricto.** Si el gating ya está activo y el admin no tiene claim, primero hay que habilitarlo desde fuera (p. ej. Supabase Dashboard) y recién después el admin puede ejecutar el script.
- Usa `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SUPABASE_URL`.
- Apunta a `ADMIN_EMAIL` si está definido; si no, al primer usuario con email. Es **idempotente** (se puede re-ejecutar).

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Redirect a `/unauthorized` al abrir `/sucursal/5/inventory` | El `branchId` de la URL no coincide con el claim del usuario | Verificar que el usuario logueado es el de esa sucursal |
| Redirect a `/unauthorized` con rol admin | El admin no tiene `app_metadata.role = "admin"` | Ejecutar `node scripts/backfill-admin-claim.mjs` |
| 403 en el portal externo | Verbo distinto de `GET` o rol distinto de `branch_user` | El portal es de solo lectura: usar `GET` con la sesión de sucursal |
| El admin no puede entrar a la app | Gating activo sin backfill previo | Habilitar el rol del admin desde Supabase Dashboard y ejecutar el backfill |
