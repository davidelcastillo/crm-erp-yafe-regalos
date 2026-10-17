# Cierre administrativo de SDD — 2026-10-15

Todos los ciclos SDD quedan **cerrados por transición a ODD**, no por verificación nueva. Este manifiesto registra dónde queda cada uno y qué comprobación seguía pendiente cuando se retiró el proceso. Los archivos originales se conservan **sin editar**; la columna de estado no reemplaza su contenido.

`closeType`:

- `admin` — trabajo implementado, cerrado administrativamente; sin informe de verificación.
- `admin-partial` — implementado en su mayor parte; quedaba una comprobación manual abierta.
- `admin-unverified` — el checklist no acredita implementación; requiere reconciliación antes de reutilizarlo.
- `admin-abandoned` — nunca se aplicó.
- `pre-archived` — ya archivado por SDD antes de esta transición, con su propio registro de verificación de la época; no re-verificado en este cierre.

## Ciclos archivados antes de la transición

| Cambio | Carpeta | closeType | Evidencia | Pendiente conservado |
|---|---|---|---|---|
| Fase 1 — Seguridad Core | `2026-07-29-fase1-seguridad-core/fase1-seguridad-core/` | `pre-archived` | Su `archive-report.md` declara PASS con warnings: 16/16 requisitos y unit tests de Zod en verde; la suite completa figuraba en FAIL **pre-existente** | Lo que el propio informe deja abierto: sin integración/E2E, monitoreo de bundle y roles granulares para fases posteriores |
| HU2 — Branch Management | `2026-07-30-HU2/` | `pre-archived` | `tasks.md` con 31 tareas marcadas y 0 abiertas, más diseño, propuesta y 5 specs | Sin informe de archivo propio; la verificación consta solo por el checklist |

Estos dos ciclos no se movieron ni se editaron: ya estaban en `openspec/changes/archive/`. Se registran aquí para cumplir el cierre de **todos** los ciclos, incluidos los ya archivados.

## Ciclos cerrados en esta transición

| Cambio | Carpeta | closeType | Evidencia al cerrar | Pendiente conservado |
|---|---|---|---|---|
| FASE3 | `2026-10-15-odd-transition/FASE3/` | `admin-abandoned` | Carpeta sin archivos | Ninguno; no hay artefacto que reconciliar |
| HU6 | `.../HU6/` + `sdd-result.json` | `admin-unverified` | `tasks.md` con `Status: Pending` y `[x]` contradictorios; falta `specs/label-printing/` | Reconciliar el checklist y la spec ausente; el `sdd-result.json` se movió junto al cambio |
| HU7 | `.../HU7/` | `admin-abandoned` | Todas las tareas sin marcar; «Ready for sdd-apply» | Ninguno: no se inició |
| auth-password-reset-recordarme | `.../auth-password-reset-recordarme/` | `admin` | Marcadores `✅ (PR3)` en línea; sin informe de verificación | Checklist manual 5.1 de Supabase |
| fase3-inventory-branch-interfaces | `.../fase3-inventory-branch-interfaces/` | `admin` | Todas las tareas marcadas y cabecera reconciliada | Ninguno declarado |
| fase4-ui-portal-export | `.../fase4-ui-portal-export/` | `admin` | Fases 1.1–5.3 marcadas | Sin informe de verificación |
| fix-fase3-bugs | `.../fix-fase3-bugs/` | `admin` | Solo `proposal.md`; corrección mínima de dos líneas | Ninguno |
| fix-fase3-correcciones | `.../fix-fase3-correcciones/` | `admin-unverified` | Fases 1–2 sin checkbox; 3.1–3.8 y 4.x abiertas; cierre contradictorio | Reconciliar las fases 3–4 antes de reutilizar |
| fix-fase3-ui | `.../fix-fase3-ui/` | `admin-abandoned` | 16 tareas sin marcar; «Decision needed before apply: Yes» | Decisión de producto que nunca se tomó |
| fix-fase4-correcciones | `.../fix-fase4-correcciones/` | `admin-partial` | Fases 1–4 y 5.1 marcadas | **5.2** manual: login de portal, `deleteBranch` con ID no UUID, reintentos y N+1. Las tareas de login de portal fueron reemplazadas por el catálogo público |
| fix-filtros-inventario-modales | `.../fix-filtros-inventario-modales/` | `admin` | Estado `✅ completado (PR2)` | Ninguno |
| mejoras-f3-f4 | `.../mejoras-f3-f4/` | `admin-partial` | Todas marcadas salvo 4.2 | **4.2** manual: selector post-login, MIXTO, portal a 360 px, grilla de productos |
| portal-externo-publico-isPublic | `.../portal-externo-publico-isPublic/` | `admin-partial` | `verify-report.md`: PASS con advertencias, 34/34 requisitos y 32/32 escenarios (ejecución histórica, no repetida) | **4.2** manual del flujo público; marcar obsoleta la spec `branch-portal-login-ui`; deuda histórica de RLS sin revalidar |
| unificar-productos-inventario | `.../unificar-productos-inventario/` | `admin` | Fases marcadas en prosa, sin checkbox y **sin informe de verificación en disco**; su contenido está en `main` | Reconciliar el checklist si se retoma; no hay verificación registrada que reutilizar |

Comprobaciones transversales conservadas, ninguna ejecutada por este cierre:

1. Los pendientes manuales 4.2 y 5.2 citados arriba.
2. Estado actual de RLS y permisos de la Data API de Supabase: advertencia histórica, sin verificación vigente.
3. Tests contra base real (`branchAdminService.test.ts`) y ausencia de E2E declarado: revisar aislamiento antes de ejecutar la suite.

## Notas de archivo

- `config.yaml` se movió junto al archivo: describía el proceso SDD retirado (rutas de `openspec` y TDD estricto de SDD), no las reglas vigentes. Las referencias textuales a «config.yaml» dentro de los documentos archivados se conservan tal como estaban.
- `specs/` permanece en `openspec/specs/` como antecedente documental; puede describir comportamientos luego reemplazados (por ejemplo, el login de sucursal anterior al catálogo público opt-in).
- El cambio `fix-fase4-correcciones` contiene tareas de login de portal que `portal-externo-publico-isPublic` reemplazó después. Se conservan sin editar para no borrar historia.
- Reutilizar cualquiera de estos artefactos exige una unidad ODD nueva con su propio alcance; estar cerrado aquí no autoriza a ejecutarlos.
