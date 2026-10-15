# Design: Mejoras F3/F4 — 7 post-testing fixes

## Technical Approach

Seven independent per-item fixes, no shared state except Item 1. Item 5 is verify-only. STRICT TDD (config.yaml): every item with a test surface gets a RED test first. Server-side MIXTO semantics in `registerSale` (`sale.ts:19-36,78-90`) are **already implemented and green** (`sale.test.ts:317-373` uses `cashAmount`/`transferAmount` and asserts derived `amountPaid`) — Item 4 is UI-only. Note: spec names `createSaleWithBranch` but the action is `registerSale`; treat as naming drift, do not rename (out of scope).

## Architecture Decisions

| # | Option | Tradeoff | Decision |
|---|--------|----------|----------|
| D1 | Item 1 self-heal vs hard-nav vs client-only fetch vs route groups | Hard-nav fixes only login; client-only loses server fast-path; route groups = folder churn | **Sync effect + mount-guarded fallback** in `BranchProvider` (exploration rec. 1) |
| D2 | Item 1 clobber guard: content-compare vs reference-compare vs none | Reference-compare fails on same-content re-renders; none breaks "manual refresh wins" | **JSON content-compare vs `lastAppliedRef`** — stale identical props skipped, genuine changes applied |
| D3 | Item 4 single "Monto Pagado" for MIXTO vs split inputs | Single input contradicts `computePayment`; split matches user mental model | **Conditional cash/transfer inputs; omit `amountPaid` key for MIXTO** |
| D4 | Item 6: guard in BottomNav only vs AppChrome wrapper vs route group | Wrapper adds indirection; route group = churn; spec fixes Navbar = visible | **Pathname guard inside `BottomNav` only** (`app-navigation` spec) |
| D5 | Item 7: responsive 2-col grid vs vertical stack vs h-scroll | Stack = taller rows; h-scroll = the reported bug | **Mobile 2-col grid + `sm:` 4-col mirror** (spec scenario) |

## Data Flow (Item 1)

```
login (pre-auth)        post-login layout re-render
getBranchOptions → [] ──────────► getBranchOptions → [A,B]
        │                                    │
        ▼                                    ▼
BranchProvider mount                    sync effect: content differs
  mountedRef guard (1 fetch max) ──► setBranches([A,B]) + lastAppliedRef
        │  (empty → refreshBranches)
        ▼
branches[] → selector; route-group reset effect (branchId only) untouched
```

## File Changes

| File | Action | Work unit |
|------|--------|-----------|
| `src/lib/context/BranchContext.tsx` | Modify | B — sync effect + mount-guarded fallback |
| `src/lib/context/BranchContext.test.tsx` | Modify | B — 4 new RED scenarios |
| `src/app/inventario/components/ExportWizard.tsx:52` | Modify | A — `getBranchProductsForExport({ branchId })` |
| `src/app/inventario/components/ExportWizard.test.tsx:112` | Modify | A — assert `{ branchId: 1 }` (same commit) |
| `src/app/actions/inventory.test.ts` | Create | A — RED: bare number rejected pre-prisma |
| `src/app/productos/components/ProductCard.tsx:29-36` | Modify | A — `sumStock(product)`, "0 uds" |
| `src/app/productos/components/ProductCard.test.tsx` | Create | A — 3 stock scenarios |
| `src/app/productos/page.tsx:107` | Modify | A — add base `grid` class |
| `src/app/ventas/components/AddSaleButton.tsx` | Modify | B — MIXTO inputs, conditional payload |
| `src/app/ventas/components/SaleForm.tsx` | Modify | B — MIXTO inputs + client validation |
| `src/app/ventas/components/AddSaleButton.test.tsx`, `SaleForm.test.tsx` | Create | B — MIXTO render/submit RED |
| `src/components/BottomNav.tsx:62` | Modify | C — `if (pathname.startsWith("/sucursal")) return null` |
| `src/components/BottomNav.test.ts` | Modify | C — portal/internals scenarios |
| `src/lib/components/ExternalInventoryTable.tsx` | Modify | A — responsive 2-col mobile grid |

Item 5: no files — manual verify only.

## Interfaces / Contracts

Item 1 effect (in `BranchProvider`):

```tsx
const lastAppliedRef = useRef<BranchOption[]>(initialBranches);
const mountedRef = useRef(false);

useEffect(() => {                       // deps: [initialBranches]
  if (initialBranches.length === 0) return;
  if (JSON.stringify(lastAppliedRef.current) === JSON.stringify(initialBranches)) return;
  setBranches(initialBranches);         // adopt non-empty prop (post-login)
  lastAppliedRef.current = initialBranches;
}, [initialBranches]);

useEffect(() => {                       // mount-only: empty-deps + guard (StrictMode-safe)
  if (mountedRef.current) return;
  mountedRef.current = true;
  if (branches.length === 0) void refreshBranches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Never touches `branchId` — coexists with route-group reset (`BranchContext.tsx:63-69`). `refreshBranches` does not update `lastAppliedRef`, so manual refresh wins over stale props.

Item 4 payload (AddSaleButton `:160-170`): `paymentMethod === "MIXTO"` → `{ items, branchId, customerId, paymentMethod, cashAmount, transferAmount }` (no `amountPaid`); else current shape. Client check: `(cash||0)+(transfer||0) > 0`, else refine message. SaleForm: add `cashAmount`/`transferAmount` to payload; it never sent `amountPaid`.

Item 7 row (code+name stacked / stock+price stacked on mobile; `sm:` 4-col):

```tsx
<div className="grid grid-cols-2 sm:grid-cols-[60px_1fr_80px_100px] text-sm items-baseline">
  <div className="sm:hidden flex flex-col min-w-0">
    <span className="font-mono">{item.code}</span>
    <span className="break-words text-gray-800">{item.name}</span>  {/* no truncate */}
  </div>
  <div className="hidden sm:block font-mono">{item.code}</div>
  <div className="hidden sm:block break-words">{item.name}</div>
  <div className="sm:hidden text-end">
    <div>{item.stock} uds</div><div className="font-medium">${item.price.toFixed(2)}</div>
  </div>
  <div className="hidden sm:block text-center">{item.stock}</div>
  <div className="hidden sm:block text-end font-medium">${item.price.toFixed(2)}</div>
</div>
```

Header mirrors: mobile cells "Producto" / "Stock / Precio"; `sm:` 4 columns. Rows keep `px-4 py-3`.

## Testing Strategy (RED-first)

| Layer | What | Approach |
|-------|------|----------|
| Unit (B) | `BranchContext.test.tsx`: hydration after login; fallback fetch once; no fetch per nav; manual-refresh wins | `npx jest BranchContext` |
| Unit (A) | `ExportWizard.test.tsx:112` → `{ branchId: 1 }`; new `inventory.test.ts` rejects bare number; `ProductCard.test.tsx` 15/0/7 uds; `ExternalInventoryTable.test.tsx` mobile/desktop cells | `npx jest ExportWizard inventory ProductCard ExternalInventoryTable` |
| Unit (B) | New `AddSaleButton.test.tsx`/`SaleForm.test.tsx`: MIXTO shows inputs, hides Monto Pagado (AddSaleButton), zero-split rejected, payload has no `amountPaid` | `npx jest AddSaleButton SaleForm sale` |
| Unit (C) | `BottomNav.test.ts`: null on `/sucursal/5/inventory` + portal login; renders on `/ventas` | `npx jest BottomNav` |
| Gate | `npm test` + `npx tsc --noEmit` + `npm run lint` + `npm run build` | full suite per work unit |

`sale.test.ts` MIXTO assertions need **no change** (already `cashAmount`/`transferAmount`-based).

## Work Units

- **A (2,3,5,7)** — 9 files (5 modified, 3 created, 1 verify-only). Rollback: revert wizard/productos/table files; no shared surface.
- **B (1,4)** — 6 files (2 context, 4 sale). Rollback: remove effect + inputs independently; `registerSale` untouched.
- **C (6)** — 2 files. Rollback: delete guard line.

## Threat Matrix

N/A — no routing/auth-boundary, shell, subprocess, VCS/PR automation, executable-file, or process-integration change. Item 6 alters only client chrome visibility; `proxy.ts`/`decideBranchAccess` untouched.

## Migration / Rollout

No migration. No feature flags. Per-item independent revert (proposal rollback plan).

## Open Questions

- [ ] Spec `sale-with-branch` names `createSaleWithBranch`; code has `registerSale` (orphaned `SaleForm` also sends a payload `registerSale`'s schema rejects). Recommend follow-up change to rename/sync spec or add the single-product action — out of scope here.
