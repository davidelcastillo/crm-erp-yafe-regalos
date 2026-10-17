# Delta for Sale with Branch

## MODIFIED Requirements

### Requirement: SaleForm Component

The system MUST provide a `SaleForm` Client Component that renders: product selector (reusing `searchProducts`), required `BranchSelector` dropdown, quantity input, unit price, payment method selector (EFECTIVO, TRANSFERENCIA, MIXTO), and submit button. The form SHALL validate branch selection and quantity ≥ 1. When `paymentMethod === MIXTO`, BOTH sale forms (`SaleForm` and the `AddSaleButton` multi-item form) SHALL render `cashAmount` and `transferAmount` inputs, SHALL validate that at least one is > 0, SHALL send `cashAmount`/`transferAmount` instead of `amountPaid`, SHALL NOT send a conflicting `amountPaid`, and SHALL hide the single "Monto Pagado" input.
(Previously: both forms rendered only a single "Monto Pagado" field and never sent cashAmount/transferAmount for MIXTO, so MIXTO was rejected by the refine.)

**Traza**: Item 4.

#### Scenario: Render sale form

- GIVEN the sale modal is open
- WHEN the form renders
- THEN SHALL display product search, branch selector, quantity input, and payment method selector

#### Scenario: Branch required validation

- GIVEN a sale form with no branch selected
- WHEN attempting to submit
- THEN the form SHALL show "Debe seleccionar una sucursal"

#### Scenario: MIXTO shows split inputs

- GIVEN the user selects paymentMethod MIXTO
- WHEN the form re-renders
- THEN cashAmount and transferAmount inputs SHALL appear
- AND the "Monto Pagado" field SHALL be hidden

#### Scenario: MIXTO validates at least one amount

- GIVEN paymentMethod MIXTO with cashAmount 0 and transferAmount 0
- WHEN submitting
- THEN the form SHALL reject with "se requiere una cantidad en efectivo o transferencia mayor a 0"

#### Scenario: MIXTO submits split amounts

- GIVEN paymentMethod MIXTO with cashAmount 300 and transferAmount 200
- WHEN submitting
- THEN the form SHALL send cashAmount and transferAmount
- AND SHALL NOT send a conflicting amountPaid

### Requirement: createSaleWithBranch Server Action

The `createSaleWithBranch` Server Action SHALL accept: productId, branchId, quantity, unitPrice, paymentMethod. It SHALL validate the selected branch has sufficient stock in `BranchProduct`. Payment methods: EFECTIVO (amountPaid = total, pendingBalance = 0), TRANSFERENCIA (amountPaid = 0, pendingBalance = total), MIXTO (cashAmount + transferAmount, amountPaid = cashAmount + transferAmount, pendingBalance = total − amountPaid). For MIXTO the action SHALL ignore a conflicting `amountPaid`. The operation SHALL execute in a Prisma transaction.
(Previously: MIXTO accepted amountPaid and pendingBalance explicitly instead of split cash/transfer amounts.)

**Traza**: Item 4.

#### Scenario: Successful cash sale

- GIVEN Product A has stock 10 at Branch 1
- WHEN creating a sale for 3 units, paymentMethod=EFECTIVO
- THEN a Sale record SHALL be created with amountPaid = total and pendingBalance = 0
- AND BranchProduct stock at Branch 1 SHALL decrease to 7
- AND Product.stock SHALL decrease by 3

#### Scenario: Insufficient branch stock rejected

- GIVEN Product A has stock 2 at Branch 1 and 10 at Branch 2
- WHEN attempting to sell 5 units at Branch 1
- THEN the action SHALL reject with INSUFFICIENT_BRANCH_STOCK

#### Scenario: Transfer payment creates pending balance

- GIVEN Product A has stock 10 at Branch 1, price $100 each
- WHEN creating a sale for 1 unit, paymentMethod=TRANSFERENCIA
- THEN amountPaid SHALL be 0
- AND pendingBalance SHALL be 100

#### Scenario: Mixed payment derives amountPaid from split

- GIVEN Product A has stock 5 at Branch 1, price $100 each (total $500)
- WHEN creating a sale for 5 units, paymentMethod=MIXTO, cashAmount=$300, transferAmount=$200
- THEN amountPaid SHALL be $500
- AND pendingBalance SHALL be $0

#### Scenario: MIXTO rejects zero split

- GIVEN paymentMethod=MIXTO with cashAmount=0 and transferAmount=0
- WHEN registering the sale
- THEN the action SHALL reject with the refine message "MIXTO requiere cashAmount o transferAmount mayor a 0"
