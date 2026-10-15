# Tasks: Fix FASE 3 UI — Sucursales Nav + Venta Wizard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300–1600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Más menu + Sucursales nav + delete confirm | PR 1 | `npx jest src/app/actions/branch.test.ts src/components/BottomNav.test.tsx` | Playwright: Más → /sucursales; delete confirm | Revert BottomNav.tsx, BranchManager.tsx, branch.ts |
| 2 | stock utils + canonical schema + controlled BranchSelector | PR 2 | `npx jest src/lib/utils/stock.test.ts src/lib/validations/__tests__/validations.test.ts src/components/ui/BranchSelector.test.tsx` | `npm test` (additive, no behavior change) | Revert stock.ts, validations/sale.ts, BranchSelector.tsx |
| 3 | SaleWizard + atomic registerSale + cleanup | PR 3 | `npx jest src/app/actions/sale.branch.test.ts src/app/ventas/components/SaleWizard.test.tsx` | Playwright: FAB → wizard → sell to branch X, filter unchanged | Revert wizard/page/sale.ts; restore AddSaleButton |

## Phase 1: Foundation (PR 2)

- [ ] 1.1 Create `src/lib/utils/stock.ts`: pure `getBranchStock` (0 on absent row), `validateSaleLines` (per-line `insufficient` flag)
- [ ] 1.2 Add `src/lib/utils/stock.test.ts`: absent row → 0; qty 5 vs stock 2 → insufficient; all sufficient → none flagged
- [ ] 1.3 Move `saleItemSchema`/`registerSaleSchema` to `src/lib/validations/sale.ts`: branchId required ("La sucursal es requerida"), items non-empty, qty ≥1, MIXTO cash+transfer > 0; export `ActionResult` + error codes
- [ ] 1.4 Extend `src/lib/validations/__tests__/validations.test.ts`: missing branchId, empty items, qty 0, MIXTO zero amounts all rejected
- [ ] 1.5 `BranchSelector.tsx`: additive `value?: number | null` + `onChange`; controlled mode renders value, calls onChange only, never `setBranchId`
- [ ] 1.6 Add `BranchSelector.test.tsx`: controlled render writes no context/localStorage; selection fires onChange only; uncontrolled unchanged

## Phase 2: Navigation + Branch Delete (PR 1)

- [ ] 2.1 `BottomNav.tsx`: add "Más" item after Clientes; active when pathname outside primary set
- [ ] 2.2 Add `MasMenu` sheet (anchored above nav, `rounded-t-3xl`): "Sucursales" → `/sucursales`; closes on outside tap + route change
- [ ] 2.3 Add `BottomNav.test.tsx`: Más active on /sucursales; menu opens/closes
- [ ] 2.4 `src/app/actions/branch.ts`: add BranchInventory stock guard to `deleteBranch`; stable codes `HAS_STOCK`, `HAS_DEPENDENT_DATA`, `DEFAULT_BRANCH`
- [ ] 2.5 Extend `src/app/actions/branch.test.ts`: stock>0 → HAS_STOCK; tx history → HAS_DEPENDENT_DATA; empty → success; id=1 rejected
- [ ] 2.6 `BranchManager.tsx`: Swal2 confirm "¿Eliminar sucursal {name}?" (red Eliminar / Cancelar); map codes → Swal error; optimistic list update, no reload

## Phase 3: Wizard + Atomic Sale (PR 3)

- [ ] 3.1 `src/app/actions/sale.ts`: import schemas from `validations/sale.ts` (delete inline); branch-active check → `BRANCH_INVALID`; product check in-tx → `PRODUCT_NOT_FOUND`
- [ ] 3.2 `src/app/actions/sale.ts`: replace upsert+negative guard with in-tx `updateMany({ where: { branchId_productId, stock: { gte: qty } } })`; count<lines → throw `INSUFFICIENT_BRANCH_STOCK` (full rollback)
- [ ] 3.3 Extend `src/app/actions/sale.branch.test.ts` (`updateMany` mock): cash success, insufficient, transfer pending, MIXTO, concurrent oversell, partial rollback, not-found, invalid branch
- [ ] 3.4 Create `SaleWizard.tsx`: bottom sheet + StepIndicator (active `#ff385c`); local `branchId` seeded from BranchContext at open, never `setBranchId`
- [ ] 3.5 Implement steps: 1 Sucursal (controlled selector, active branches only); 2 Productos (ProductSearch `branchId=wizardBranch`, rows price/qty/subtotal add/remove); 3 Pago (pills, MIXTO cash+transfer, customer dropdown); 4 Confirmación (summary + Confirmar Venta)
- [ ] 3.6 Step gating: `canAdvance` per step; "Agregá al menos un producto"; empty-DB message blocks past step 1; Anterior preserves state; X closes without persisting
- [ ] 3.7 `ventas/page.tsx`: wire SaleWizard to FAB, pass unfiltered products; delete `AddSaleButton.tsx` + `SaleForm.tsx` (verify no external refs first)
- [ ] 3.8 Add `SaleWizard.test.tsx`: gating; payment defaults (EFECTIVO=total, TRANSFERENCIA=0, MIXTO inputs); submit calls registerSale; error recovery stays open

## Phase 4: Verification + Docs

- [ ] 4.1 Run `npm test` + `npm run test:e2e`; zero regressions; ≥80% coverage on registerSale, stock utils, step gating
- [ ] 4.2 Update docs/tests referencing `AddSaleButton`/`SaleForm` → `SaleWizard`
