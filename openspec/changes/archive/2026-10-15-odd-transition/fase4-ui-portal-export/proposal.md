# Proposal: FASE 4 — Mejoras de UI, Portal Externo, Exportación PDF y Usuario de Sucursal

## Intención

Cumplir los requerimientos de FASE4.md (R1–R3) sobre la base real del código tras Fase 3: mejorar el inventario y las ventas con búsqueda, hacer el dashboard personalizable por periodo/sucursal, entregar el portal externo de solo lectura `/sucursal/[branchId]/inventory`, añadir la exportación de inventario por sucursal (wizard PDF) y aprovisionar automáticamente un usuario `branch_user` en Supabase Auth al crear/eliminar sucursales. La exploración (`exploration.md`) confirma que el portal, el sistema de roles y `Branch.code` son greenfield: el middleware solo valida sesión, no existe `src/app/sucursal/`, no hay claims de rol y el schema no tiene `code`.

## Alcance

### In Scope
- **R1** Buscador unificado en Inventario (debounce 300 ms: name/code/description/category; consulta vacía → listado completo).
- **R1** Búsqueda en Ventas por `Product.name`/`Product.code` (contains, case-insensitive) + paginación `take/skip`; se mantienen filtros fecha/pago/sucursal.
- **R1** Dashboard: selects de Periodo (7/30/90/Personalizado) y Sucursal ("Todas"+lista); Server Actions genéricas `getStats(type, startDate, endDate, branchId?)`; tarjetas con label "(Sucursal X)"/"(Todas)".
- **R1** Portal externo `/sucursal/[branchId]/inventory` (solo lectura, GET) + `src/middleware/branch.ts` (rol `branch_user`, branchId de URL === branchId del usuario, 403 en otro caso/verbo).
- **R2** Botón "Exportar productos" + wizard 3 pasos (sucursal → checkboxes con contador → Generar PDF) + `exportBranchProductsPdf` + `generateProductsPdf` (pdf-lib, columnas Código|Nombre|Stock|Precio, nombre `inventario-<branchCode>-<YYYYMMDD>.pdf`).
- **R3** `createBranch`: inserta Branch + crea usuario Supabase Auth (email `sucursal-{code}@...`, password temporal ≥12 chars con 4 clases, `app_metadata: { role: 'branch_user', branchId }`, `email_confirm: true`), credenciales mostradas una vez (SweetAlert2). `deleteBranch`: elimina usuario Auth primero, aborta si falla.
- **Soporte** `Branch.code` (unique) + primera migración Prisma + seed `DEP`; `createServiceClient()` con `SUPABASE_SERVICE_ROLE_KEY`; gating por rol `admin` en `src/middleware.ts` (nuevo); tests colocated `*.test.ts` (unit + integración mockeada, patrón `label-print`).

### Out of Scope
- Envío real de email con credenciales (Edge/Resend) — queda como mejora futura; solo se muestran en pantalla.
- Actualizar email del usuario al editar el `code` (FASE4 lo marca como futuro).
- Tabla `user_roles`/`UserBranch` (se descarta, ver Decisiones Clave).
- Wiring de `NEXT_PUBLIC_FEATURE_*` (hoy sin uso en código): features tratadas como siempre-activas.
- Dashboard con drag-and-drop o tarjetas configurables por el usuario (solo selects de periodo/sucursal).

## Alineación con FASE4.md

| FASE4 | Cómo se cubre |
|-------|---------------|
| R1.1–1.3 | Buscador unificado + búsqueda en ventas + selects de periodo/sucursal |
| R1.4 | Portal externo + middleware branch (rol, match branchId, GET-only) |
| R2.1–2.5 | Wizard 3 pasos con validaciones (sucursal obligatoria, ≥1 producto, re-validación server-side de pertenencia) |
| R3.1–3.4 | Auto-create/delete de usuario con rollback compensatorio; password nunca persistida |
| Criterios 1–14 | Ver "Criterios de Éxito" (los 14 aceptados se traducen a checks) |

## Decisiones Clave

1. **Búsqueda server-driven** (param `search` en `getProductsWithBranchStock` y `getSales`), no filtrado client-side: escala, cumple "consulta vacía → listado completo" trivialmente y reutiliza filtros existentes.
2. **Roles vía custom claims (`app_metadata`)** y no tabla `user_roles`: middleware corre en Edge (sin Prisma); claims viajan en el JWT; idiomático en Supabase.
3. **PDF sigue el patrón `label-print.ts`**: `pdf-lib` + retorno base64 (no Blob literal) — el cliente convierte a Blob + `URL.createObjectURL`. Precedente probado con tests mockeando `pdf-lib`.
4. **`Branch.code` vía migración Prisma** (primera en el repo; prod se gestionó por SQL). Seed: id=1 "Depósito" → code "DEP".
5. **Credenciales solo en memoria del flujo**: se generan, se devuelven una vez al admin y nunca se persisten en la BD del proyecto.
6. **Backfill del claim `admin`** al admin existente (`auth.admin.updateUserById` con service role) ANTES de activar el gating estricto, para no lockear al usuario actual (riesgo de regresión #1).

## Capabilities

> Contrato con sdd-spec: cada ítem se materializa como spec nueva o delta.

### New Capabilities
- `branch-external-portal`: página de solo lectura `/sucursal/[branchId]/inventory` (tabla con stock/nombre/código/precio base + buscador simple, sin botones de mutación) y `src/middleware/branch.ts` (rol + match branchId + GET-only).
- `branch-user-provisioning`: `createBranchUser`/`deleteBranchUser`/`generateTemporaryPassword`/`generateBranchEmail`, `createServiceClient()`, rollback compensatorio en `createBranch`/`deleteBranch`, contrato de claims `{ role, branchId }`.
- `branch-export-pdf`: `ExportWizard` (stepper 3 pasos), `exportBranchProductsPdf`, `generateProductsPdf` (pdf-lib), zod `export.ts`, re-validación server-side de membresía.
- `dashboard-customization`: selects Periodo/Sucursal, `getStats(type, startDate, endDate, branchId?)`, tarjetas con label de contexto.

### Modified Capabilities
- `inventory-ui`: buscador unificado debounced (name/code/description/category) + botón "Exportar productos" junto a "Mover Stock".
- `sale-with-branch`: `getSales` con búsqueda por producto y paginación `take/skip`.
- `branch-management`: campo `code` único en schema/validaciones; `createBranch` aprovisiona usuario Auth; `deleteBranch` elimina usuario Auth (primero, aborta si falla); `updateBranch` NO crea usuario.
- `multi-location-inventory`: `getProductsWithBranchStock` gana param `search`; nueva proyección plana `code|name|stock|price` para el wizard.

## Enfoque Técnico

- **Capas**: Server Actions como única mutación (Next.js 16 App Router); páginas RSC; componentes interactivos (wizard, selects) Client Components; validación Zod en server y cliente; SweetAlert2 para credenciales/confirmaciones; debounce 300 ms.
- **R1**: extender `getProductsWithBranchStock` (OR sobre name/code/description + `category.name` contains) y `getSales` (OR `items.some.product.name/code` contains + `take/skip`); dashboard con `getStats` genérico agregando filtros fecha/sucursal a las consultas existentes (`getGlobalStats`, `getPerformanceData`).
- **R2**: `exportBranchProductsPdf(branchId, selectedProductIds)` — lee `BranchProduct.stock` + `Product.code/name/price`, valida membresía, genera tabla multipágina pdf-lib (base64), descarga cliente con nombre `inventario-<branchCode>-<YYYYMMDD>.pdf`.
- **R3**: `createServiceClient()` (service role); `createBranch` en try/catch: insert Branch → `auth.admin.createUser` → si falla, `deleteBranch` compensatorio; `deleteBranch`: `auth.admin.deleteUser` primero, aborta si falla. Gating admin en `src/middleware.ts` leyendo claims; `src/middleware/branch.ts` valida rol + branchId + verbo.

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/app/inventario/page.tsx` | Modified | Buscador unificado + botón "Exportar productos" |
| `src/app/inventario/components/InventarioList.tsx` | Modified | Consolidar inputs de búsqueda duplicados |
| `src/app/inventario/components/InventoryFilters.tsx` | Modified | Integrar categoría con búsqueda unificada |
| `src/app/inventario/components/ExportWizard.tsx` | New | Stepper 3 pasos |
| `src/app/actions/inventory.ts` | Modified | `search` param + `exportBranchProductsPdf` + proyección wizard |
| `src/app/actions/sale.ts` | Modified | `getSales` con búsqueda + paginación |
| `src/app/ventas/page.tsx`, `.../SalesList.tsx` | Modified | Input de búsqueda |
| `src/app/actions/dashboard.ts` | Modified | `getStats(type, startDate, endDate, branchId?)` |
| `src/app/dashboard/page.tsx`, `.../DashboardCards.tsx` | Modified | Selects Periodo/Sucursal + label contexto |
| `src/app/sucursal/[branchId]/inventory/page.tsx` | New | Portal solo lectura |
| `src/middleware.ts` | Modified | Delegar `/sucursal/*` + gating rol admin |
| `src/middleware/branch.ts` | New | Rol + match branchId + GET-only |
| `src/app/actions/branch.ts` | Modified | `createBranch`/`deleteBranch` con Auth + credenciales |
| `src/components/ui/BranchManager.tsx` | Modified | Campo code + credenciales SweetAlert2, sin reload |
| `src/lib/supabase/server.ts` | Modified | `createServiceClient()` |
| `src/lib/utils/supabaseAuth.ts` | New | Helpers de usuario branch |
| `src/lib/validations/branch.ts`, `src/lib/validations/export.ts` | Modified/New | `code` único; schema wizard |
| `src/lib/utils/pdf.ts` | New | `generateProductsPdf` (pdf-lib) |
| `prisma/schema.prisma` + migración, `prisma/seed.ts` | Modified | `Branch.code` unique; seed "DEP" |
| Tests colocated `*.test.ts` | New | Unit + integración mockeada (patrón `label-print`) |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Gating admin por rol (nuevo) lockea al admin actual sin claims | Alta | Backfill de claim `admin` previo (script con service role); middleware falla-abierto para admin hasta migrar |
| Primera migración Prisma + `Branch.code` | Media | Verificar contra dev DB de Supabase; comparar `migrate-prod.sql` para prod |
| `getSales` sin paginación → sets grandes al buscar | Media | `take/skip` incluidos en el mismo cambio |
| `BranchManager` recarga página → pierde credenciales generadas | Media | Sin reload + SweetAlert2 con email/password |
| PDF con muchos productos → overflow de filas | Media | Tabla multipágina (page breaks) en pdf-lib |
| Criterios de integración/E2E de FASE4 no alcanzables (Playwright no instalado, DB mockeada) | Media | Fijar expectativa: unit + integración mockeada es el piso; documentar en verify |
| Claims fijos desde creación (cambios requieren `updateUserById`) | Baja | Aceptado; actualización de email queda como mejora futura |

## Rollback Plan

1. Revertir artefactos: `git checkout -- openspec/changes/fase4-ui-portal-export/`.
2. Si el gating rompe acceso admin: revertir `src/middleware.ts` + `src/middleware/branch.ts` a solo-login (los claims backfilled garantizan que nadie quede afuera).
3. Migración `Branch.code`: nueva migración drop column en dev; SQL manual en prod.
4. Si el aprovisionamiento falla: `createBranch`/`deleteBranch` vuelven a solo-DB (revertir `supabaseAuth.ts`, `server.ts`).
5. `npm run build` + `npm test` para confirmar sin regresiones.

## Dependencias

- `pdf-lib@1.17.1` ya instalado (patrón `label-print.ts`).
- `SUPABASE_SERVICE_ROLE_KEY` ya en `.env` (sin uso hoy); `@supabase/supabase-js` presente.
- Acceso admin al proyecto Supabase dev para backfill de claims y validación de migración.
- Sin dependencias npm nuevas obligatorias (stepper custom; SweetAlert2 instalado).

## Criterios de Éxito

- [ ] Buscador unificado filtra name/code/description/category; consulta vacía → listado completo (criterio 1).
- [ ] Búsqueda en ventas devuelve ventas con ≥1 producto que coincide (criterio 2).
- [ ] Dashboard: tarjetas cambian con periodo/sucursal; "Todas" = suma global (criterio 3).
- [ ] Portal: solo GET, 403 en otra sucursal u otro verbo; muestra inventario de la sucursal del usuario (criterios 4, 10).
- [ ] Botón "Exportar productos" abre wizard; paso 1 obligatorio; paso 2 solo stock>0 con checkboxes y contador; paso 3 bloqueado sin selección (criterios 5, 6).
- [ ] PDF válido con columnas Código|Nombre|Stock|Precio, stock = `BranchProduct.stock` de la sucursal, nombre `inventario-<branchCode>-<YYYYMMDD>.pdf` (criterios 7, 8).
- [ ] `createBranch` crea usuario Auth `branch_user` + credenciales mostradas una vez; `deleteBranch` elimina el usuario; password nunca en BD (criterios 9, 11).
- [ ] Server Actions nuevas/actualizadas con tests unitarios ≥80% cobertura (criterio 12).
- [ ] Tests de integración mockeados cubren wizard completo y ciclo de usuario de sucursal (criterio 13).
- [ ] Sin regresiones en compra, inventario, movimientos, dashboard (criterio 14); `npm run build` + `npm test` verdes.

## Ronda de Preguntas (modo interactivo)

1. **Backfill de roles**: ¿script de migración con service role que asigne `admin` al usuario actual, o ventana de transición con middleware falla-abierto? (Recomendado: backfill previo).
2. **Email de credenciales**: ¿se implementa envío (Edge/Resend) en esta fase o solo pantalla? (FASE4 lo marca opcional; recomendado: solo pantalla).
3. **Búsqueda de inventario**: ¿server-driven (param `search`) o client-side sobre lista cargada? (Recomendado: server-driven).
4. **Feature flags**: ¿tratar todo como siempre-activo o conectar `NEXT_PUBLIC_FEATURE_*`? (Recomendado: siempre-activo).
5. **Login del portal**: ¿misma instancia de Supabase con claim que distingue rol? (Recomendado: sí, mismo proyecto).

**Respondé las preguntas o indicá "proceder" para avanzar a specs con los supuestos recomendados.**
