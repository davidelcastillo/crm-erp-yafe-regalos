# Sale with Branch Specification

## Purpose

Enable sales with mandatory branch selection. Stock is deducted from the selected branch's inventory, and insufficient stock at the chosen branch blocks the sale. Payment methods: EFECTIVO, TRANSFERENCIA, or MIXTO.

## Requirements

### Requirement: SaleForm Component

The system MUST provide a `SaleForm` Client Component that renders: product selector (reusing `searchProducts`), required `BranchSelector` dropdown, quantity input, unit price, payment method selector (EFECTIVO, TRANSFERENCIA, MIXTO), and submit button. The form SHALL validate branch selection and quantity ≥ 1.

#### Scenario: Render sale form
- GIVEN the sale modal is open
- WHEN the form renders
- THEN SHALL display product search, branch selector, quantity input, and payment method selector

#### Scenario: Branch required validation
- GIVEN a sale form with no branch selected
- WHEN attempting to submit
- THEN the form SHALL show "Debe seleccionar una sucursal"

### Requirement: createSaleWithBranch Server Action

The `createSaleWithBranch` Server Action SHALL accept: productId, branchId, quantity, unitPrice, paymentMethod. It SHALL validate the selected branch has sufficient stock in `BranchProduct`. Payment methods: EFECTIVO (amountPaid = total, pendingBalance = 0), TRANSFERENCIA (amountPaid = 0, pendingBalance = total), MIXTO (amountPaid and pendingBalance provided explicitly). The operation SHALL execute in a Prisma transaction.

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

#### Scenario: Mixed payment
- GIVEN Product A has stock 5 at Branch 1, price $100 each (total $500)
- WHEN creating a sale for 5 units, paymentMethod=MIXTO, amountPaid=$300, pendingBalance=$200
- THEN amountPaid=$300 and pendingBalance=$200