# Design: Portal externo público por sucursal — flag `isPublic` (Opción B)

| Campo | Valor |
|---|---|
| **Change** | `portal-externo-publico-isPublic` |
| **Modo** | auto \| hybrid (OpenSpec + Engram) |
| **Delivery strategy** | auto-chain |
| **Review budget** | 400 líneas |
| **Predecesoras** | `proposal.md`, `exploration.md`, specs delta (5) |

## Technical Approach

Seis tracks (A–F) independientes. Estrategia: el flag `isPublic` es opt-in explícito (default `false`), el check de visibilidad vive en la action (el middleware puro no toca DB), el proxy solo deja pasar anónimos a `/sucursal/*`, la página mapea `success: false → notFound()` sin distinguir motivos (sin leak de existencia). El login del portal muere por completo.

### Capability `branch-public-flag` (nueva)

**Schema**: `Branch.isPublic Boolean @default(false)` en prisma/schema.prisma (junto a isActive).

**Migración** — SQL idempotente dev+prod (memoria #100):
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Branch' AND column_name='isPublic') THEN
    ALTER TABLE "Branch" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
```
Verificación post: columna presente; `SELECT COUNT(*) FROM "Branch" WHERE "isPublic" = false` == total; conteos Branch/BranchInventory/Purchase/Sale idénticos (sin pérdida).

**Zod** (`src/lib/validations/branch.ts`): createBranchSchema `isPublic: z.boolean().default(false)`; updateBranchSchema `isPublic: z.boolean().optional()`.

**Actions** (`src/app/actions/branch.ts`):
- createBranch: `tx.branch.create` añade `isPublic: validatedData.isPublic` (no rompe createBranchUser).
- updateBranch: `...(validatedData.isPublic !== undefined && { isPublic: validatedData.isPublic })` (patrón isActive; sin tocar authUserId).

### Capability `external-branch-catalog` (modificada)

`getExternalBranchInventory` (`src/app/actions/inventory.external.ts`):
1. `prisma.branch.findUnique({ where: { id: branchId }, select: { isPublic: true, isActive: true } })`; `!branch || !branch.isPublic || !branch.isActive` → `{ success: false }` (mismo resultado sin leak; aplica a todos los roles).
2. Query productos: `where: { active: true, inventory: { some: { branchId } } }` (FIX bug pre-existente) + select `{ code, name, price, inventory: { where: { branchId }, select: { stock: true } } }` + orderBy name asc. Quitar `id` del select raíz.
3. Contrato: `{ code, name, stock, price }`; sin id/authUserId/email. Pública sin inventario → `{ success: true, data: [] }`.

Página `src/app/sucursal/[branchId]/inventory/page.tsx`: eliminar import + guard getUserBranchId (líneas 3, 24-31); corregir comentario falso línea 28; mantener NaN→notFound, !success→notFound, force-dynamic.

### Capability `app-middleware` (modificada)

`decideBranchAccess` (`src/middleware/branch.ts`) simplificado:
```ts
export type BranchAccessInput = { pathname: string; method: string };
export type BranchAccessDecision = { allowed: boolean; reason?: 'method' | 'branch' };
export function decideBranchAccess(input: BranchAccessInput): BranchAccessDecision {
  if (method !== 'GET') return { allowed: false, reason: 'method' };
  const pathMatch = pathname.match(/^\/sucursal\/(\d+)/);
  if (!pathMatch) return { allowed: false, reason: 'branch' };
  return { allowed: true };
}
```
Sin role/claim, sin imports next/server, sin DB.

`src/proxy.ts`:
- Quitar import getUserBranchId (queda getUserRole) y el import de @/lib/supabase/branch (línea 7).
- isExcluded: eliminar isPortalLoginPath (línea 45).
- Bloque `!user && !isExcluded`: `if (pathname.startsWith('/sucursal/')) return response;` antes del redirect a /login (anónimo pasa).
- Bloque con sesión `/sucursal/*`: quitar exclusión isPortalLoginPath (73) y getUserRole/getUserBranchId; `decideBranchAccess({ pathname, method: request.method })`; !allowed → redirect /unauthorized.
- Corregir comentarios 32-34 y 70-72.
- matcher sin cambios.

### Capability `branch-management-ui` (modificada)

`BranchManager.tsx`: Branch/BranchForm con `isPublic: boolean`; EMPTY_FORM `isPublic: false`; openEdit precarga; payload `isPublic: form.isPublic` en create y update; checkbox "Sucursal pública" junto a "Sucursal activa" (`w-5 h-5 rounded`, label `text-sm text-[#222222]`); badge "Pública" en listado (`px-2 py-0.5 bg-[#ff385c]/10 text-[#ff385c] rounded-full text-[11px] font-semibold`); botón "Portal" href → `/sucursal/${branch.id}/inventory` (conservar aria-label, min-h-[44px], touch-manipulation).

### Capability `branch-portal-login` (ELIMINADA)

Eliminar 6 archivos: `src/actions/auth.branch.ts`, `src/actions/auth.branch.test.ts`, `src/app/sucursal/[branchId]/login/page.tsx`, `src/app/sucursal/[branchId]/login/PortalLoginForm.tsx`, `src/lib/supabase/branch.ts` (isPortalLoginPath + decideBranchAccess async muerta + getBranchIdFromPath), `src/lib/supabase/branch.test.ts`.
- proxy.test.ts: quitar mock @/lib/supabase/branch (requireActual de isPortalLoginPath) y getUserBranchId.
- Greps post: loginBranch→0, isPortalLoginPath→0, PortalLoginForm→0.
- /sucursal/<id>/login → 404 natural.
- Archive: marcar obsoleta openspec/specs/branch-portal-login-ui/spec.md.

## Data Flow

**Anónimo GET /sucursal/39/inventory**: proxy (!user && !isExcluded && startsWith /sucursal/) → NO redirect, NextResponse.next() → page.tsx → getExternalBranchInventory({branchId:39}) → findUnique Branch (isPublic/isActive) → no existe/!isPublic/!isActive → {success:false} → notFound; sí → product.findMany(active:true, inventory.some) → ExternalInventoryTable con {code,name,stock,price}.

**Admin marca isPublic**: BranchManager payload → createBranch/updateBranch → zod → tx.branch.create(..., isPublic) / prisma.branch.update(...(isPublic !== undefined && {isPublic})) → BD → revalidatePath('/sucursales') → badge + botón Portal → /sucursal/39/inventory.

## Component/File Changes

| Archivo | Acción |
|---|---|
| `prisma/schema.prisma` | Modificar — isPublic Boolean @default(false) |
| Migración BD dev+prod | Aplicar — SQL idempotente (memoria #100) |
| `src/middleware/branch.ts` | Modificar — decideBranchAccess GET-only puro |
| `src/middleware/branch.test.ts` | Reescribir — 4 casos (GET anónimo, GET admin, POST deny, URL deny) |
| `src/proxy.ts` | Modificar — anónimos a /sucursal/*; sin isPortalLoginPath/getUserBranchId; comentarios |
| `src/proxy.test.ts` | Modificar — quitar requireActual; +4 casos |
| `src/app/actions/inventory.external.ts` | Modificar — check isPublic/isActive + active:true; sin id |
| `src/app/actions/inventory.external.test.ts` | Crear — 6 casos visibilidad |
| `src/app/sucursal/[branchId]/inventory/page.tsx` | Modificar — sin guard; comentario corregido |
| `src/actions/auth.branch.ts` + test | Eliminar |
| `src/app/sucursal/[branchId]/login/page.tsx` + PortalLoginForm.tsx | Eliminar |
| `src/lib/supabase/branch.ts` + test | Eliminar |
| `src/lib/validations/branch.ts` | Modificar — isPublic create/update |
| `src/app/actions/branch.ts` | Modificar — persistir isPublic |
| `src/app/actions/branch.test.ts` | Modificar — casos isPublic |
| `src/components/ui/BranchManager.tsx` | Modificar — toggle/badge/botón Portal |

## Testing Strategy

- branch.test.ts (middleware): 4 casos.
- inventory.external.test.ts (nuevo, mock prisma): pública+activa→catálogo; no pública→success:false; inactiva→success:false; inexistente→success:false; producto inactivo excluido; pública sin inventario→data:[]; zod branchId inválido→success:false.
- proxy.test.ts: quitar requireActual/getUserBranchId; +anónimo GET /sucursal/39/inventory sin redirect; +POST anónimo sin redirect; +autenticado GET allow; +malformado→/unauthorized.
- branch.test.ts (actions): createBranchSchema default false; updateBranchSchema optional; createBranch persiste isPublic:true (objectContaining); updateBranch persiste isPublic:false; updateBranch sin isPublic no lo incluye.
- Greps: loginBranch/isPortalLoginPath/PortalLoginForm → 0.
- Comandos: npm test, npx tsc --noEmit, npm run lint, greps.

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| Enumeración de IDs | Mismo notFound para no-pública/inactiva/inexistente |
| Leak actual isActive/Product.active | Fix obligatorio en action con test |
| Imports rotos al borrar auth.branch/lib.branch | Grep verificado; tsc como compuerta |
| Migración prod | Proceso memoria #100, SQL idempotente, verificación post, rollback DROP COLUMN |
| Admin en no-pública | Cambio intencional (action no distingue roles) |
| Sin E2E real | Validación manual + cobertura unitaria |
| Spec obsoleta branch-portal-login-ui | Archive la marca obsoleta |
| Deuda isAuthorizedForBranch/getUserBranchId | Documentada, fuera de alcance |

## Open Questions

- [ ] Quitar id del select raíz (recomendado).
- [ ] POST anónimo → 405 del framework (no interceptado).
- [ ] Archive: obsoleta branch-portal-login-ui + deuda auth.ts.