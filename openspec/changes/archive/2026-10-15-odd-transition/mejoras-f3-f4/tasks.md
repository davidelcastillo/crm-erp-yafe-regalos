# Tasks: Mejoras F3/F4 — 7 post-testing fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~470–600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1(A) → 2(B) → 3(C) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test | Runtime harness | Rollback |
|------|------|-----------|--------------|-----------------|----------|
| A (2,3,5,7) | Export call fix; sumStock grid; responsive table | PR 1 (base = tracker) | `npx jest ExportWizard ProductCard inventory ExternalInventoryTable` | `npm run dev`: PDF export ok; /productos multi-col; portal 360px | Revert wizard/productos/table files+tests |
| B (1,4) | Self-heal; MIXTO split inputs (both forms) | PR 2 (base = PR 1) | `npx jest BranchContext AddSaleButton SaleForm sale` | `npm run dev`: selector fills post-login; MIXTO sale both forms | Remove sync effect + MIXTO inputs; registerSale untouched |
| C (6) | Hide BottomNav on /sucursal/* | PR 3 (base = PR 2) | `npx jest BottomNav` | `npm run dev`: /sucursal/5/inventory → no BottomNav, Navbar kept | Delete guard + revert test |

## Phase 1: Unit A — Export & inventory fixes (2,3,5,7)

- [x] 1.1 RED: `src/app/actions/inventory.test.ts` — bare number `getBranchProductsForExport(1)` rejected
- [x] 1.2 RED: create `ProductCard.test.tsx` — 15 uds (2 branches), "0 uds" empty, 7 uds scoped
- [x] 1.3 RED: create `src/lib/components/ExternalInventoryTable.test.tsx` — mobile 2-col wrap/right-align, sm+ 4-col
- [x] 1.4 GREEN: `ExportWizard.tsx:52` → `getBranchProductsForExport({ branchId })`; test `:112` → `{ branchId: 1 }` same commit
- [x] 1.5 GREEN: `ProductCard.tsx` → `sumStock(product)` + "0 uds"; `productos/page.tsx:107` add `grid`
- [x] 1.6 GREEN: `ExternalInventoryTable.tsx` → `grid-cols-2 sm:grid-cols-[60px_1fr_80px_100px]` + `break-words`, keep `py-3`
- [x] 1.7 VERIFY (no code): item 5 — export already filters stock 0; do NOT touch `getExternalBranchInventory`

## Phase 2: Unit B — Branch self-heal & MIXTO sales (1,4)

- [x] 2.1 RED: extend `src/lib/context/BranchContext.test.tsx` — hydration, fallback once, no fetch per nav, refresh wins
- [x] 2.2 RED: create `AddSaleButton.test.tsx`+`SaleForm.test.tsx` — MIXTO inputs, hidden "Monto Pagado", zero-split rejected, no `amountPaid`
- [x] 2.3 GREEN: `BranchContext.tsx` — `lastAppliedRef`+`mountedRef` effects (adopt prop; mount-guarded `refreshBranches()`); keep `branchId` reset
- [x] 2.4 GREEN: `AddSaleButton.tsx:160-170` — MIXTO payload `{ items, branchId, customerId, paymentMethod, cashAmount, transferAmount }`, omit `amountPaid`
- [x] 2.5 GREEN: `SaleForm.tsx:52-58` — add cash/transfer inputs + payload (never `amountPaid`); client check `(cash||0)+(transfer||0) > 0`

## Phase 3: Unit C — Navigation chrome (6)

- [x] 3.1 RED: extend `src/components/BottomNav.test.ts` — null on `/sucursal/5/inventory` + login; renders on `/ventas`
- [x] 3.2 GREEN: `BottomNav.tsx:62` — `if (pathname.startsWith("/sucursal")) return null`; Navbar untouched

## Phase 4: Verification gate

- [x] 4.1 Full gate per unit: `npm test` + `npx tsc --noEmit` + `npm run lint` + `npm run build`
- [ ] 4.2 Manual (dev): selector fills post-login; MIXTO sale both forms; portal table 360px; /productos grid
- [x] 4.3 Record item 5 verify result; note `createSaleWithBranch`/`registerSale` drift as follow-up
