# Design: Fix FASE 3 UI — Sucursales Nav + Venta Wizard

## Technical Approach

Two independent tracks per the deltas (`sale-with-branch`, `branch-management`):

1. **Navigation**: `BottomNav` keeps its 6 primary items and adds a "Más" item that opens an overflow bottom sheet containing "Sucursales" → `/sucursales`. "Más" is active when the pathname matches no primary item.
2. **Sale UX**: Replace the single-modal `AddSaleButton` with a 4-step `SaleWizard` bottom sheet. Branch choice is wizard-local state, pre-seeded from BranchContext but never written back (Q1/Q2 locked).
3. **Hardening**: `registerSale` moves stock validation inside the `$transaction` (conditional decrement); `deleteBranch` gains a stock guard; both expose stable error codes. Zod schemas become the single source in `src/lib/validations/sale.ts`; pure stock utils land in `src/lib/utils/stock.ts`.

## Architecture Decisions

| Decision | Options | Tradeoff | Decision |
|---|---|---|---|
| Wizard state | (A) local `useState`, ephemeral; (B) mutate `BranchContext.setBranchId`; (C) URL state | B persists `preferredBranch` and re-filters every screen; C is heavyweight | A — local state, reset on close; seeded from context `branchId` at open |
| BranchSelector | (A) additive controlled `value`/`onChange`; (B) new `BranchPicker`; (C) force all consumers controlled | B duplicates dropdown code; C breaks existing consumers and the /ventas filter | A — uncontrolled path untouched |
| Atomic stock | (A) in-tx `updateMany({ stock: { gte: qty } })` + count check; (B) existing outside-tx pre-check + upsert negative guard; (C) row locks | B is a TOCTOU race (spec: concurrent oversell); C needs raw SQL | A — guard in `where`; count mismatch → throw → full rollback |
| Más vs 7th item | (A) "Más" overflow sheet; (B) 7th primary item | B crowds small screens (Q3 rejected) | A — active by exclusion of primary routes |
| Schema source | (A) import from `lib/validations/sale.ts`; (B) keep inline duplicate | B drifts (already drifted: `z.coerce` vs `z.number`) | A — delete inline, import canonical |

**Error contract** — additive `{ success: false, error: string, code?: string }`; clients map `code` → Spanish message. Codes: `INSUFFICIENT_BRANCH_STOCK`, `PRODUCT_NOT_FOUND`, `BRANCH_INVALID` (registerSale); `HAS_STOCK`, `HAS_DEPENDENT_DATA`, `DEFAULT_BRANCH` (deleteBranch).

## Data Flow

```
SaleWizard ──registerSale(items, branchId, customerId, paymentMethod, cash, transfer)──▶ sale.ts
                                                                  │ zod parse (imported) │ branch active? → BRANCH_INVALID
                                                                  ▼
                                                     prisma.$transaction
                                                     ├─ updateMany BranchInventory (where stock >= qty)
                                                     │    count < lines → throw INSUFFICIENT_BRANCH_STOCK
                                                     ├─ sale.create (paid/pending via computePayment)
                                                     ├─ saleItem.createMany
                                                     └─ customer.totalBalance += pending (if customer)
                                                                  │
                                      revalidatePath(/ventas,/inventario,/clientes)
                                                                  │
                    router.refresh() ◀──── success ───────────────┘ → Swal "Venta registrada", close
```

## UI Flow — Wizard Steps

| Step | Content | Advance gate |
|---|---|---|
| 1 Sucursal | Controlled BranchSelector (active branches only); context branch pre-selected | `branchId != null` |
| 2 Productos | `ProductSearch` scoped to wizard branch (existing `branchId` prop) + rows (price, qty, live subtotal, add/remove) | ≥1 complete row; `validateSaleLines` flags client-side |
| 3 Pago | Method pills; MIXTO → cash + transfer inputs; customer dropdown (Cliente Anónimo default) | schema valid (MIXTO requires cash+transfer > 0) |
| 4 Confirmación | Summary (branch, items, total, paid, pending) + "Confirmar Venta"; inline error on failure | submit; stays open on error, back to step 2 allowed |

```
next() = canAdvance(currentStep) ? setStep(step + 1)
        : setStepError("Agregá al menos un producto")   // step 2 message; per-step messages otherwise
canAdvance = step===1 ? wizardBranch!=null
           : step===2 ? items.length>0 && items.every(i=>i.productId && qty>=1)
           : step===3 ? paymentValid()
```

Empty DB (`products.length === 0`): "No hay productos registrados. Primero creá un producto en la sección Productos." — no advance past step 1.

## Component Architecture

```
VentasPage (client)
├── BranchSelector (uncontrolled — global filter, unchanged)
├── SalesList
└── SaleWizard (products prop; customers fetched on open)
    ├── StepIndicator (1–4; active #ff385c)
    ├── StepSucursal ── BranchSelector value={wizardBranch} onChange (controlled)
    ├── StepProductos ── ProductSearch (modal, branchId=wizardBranch) + row list
    ├── StepPago ── payment pills + customer select
    └── StepConfirmacion ── summary → registerSale
BottomNav └── Más item → MasMenu (bottom sheet; closes on outside tap / route change)
              └── Sucursales → /sucursales
```

`BranchManager`: delete icon → `Swal.fire` confirm ("¿Eliminar sucursal {name}?") → `deleteBranch` → Swal error/success; optimistic `list` update (existing state, no reload); id=1 keeps no delete control (already conditional).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/BottomNav.tsx` | Modify | "Más" item + `MasMenu` sheet; active when pathname outside primary set |
| `src/components/ui/BranchSelector.tsx` | Modify | Additive controlled mode; no context access when controlled |
| `src/app/ventas/components/SaleWizard.tsx` | Create | 4-step wizard; local state; Swal2 success/error |
| `src/app/ventas/components/AddSaleButton.tsx` | Delete | Superseded by SaleWizard |
| `src/app/ventas/components/SaleForm.tsx` | Delete | Dead legacy (unwired; calls stale action shape) |
| `src/app/ventas/page.tsx` | Modify | Wire SaleWizard; pass unfiltered products for empty-state gate |
| `src/app/actions/sale.ts` | Modify | In-tx conditional decrement; import schema; stable codes |
| `src/lib/validations/sale.ts` | Modify | Canonical schema (align `branchId` coercion); export codes/types |
| `src/lib/utils/stock.ts` | Create | `getBranchStock`, `validateSaleLines` (pure) |
| `src/app/actions/branch.ts` | Modify | Stock guard + `HAS_STOCK`/`HAS_DEPENDENT_DATA`/`DEFAULT_BRANCH` codes |
| `src/components/ui/BranchManager.tsx` | Modify | Swal2 confirm + error dialogs |

## Interfaces / Contracts

```ts
// BranchSelector — additive controlled mode
type BranchSelectorProps = Existing & { value?: number | null; onChange?: (id: number | null) => void };
// value !== undefined → render value, call onChange, never touch context/localStorage

// src/lib/utils/stock.ts (pure, unit-testable; NOT used for atomicity)
getBranchStock(branchId: number, productId: number): Promise<number>; // 0 when row absent
validateSaleLines(branchId: number, lines: { productId: number; quantity: number }[]):
  Promise<{ productId: number; available: number; requested: number; insufficient: boolean }[]>;

// ActionResult
type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: string };
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Step gating; payment defaults (EFECTIVO=total, TRANSFERENCIA=0, MIXTO inputs) | RTL on SaleWizard |
| Unit | Controlled BranchSelector — no context/localStorage writes | RTL + spy on `setBranchId` |
| Unit | `stock.ts` pure fns; zod schemas; `deleteBranch` guards; Más active state | Jest |
| Integration | registerSale atomicity: rollback, concurrent oversell, error codes | Mocked Prisma `$transaction` (extend `sale.branch.test.ts` pattern with `updateMany` mock) |
| E2E | Playwright mobile: FAB → wizard → sell to branch X; global filter unchanged; Más → /sucursales; delete confirm | Existing e2e harness |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-classification, or process-integration boundary. Routing is client-side Next `<Link>` navigation only; server actions are Prisma DB writes (no OS interaction). Rows (documentation-like paths, git selection, commit/push state, PR commands) all N/A by absence of those boundaries.

## Migration / Rollout

No schema change → no migration. Rollback: `git checkout` touched files; swap `SaleWizard` back to `AddSaleButton` in `ventas/page.tsx`.

## Open Questions

- [ ] Should "Más" also list existing secondary routes (`/categorias`, `/movimientos`)? Not in the locked delta — defer unless requested.
- [ ] `SaleForm.tsx` deletion flagged (dead code); confirm no external references before removing.
