# Exploration: Portal externo público con flag isPublic por sucursal (Opción B)

## Contexto (verificado)

- **Decisión del usuario**: hacer el portal externo de sucursales (`/sucursal/<id>/inventory`) público sin login, para compartir el catálogo con clientes. **Opción B elegida**: flag `isPublic` por sucursal — solo las sucursales marcadas como públicas son visibles sin autenticación.
- El problema original (sucursal 39 "Punto Rosa" credenciales inválidas) queda en segundo plano: el email real del auth user es `sucursal-prose@feriaconexx.com` (no `puntorosa@`), pero con portal público vía isPublic ya no hace falta el login del portal para ver el catálogo.

## Capas de protección actuales (evidencia file:línea)

1. **`src/proxy.ts` es el middleware** (Next 16 usa proxy.ts, no middleware.ts):
   - `:39-49` isExcluded: /login, /unauthorized, /forgot-password, /reset-password, /auth/callback, isPortalLoginPath, /_next/, /favicon.ico, /images/, /public/.
   - `:52-63` !user && !isExcluded → redirect /login + cookie redirect-to.
   - `:69-87` con user + pathname /sucursal/ → decideBranchAccess (si no es portal-login); !allowed → redirect /unauthorized.
   - `:88-98` admin gating rutas internas (role !== 'admin' → /unauthorized).
   - **HOY: usuario anónimo en /sucursal/39/inventory → redirect a /login (nunca llega a la página).**
2. **`src/middleware/branch.ts`** `decideBranchAccess` puro (:30-58): role=branch_user → deny 'role'; claim null → deny 'claim'; method !== GET → deny 'method'; URL branchId ≠ claim → deny 'branch'; else allow. Hay una segunda decideBranchAccess async en src/lib/supabase/branch.ts:15-42 (código muerto, nadie la llama).
3. **`src/app/sucursal/[branchId]/inventory/page.tsx`** guard `getUserBranchId()` (:24-31): con anónimo (null) el guard PASA (defensa en profundidad, no barrera real). Comentario :28 "admins pueden ver cualquier sucursal" es FALSO hoy (middleware niega admins).
4. **`src/app/actions/inventory.external.ts`** `getExternalBranchInventory` (:12-72): NO tiene guard de auth; devuelve `{ code, name, stock, price }`; NO filtra Branch.isActive ni Product.active → sucursal inactiva y productos inactivos se exponen (bug pre-existente).

## Datos expuestos por el catálogo público

- Campos: `code, name, stock, price` (con $). Stock en unidades. Sin otros datos sensibles.
- Branch inexistente/sin inventario → `{ success: true, data: [] }` → "No hay productos..." (no 404).
- notFound solo por branchId no numérico, error zod, excepción Prisma.

## Opción B — Flag isPublic por sucursal (ELEGIDA)

- Migración Prisma: `Branch.isPublic Boolean @default(false)` (aplicar a BD prod + dev con el proceso de la memoria #100 o prisma db push).
- `BranchManager.tsx`: toggle checkbox isPublic en crear/editar.
- `getExternalBranchInventory`: check `branch.isPublic === true && branch.isActive === true` → si no, notFound/lista vacía. Tambien filtrar `Product.active` en la query.
- Middleware/página: el flag se evalúa en la action (el middleware puro no toca DB — mantener ese diseño). El proxy deja pasar anónimos a /sucursal/<id>/inventory SOLO si... (evaluar: proxy no puede saber isPublic sin DB → dejar pasar anónimos a /sucursal/* y que la página/action aplique el check → notFound si no pública).
- `decideBranchAccess` puro: eliminar reglas role/claim para GET (permitir anónimo), **mantener** method !== GET → deny. Match URL mantener.
- Página externa: eliminar guard getUserBranchId; la action hace el check de isPublic/isActive.
- Login del portal (`/sucursal/<id>/login`, PortalLoginForm, auth.branch.ts loginBranch): **decidir destino** — el rol branch_user y su login ¿siguen existiendo para futura UI operativa de sucursal? Si se conserva, NO borrar auth.branch.ts ni su test; solo quitar la exigencia de auth para GET de lectura. Si se elimina, borrar auth.branch.ts + auth.branch.test.ts + PortalLoginForm + página login + isPortalLoginPath.
- `BranchManager.tsx` botón "Portal" (:365-371): apuntar a /sucursal/<id>/inventory (con isPublic ON).

## Tests que dependen de la auth del portal

- `src/middleware/branch.test.ts` (5 casos): se reescriben (GET anónimo allow, POST deny, URL malformada deny; role/claim ya no niegan).
- `src/actions/auth.branch.test.ts` (5 casos loginBranch): se eliminan si muere loginBranch; se conservan si el rol sigue.
- `src/lib/supabase/branch.test.ts` (isPortalLoginPath): según destino del login.
- `src/proxy.test.ts`: no tiene casos /sucursal/* hoy; hay que actualizar mocks si el proxy deja de usar getUserBranchId.
- No hay tests de la página externa ni de getExternalBranchInventory ni E2E real.

## Archivos afectados (Opción B)

| Ruta | Acción |
|---|---|
| `prisma/schema.prisma` | Modificar — `Branch.isPublic Boolean @default(false)` |
| Migración BD dev + prod | Aplicar columna (proceso memoria #100) |
| `src/app/actions/inventory.external.ts` | Modificar — check isPublic + isActive + filtrar Product.active |
| `src/middleware/branch.ts` | Modificar — decideBranchAccess: GET anónimo allow; mantener method deny; match URL |
| `src/proxy.ts` | Modificar — dejar pasar anónimos a /sucursal/* (el check real está en la action) |
| `src/app/sucursal/[branchId]/inventory/page.tsx` | Modificar — quitar guard getUserBranchId; corregir comentario falso |
| `src/components/ui/BranchManager.tsx` | Modificar — toggle isPublic en form; botón Portal → inventory |
| `src/middleware/branch.test.ts` | Reescribir |
| `src/app/actions/inventory.external.test.ts` | Crear (si no existe) — casos isPublic/isActive |
| `src/lib/supabase/branch.ts` | Limpiar código muerto (opcional) |
| `src/actions/auth.branch.ts` + test + PortalLoginForm + login page | Según decisión del destino del rol branch_user |

## Riesgos

1. Enumeración: el flag isPublic no evita que alguien pruebe IDs, pero las no-públicas devuelven notFound/lista vacía → sin leak.
2. Branch inactiva + Product.active: fix obligatorio (hoy se exponen).
3. Destino del rol branch_user: decisión pendiente (conservar login vs eliminar).
4. Comentario falso en page.tsx:28.
5. Sin E2E real (no hay Playwright configurado).

## Decisiones resueltas

1. **Opción B (flag isPublic)** — elegida por el usuario (seguridad vs enumeración).
2. **Destino del rol branch_user / loginBranch**: **ELIMINAR** — el usuario decidió eliminar el login del portal (loginBranch, PortalLoginForm, página /sucursal/<id>/login, isPortalLoginPath, auth.branch.ts + test). El portal pasa a público vía isPublic y el rol branch_user muere.
3. **Inicial**: se marcarán isPublic las sucursales que el usuario quiera compartir (Punto Rosa 39 si aplica).