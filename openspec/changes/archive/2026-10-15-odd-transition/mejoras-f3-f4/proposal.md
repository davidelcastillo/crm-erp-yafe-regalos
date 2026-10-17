# Proposal: Mejoras F3/F4 — 7 post-testing fixes

## Intent

Fix 7 Fase 3/4 testing issues: branch selector empty ~10 min post-login; ExportWizard "Expected object, received number"; /productos showing one branch's stock; MIXTO sale lacking cash/transfer inputs; export stock>0 filter (verify-only); admin chrome on the branch portal; cramped external inventory table on mobile.

## Scope

### In Scope
- **A (low risk)**: item 2 (ExportWizard `{ branchId }` + fix regression test), item 3 (sumStock + grid class), item 5 (verify-only), item 7 (responsive ExternalInventoryTable)
- **B (medium)**: item 1 (BranchProvider self-heal + fallback fetch), item 4 (MIXTO cash/transfer inputs in AddSaleButton AND SaleForm; no amountPaid)
- **C (chrome)**: item 6 (hide admin chrome on /sucursal/*)

### Out of Scope
- Route-group restructure; stock>0 filter on `getExternalBranchInventory`; loosening MIXTO refine/coercing action signatures; horizontal-scroll table

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `branch-management`: branch options MUST hydrate after auth (provider self-heal)
- `branch-export-pdf`: wizard SHALL call action with `{ branchId }`; stock>0 export verified
- `inventory-ui`: /productos SHALL show aggregated stock (sumStock) + grid
- `sale-with-branch`: MIXTO SHALL capture cashAmount/transferAmount in both forms
- `branch-external-portal`: portal without admin chrome; responsive table
- `app-navigation`: BottomNav (+Navbar pending Q1) hidden on /sucursal/*

## Approach

- **1**: BranchProvider sync effect — adopt non-empty initialBranches; fetch via refreshBranches() when empty on mount; don't clobber manual refresh or route-group reset.
- **2**: `getBranchProductsForExport({ branchId })`; fix `ExportWizard.test.tsx:112` to `{ branchId: 1 }`; optional action regression test.
- **3**: ProductCard uses `sumStock(product)`; add `grid` class to page container.
- **4**: conditional cash/transfer inputs on MIXTO in both forms; require one > 0; send only cashAmount/transferAmount; hide "Monto Pagado".
- **5**: verify only — action, wizard, and PDF already filter stock > 0.
- **6**: `usePathname().startsWith('/sucursal')` guard in BottomNav; Navbar via AppChrome wrapper or internal guard.
- **7**: `grid-cols-2 sm:grid-cols-[60px_1fr_80px_100px]` header+rows; name wraps; numerics right-aligned.

## Affected Areas

| Area | Impact | Change |
|---|---|---|
| src/lib/context/BranchContext.tsx | Modified | Self-heal + fallback fetch |
| src/app/inventario/components/ExportWizard.tsx (+test) | Modified | Signature fix |
| src/app/productos/components/ProductCard.tsx, page.tsx | Modified | sumStock + grid |
| src/app/ventas/* (AddSaleButton, SaleForm) | Modified | MIXTO split inputs |
| src/app/layout.tsx, BottomNav/Navbar | Modified | /sucursal/* guard |
| src/lib/components/ExternalInventoryTable.tsx | Modified | Responsive grid |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Item 1 extra DB calls per nav | Med | Mount-guard; extend BranchContext.test |
| Item 2 stale test → CI red | Med | Update test same commit |
| Item 4 amountPaid conflict | Low | Never send amountPaid for MIXTO |
| Item 6 scope creep | Low | Confirm Q1 |

## Rollback Plan

Per-item revert, all independent; no DB/schema changes. Item 1: remove effect. Item 2: revert call+test. Items 3/7: revert components. Item 4: remove inputs. Item 6: remove guard.

## Dependencies

None. Item 5 needs only manual verification.

## Success Criteria

- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` green
- [ ] Item 5 verified manually (no code diff)
- [ ] Each item's scenario manually verifiable (per exploration)

## Open Questions (question round)

- **Q1 (item 6)**: hide ONLY BottomNav or also Navbar on /sucursal/*? User asked BottomNav only; exploration recommends both (standalone portal).
- **Q2 (item 3)**: zero-inventory label — "0 uds" (sumStock default) or "—"?
