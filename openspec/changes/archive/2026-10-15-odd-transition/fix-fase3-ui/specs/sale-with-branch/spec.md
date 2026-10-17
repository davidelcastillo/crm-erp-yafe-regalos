# Delta for Sale with Branch

> Decisions locked from the open questions:
> - Q1: Step 1 pre-selects the session branch from BranchContext.
> - Q2: The wizard branch is per-sale only and NEVER persists to `preferredBranch` (no `setBranchId`).
> - Q3: The Sucursales nav item lives in a "Más" overflow menu (see branch-management delta).
> - Q4: SweetAlert2 branch-delete confirmation is in scope (see branch-management delta).

## RENAMED Requirements

### Requirement: SaleForm Component → SaleWizard Component

(Reason: the single-modal sale form is replaced by a 4-step wizard that forces branch selection first and keeps branch state local to the sale)
(Migration: remove `AddSaleButton` from `src/app/ventas/page.tsx` and wire `SaleWizard` to the "+" FAB; update references in tests and docs)

### Requirement: createSaleWithBranch Server Action → registerSale Server Action

(Reason: the action actually exported by `src/app/actions/sale.ts` is `registerSale`; `createSaleWithBranch` never landed in code)
(Migration: tests and docs reference `registerSale`; existing `/ventas` callers are unaffected because the exported name stays `registerSale`)

## MODIFIED Requirements

### Requirement: SaleWizard Component

The system MUST replace the single-modal `AddSaleButton` with a 4-step wizard component (`SaleWizard`) rendered as a bottom sheet with a step indicator. Steps SHALL be:

1. **Sucursal** — required branch selection reusing `BranchSelector` in controlled mode. The BranchContext session branch SHALL be pre-selected (Q1); changing it SHALL NOT write to BranchContext or `localStorage.preferredBranch` (Q2).
2. **Productos** — `ProductSearch` scoped to the wizard branch, plus multi-item rows with per-item price and quantity, live subtotals, add/remove row controls.
3. **Pago** — payment method selector (EFECTIVO, TRANSFERENCIA, MIXTO), optional customer, and amount-paid inputs (MIXTO shows cash + transfer inputs).
4. **Confirmación** — full order summary (branch name, items, payment method, total, amount paid, pending balance) and a "Confirmar Venta" submit button.

The wizard SHALL block forward navigation until the current step is valid: step 1 requires a selected branch, step 2 requires ≥1 complete product, step 3 requires a valid payment. Navigation SHALL use "Anterior" / "Siguiente" buttons, and each step SHALL validate before advancing. The wizard SHALL submit via `registerSale` with the wizard-local `branchId`; on success it SHALL show a SweetAlert2 success ("Venta registrada"), close, and refresh the sales list. On error it SHALL stay open and surface the error in step 4.
(Previously: a single modal rendering all fields at once, silently using the BranchContext branch for stock checks and sale attribution)

#### Scenario: Render step 1 — branch selection

- GIVEN the user taps the "+" FAB on /ventas
- WHEN the SaleWizard opens
- THEN step 1 SHALL render with the step indicator showing "1" as active
- AND a branch dropdown SHALL display only active branches
- AND "Siguiente" SHALL be disabled until a branch is selected

#### Scenario: Step 1 — session branch pre-selected

- GIVEN BranchContext has branch 2 selected and `preferredBranch=2` in localStorage
- WHEN the SaleWizard opens
- THEN step 1 SHALL show branch 2 pre-selected
- AND "Siguiente" SHALL be enabled

#### Scenario: Step 1 — wizard branch change does not persist

- GIVEN step 1 shows pre-selected branch 2
- WHEN the user selects branch 5 inside the wizard
- THEN the wizard-local branchId SHALL be 5
- AND BranchContext.branchId SHALL remain 2
- AND `localStorage.preferredBranch` SHALL remain "2"

#### Scenario: Navigate to step 2 — product selection

- GIVEN the user has a branch selected in step 1
- WHEN the user taps "Siguiente"
- THEN step 2 SHALL render with product search and the multi-item form
- AND the step indicator SHALL show "2" as active

#### Scenario: Step 2 — stock scoped to wizard branch

- GIVEN the wizard branch is 5
- WHEN products are listed in step 2
- THEN available stock SHALL reflect BranchInventory for branch 5 only
- AND a quantity exceeding the available stock SHALL be flagged client-side before submit

#### Scenario: Step 2 — add multiple products

- GIVEN the user is on step 2
- WHEN the user searches and selects a product via ProductSearch
- THEN a product row SHALL appear with price (auto-filled) and quantity inputs
- AND subtotal SHALL update in real time
- AND an "Agregar otro producto" button SHALL add more rows
- AND each row SHALL have a remove button

#### Scenario: Step 2 — validate at least one product

- GIVEN the user is on step 2 with no products added
- WHEN the user taps "Siguiente"
- THEN an error SHALL display "Agregá al menos un producto"
- AND the wizard SHALL NOT advance

#### Scenario: Step 3 — payment method effects

- GIVEN the user is on step 3
- WHEN the user selects EFECTIVO
- THEN amountPaid SHALL default to the total
- WHEN the user selects TRANSFERENCIA
- THEN amountPaid SHALL default to 0 (full pending)
- WHEN the user selects MIXTO
- THEN individual cashAmount and transferAmount inputs SHALL appear

#### Scenario: Step 3 — customer selection

- GIVEN the user is on step 3
- WHEN the customer dropdown is present
- THEN it SHALL list all customers with "Cliente Anónimo" as default
- AND selecting a customer SHALL allow pending balance tracking

#### Scenario: Step 4 — submit sale

- GIVEN the user reviews the order summary on step 4
- WHEN the user taps "Confirmar Venta"
- THEN `registerSale` SHALL be called with the wizard-local branchId and all collected data
- AND on success a SweetAlert2 "Venta registrada" SHALL display
- AND the wizard SHALL close
- AND the sales list SHALL refresh

#### Scenario: Step 4 — submit error recovery

- GIVEN the user taps "Confirmar Venta"
- WHEN the Server Action returns an error (e.g., insufficient stock)
- THEN the wizard SHALL stay open
- AND the error SHALL display in step 4
- AND the user SHALL be able to go back to step 2 to adjust quantities

#### Scenario: Navigate backward

- GIVEN the user is on step 3
- WHEN the user taps "Anterior"
- THEN step 2 SHALL render with all previously entered products preserved

#### Scenario: Close wizard from any step

- GIVEN the wizard is open on any step
- WHEN the user taps the close (X) button
- THEN the wizard SHALL close without submitting
- AND no data SHALL be persisted

#### Scenario: Empty state — no products in database

- GIVEN the user opens the SaleWizard
- WHEN there are zero products in the database
- THEN the wizard SHALL show "No hay productos registrados. Primero creá un producto en la sección Productos."
- AND the wizard SHALL NOT advance past step 1

### Requirement: registerSale Server Action

The `registerSale` Server Action SHALL accept items (productId, price, quantity), branchId (required), optional customerId, paymentMethod, and optional cashAmount/transferAmount for MIXTO. It SHALL validate the branch is active and every product exists. Stock validation and decrement SHALL happen INSIDE a single Prisma `$transaction` using a conditional decrement: `BranchInventory.updateMany` filtered by `branchId_productId` AND `stock >= quantity`; if any line's update count is 0, the transaction SHALL throw and roll back ALL writes (sale header, sale items, customer balance, stock). Error codes SHALL be stable: `INSUFFICIENT_BRANCH_STOCK`, `PRODUCT_NOT_FOUND`, `BRANCH_INVALID`. Payment allocation SHALL use `computePayment` (EFECTIVO → paid full; TRANSFERENCIA → paid 0, pending total; MIXTO → cash + transfer).
(Previously: stock pre-checked OUTSIDE the transaction with a post-hoc negative-stock guard — a TOCTOU race allowed concurrent oversell)

#### Scenario: Successful cash sale

- GIVEN Product A has stock 10 at Branch 1
- WHEN creating a sale for 3 units, paymentMethod=EFECTIVO
- THEN a Sale record SHALL be created with amountPaid = total and pendingBalance = 0
- AND BranchInventory stock at Branch 1 SHALL decrease to 7
- AND Product.stock SHALL NOT be decremented (global stock is no longer maintained)

#### Scenario: Insufficient branch stock rejected

- GIVEN Product A has stock 2 at Branch 1 and 10 at Branch 2
- WHEN attempting to sell 5 units at Branch 1
- THEN the action SHALL reject with INSUFFICIENT_BRANCH_STOCK
- AND no Sale, SaleItem, or stock write SHALL occur

#### Scenario: Transfer payment creates pending balance

- GIVEN Product A has stock 10 at Branch 1, price $100 each
- WHEN creating a sale for 1 unit, paymentMethod=TRANSFERENCIA
- THEN amountPaid SHALL be 0
- AND pendingBalance SHALL be 100

#### Scenario: Mixed payment

- GIVEN Product A has stock 5 at Branch 1, price $100 each (total $500)
- WHEN creating a sale for 5 units, paymentMethod=MIXTO, cash=$300, transfer=$0
- THEN amountPaid=$300 and pendingBalance=$200

#### Scenario: Concurrent sales cannot oversell

- GIVEN stock is 7 at Branch 1 AND two concurrent requests each sell 5 units at Branch 1
- WHEN both submit
- THEN exactly one SHALL succeed
- AND the other SHALL fail with INSUFFICIENT_BRANCH_STOCK
- AND final BranchInventory stock SHALL be 2

#### Scenario: Transaction rollback on partial failure

- GIVEN a request has line A (stock sufficient) and line B (insufficient)
- WHEN the action runs
- THEN the whole transaction SHALL roll back
- AND no Sale, SaleItem, or customer balance SHALL be persisted
- AND stock for line A SHALL remain unchanged

#### Scenario: Product not found

- GIVEN an item references a non-existent product
- WHEN the action runs
- THEN it SHALL reject with PRODUCT_NOT_FOUND
- AND no writes SHALL occur

#### Scenario: Invalid or inactive branch

- GIVEN a branch that does not exist or is inactive
- WHEN the action runs
- THEN it SHALL reject with BRANCH_INVALID
- AND no writes SHALL occur

## ADDED Requirements

### Requirement: BranchSelector Controlled Mode

The `BranchSelector` component MUST support a controlled mode via optional `value: number | null` and `onChange`. When `value` is provided, the component SHALL render that selection and SHALL call `onChange` instead of `BranchContext.setBranchId`; it SHALL NOT read or write BranchContext or localStorage. When `value` is omitted, the current context-driven behavior SHALL remain unchanged for existing consumers.

#### Scenario: Controlled mode renders value without side effects

- GIVEN `value=5` is passed to BranchSelector
- WHEN the component renders
- THEN the dropdown SHALL show branch 5
- AND BranchContext.branchId and `localStorage.preferredBranch` SHALL remain unchanged

#### Scenario: Selection fires onChange only

- GIVEN BranchSelector is in controlled mode
- WHEN the user selects branch 3
- THEN `onChange(3)` SHALL be called
- AND `setBranchId` SHALL NOT be called

#### Scenario: Uncontrolled mode unchanged

- GIVEN no `value` prop is passed (existing consumers)
- WHEN the user selects a branch
- THEN BranchContext.branchId SHALL update and persist as today

### Requirement: Branch Stock Utilities

The system SHALL provide pure utilities in `src/lib/utils/stock.ts`: `getBranchStock(branchId, productId)` returning the BranchInventory stock (0 when the row is absent), and `validateSaleLines(branchId, lines)` returning per-line availability with an `insufficient` flag. These SHALL be side-effect-free and unit-testable. The Server Action SHALL NOT rely on them for atomicity — it re-validates inside the transaction.

#### Scenario: getBranchStock returns stock

- GIVEN BranchInventory has stock 7 for branch 1, product A
- WHEN `getBranchStock(1, A)` is called
- THEN it SHALL return 7

#### Scenario: getBranchStock absent row

- GIVEN no BranchInventory row for branch 1, product B
- WHEN `getBranchStock(1, B)` is called
- THEN it SHALL return 0

#### Scenario: validateSaleLines flags insufficient lines

- GIVEN a line requests quantity 5 and available stock is 2
- WHEN `validateSaleLines` runs
- THEN that line SHALL be flagged insufficient

#### Scenario: validateSaleLines all sufficient

- GIVEN every line quantity ≤ available stock
- WHEN `validateSaleLines` runs
- THEN no line SHALL be flagged

### Requirement: Sale Validation Schema (Zod)

The sale schemas (`saleItemSchema`, `registerSaleSchema`) MUST be exported from `src/lib/validations/sale.ts` as the single source of truth and MUST be imported by `src/app/actions/sale.ts` (the inline duplicate SHALL be removed). `branchId` SHALL be required; items SHALL be a non-empty array; quantity SHALL be ≥1; MIXTO SHALL require cashAmount + transferAmount > 0.

#### Scenario: Missing branchId rejected

- GIVEN a payload without branchId
- WHEN `registerSaleSchema.parse` runs
- THEN it SHALL fail with "La sucursal es requerida"

#### Scenario: Empty items rejected

- GIVEN an empty items array
- WHEN `registerSaleSchema.parse` runs
- THEN it SHALL fail

#### Scenario: Quantity zero rejected

- GIVEN a line with quantity 0
- WHEN `registerSaleSchema.parse` runs
- THEN it SHALL fail

#### Scenario: MIXTO without amounts rejected

- GIVEN paymentMethod=MIXTO and cashAmount + transferAmount = 0
- WHEN `registerSaleSchema.parse` runs
- THEN it SHALL fail

### Requirement: SaleWizard Non-Functional Requirements

- `registerSale` MUST execute atomically in a single Prisma transaction; any failure SHALL roll back all writes.
- Concurrent oversell MUST be prevented by the in-transaction conditional decrement (no TOCTOU).
- Wizard state SHALL be ephemeral: it MUST NOT persist across reloads, and the wizard branch MUST NOT affect global filters or `preferredBranch`.
- Sale submission SHALL be a single Server Action round-trip.
- The wizard SHALL be mobile-first with touch targets ≥ 44px.

## UI/UX Details

- Bottom sheet: `rounded-t-3xl`, slide-up animation, `max-h-[90vh]`, backdrop blur — consistent with the existing AddSaleButton shell.
- Step indicator (1–4) at the top with the current step highlighted in `#ff385c`; completed steps MAY be tappable to revisit.
- "+" FAB on /ventas opens the wizard; FAB placement unchanged (`bottom-24 right-6`).
- All user-facing strings in Spanish (app language): "Sucursal", "Productos", "Pago", "Confirmación", "Anterior", "Siguiente", "Confirmar Venta", "Agregá al menos un producto".
- SweetAlert2 styling consistent: `confirmButtonColor: #ff385c`, `background: #ffffff`, `color: #222222`.

## Acceptance Criteria

- [ ] "/" + FAB opens the 4-step wizard with a visible step indicator.
- [ ] Step 1 pre-selects the session branch; changing it never alters BranchContext or `preferredBranch`.
- [ ] Advance blocked until a branch, ≥1 product, and a valid payment are provided.
- [ ] Step 2 quantities validated against selected-branch stock client-side; server re-validates atomically.
- [ ] Sale is recorded against the wizard branch; sales list refreshes; SweetAlert2 success shows.
- [ ] Concurrent oversell is impossible (verified by integration test).
- [ ] Failure rolls back sale + items + customer balance + stock.
- [ ] BranchSelector controlled mode: existing context-based consumers behave unchanged.
- [ ] `src/lib/validations/sale.ts` is the single schema source; inline duplicate removed from the action.
- [ ] Unit coverage ≥80% on `registerSale`, stock utils, and step gating; integration test verifies the stock invariant; zero regressions.
