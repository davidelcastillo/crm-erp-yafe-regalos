# Proposal: Fix FASE 3 UI — Sucursales Nav + Venta Wizard

## Intent

FASE 3 left two UX gaps: `/sucursales` CRUD exists but is unreachable (BottomNav has 6 items, no Sucursales), and the venta modal renders everything at once while silently using the global BranchContext branch — no explicit, required choice. This change adds the nav link, converts the modal into a 4-step wizard that forces branch selection first, decouples each sale from the global context, and hardens `registerSale` for atomic stock updates.

## Scope

### In Scope
- BottomNav: add "Sucursales" item → `/sucursales` (active state on pathname match)
- Replace `AddSaleButton` single modal with 4-step `SaleWizard` bottom sheet (Sucursal → Productos → Pago → Confirmación), reusing `ProductSearch`
- Per-sale branch state; `BranchSelector` gains controlled `value`/`onChange` mode that does NOT touch BranchContext/localStorage
- `registerSale`: move stock validation inside the `$transaction` (conditional decrement), generic errors
- Stock utils (`getBranchStock`, `validateSaleLines`), Zod updates, unit + integration tests

### Out of Scope
- Branch CRUD rework (already implemented)
- SweetAlert2 delete confirmation for branches (existing delta spec — pending decision, see Q4)
- Portal externo `/sucursal/[branchId]/inventory`; payment/customer logic beyond wizard wiring

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `branch-management`: BottomNav link + active state (delta spec exists in `openspec/changes/fix-fase3-ui/specs/`)
- `sale-with-branch`: wizard steps, branch-first gating, per-sale branch, atomic stock decrement (delta spec exists)

## Approach

1. BottomNav: add 7th item + icon; existing `pathname.startsWith` logic covers active state.
2. BranchSelector: additive controlled mode; context-based default unchanged for existing consumers.
3. SaleWizard: local `branchId` state (optional seed from context), step gating — no advance without branch, ≥1 product, valid payment; feed local branchId to `ProductSearch` and `registerSale`; never call context `setBranchId`.
4. registerSale: replace outside-tx pre-check with in-tx `updateMany` guarded by `stock: { gte: qty }`; count mismatch → throw → rollback.
5. Tests: unit (step gating, controlled selector, stock utils, sale action); integration (full wizard + stock invariant).

## Alternatives

| Option | Verdict |
|---|---|
| A — Controlled selector + local wizard state | ✅ Recommended; sale choice never leaks into global filter |
| B — Wizard mutates context `setBranchId` | ❌ Persists to localStorage, changes all screens |
| C — Full-page route instead of bottom sheet | ❌ Heavier, loses FAB quick-entry |
| Atomicity: conditional in-tx decrement | ✅ vs outside-tx pre-check (TOCTOU race) |

## Affected Areas

| Area | Impact |
|---|---|
| `src/components/BottomNav.tsx` | Modified (7th item) |
| `src/components/ui/BranchSelector.tsx` | Modified (controlled mode) |
| `src/app/ventas/components/AddSaleButton.tsx` | Replaced by `SaleWizard.tsx` |
| `src/app/actions/sale.ts` | Modified (in-tx stock check) |
| `src/lib/utils/stock.ts` | New |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| 7 nav items crowd small screens | Med | tight layout; Playwright mobile check |
| Selector refactor breaks consumers | Med | additive mode, default unchanged |
| Concurrent oversell | Low | in-tx conditional decrement + rollback |

## Rollback Plan

Revert touched files via `git checkout`; swap `SaleWizard` back to `AddSaleButton` in `ventas/page.tsx`. No schema change → no migration.

## Dependencies

- None new (Prisma, SweetAlert2, BranchContext, ProductSearch exist).

## Success Criteria

- [ ] BottomNav shows active Sucursales link; navigation works
- [ ] Wizard blocks advance without branch; quantity validated against selected-branch stock
- [ ] Selling to branch X never changes global filter or `preferredBranch`
- [ ] `registerSale` atomic: failure rolls back sale + items + stock; no oversell
- [ ] ≥80% unit coverage on actions; integration verifies stock invariant; zero regressions

## Open Questions

1. Step 1: pre-select the context branch, or force explicit empty choice? (delta spec assumes pre-select)
2. Persist the wizard's branch to global `preferredBranch`, or per-sale only? (I recommend per-sale only)
3. 7 BottomNav items acceptable, or move Sucursales to a "Más" menu?
4. Include branch-delete SweetAlert2 confirmation (existing delta spec) in this change or defer?
