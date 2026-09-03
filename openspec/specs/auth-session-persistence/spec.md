# Domain: auth-session-persistence — Delta

## Delta

**Nueva capability** — no existe spec base en `openspec/specs/auth-session-persistence/spec.md`. El sistema actual crea la sesión con `createServerClient()` sin parámetros (`src/lib/supabase/server.ts`), el checkbox "Recordarme" de `LoginForm.tsx` (líneas 100-105) existe pero es inerte, y `logout()` escribe una cookie muerta `sb-token` (vestigio pre-@supabase/ssr, `src/actions/auth.ts:87`).

Hecho verificado en `node_modules/@supabase/ssr` 0.12.4: `cookieOptions.maxAge` pasado al cliente se pisa internamente con `DEFAULT_COOKIE_OPTIONS.maxAge = 400 días`; el control real de la duración de sesión es el `maxAge` de la cookie `sb-<ref>-auth-token` (+ sus chunks), que se aplica en el store de cookies del cliente. Esta spec define el mecanismo para controlar esa duración desde el código de la app.

## Requirements

1. **Firma `createServerClient(sessionMaxAge?: number)`** en `src/lib/supabase/server.ts`: el sistema SHALL aceptar un parámetro opcional `sessionMaxAge` (segundos). El valor por defecto SHALL ser `DEFAULT_SESSION_MAX_AGE = 60 * 60` (1 hora).
2. **Override de `maxAge` en el store**: en los callbacks de set del store de cookies (tanto el `set` como el `setAll` si se migra a `getAll/setAll`), el sistema SHALL aplicar `maxAge: sessionMaxAge ?? DEFAULT_SESSION_MAX_AGE` cuando `name.startsWith(storageKey)`, donde `storageKey` es `sb-<project-ref>-auth-token`. El prefijo cubre tanto la cookie principal como sus chunks (`sb-<ref>-auth-token.<n>`).
3. **No interferir con removes**: el sistema SHALL NOT aplicar el override cuando la operación es una eliminación (remove de sesión, `maxAge: 0`); el borrado de la cookie de sesión debe conservar su semántica original.
4. **Alcance del override**: el sistema SHALL NOT modificar el `maxAge` de otras cookies (p. ej. `redirect-to`); el override se limita exclusivamente a la cookie de sesión y sus chunks.
5. **`login()` lee remember-me** (`src/actions/auth.ts`): el sistema SHALL leer `formData.get('remember-me') === 'on'` y, si es `'on'`, invocar `createServerClient(7 * 24 * 60 * 60)` (7 días); si no, invocar `createServerClient()` sin argumento (default 1 hora). El resto del flujo de `login()` (validación, redirect por rol, limpieza de `redirect-to`) SHALL permanecer sin cambios.
6. **`logout()` sin cookie muerta**: el sistema SHALL eliminar el set de la cookie `sb-token` en `src/actions/auth.ts`; la limpieza de las cookies reales de sesión (`sb-<ref>-auth-token` + chunks) SHALL quedar a cargo de `supabase.auth.signOut()`. Tras `logout()`, el navegador MUST NOT conservar cookies de sesión activas.
7. **Portal de sucursal con default**: `loginBranch` (`src/actions/auth.branch.ts`) SHALL NOT tener checkbox "Recordarme" y SHALL usar el default de 1 hora (sin cambios de lógica).
8. **Cota de la constante**: el sistema SHALL mantener 7 días (604800 s) por debajo del TTL server-side del refresh token (30-60 días según configuración de Supabase); la constante de recordarme MUST NOT superar 30 días.
9. **Migración opcional del store** (SHOULD, no bloqueante): el sistema SHOULD migrar el store de la forma deprecada `get/set/remove` a la forma `getAll/setAll`, conservando el mismo override de `maxAge` en `setAll`.

## Scenarios

#### Scenario: Recordarme ON → cookie de 7 días
- GIVEN un login con el checkbox `remember-me` marcado (`formData.get('remember-me') === 'on'`)
- WHEN `login()` invoca `createServerClient(604800)` y `signInWithPassword` setea la sesión
- THEN la cookie `sb-<ref>-auth-token` (y sus chunks) se escribe con `maxAge: 604800` (7 días)
- AND la inspección de la cookie en el navegador lo verifica

#### Scenario: Recordarme OFF → cookie de 1 hora (default)
- GIVEN un login sin el checkbox `remember-me` marcado
- WHEN `login()` invoca `createServerClient()` sin argumento
- THEN la cookie `sb-<ref>-auth-token` se escribe con `maxAge: 3600` (1 hora, `DEFAULT_SESSION_MAX_AGE`)

#### Scenario: Portal de sucursal usa el default
- GIVEN un login en `/sucursal/<branchId>/login` (sin checkbox)
- WHEN `loginBranch` invoca `createServerClient()`
- THEN la cookie de sesión se escribe con `maxAge: 3600`

#### Scenario: Logout limpia las cookies reales y no escribe `sb-token`
- GIVEN una sesión activa con cookies `sb-<ref>-auth-token` (+ chunks)
- WHEN `logout()` ejecuta `signOut()` y retorna `{ success: true, redirectTo: '/login' }`
- THEN las cookies de sesión son removidas del navegador
- AND la cookie muerta `sb-token` NO se escribe en ningún momento

#### Scenario: Otras cookies no se ven afectadas por el override
- GIVEN el middleware setea la cookie `redirect-to` durante un request sin sesión
- WHEN el store de `createServerClient` procesa ese set
- THEN el `maxAge` de `redirect-to` permanece sin modificar (el override solo aplica a `sb-<ref>-auth-token*`)

#### Scenario: Remove de sesión conserva su semántica
- GIVEN una sesión activa
- WHEN Supabase emite la eliminación de la cookie de sesión (remove)
- THEN la cookie se borra (el override de `maxAge` no la convierte en una cookie persistente)