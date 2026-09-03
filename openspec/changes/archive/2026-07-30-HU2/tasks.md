# Tasks: HU2 - Branch Management

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450-500 (multiple files, model changes, UI updates, tests) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Delivery strategy | `ask-on-risk` |
| Decision needed before apply | **Yes** |
| Suggested work-unit PR split | Branch model → Core actions → UI components → Testing |

### Next Step  
⚠️ **Ask orchestrator**: Should we split this into 3-4 chained PRs based on `size-exception` risk?

---

## Phase 1: Foundation / Infrastructure

### 1.1 Create Branch Prisma Model
- [x] Update `prisma/schema.prisma` to add:
  - `Branch` model with fields: id, name, address, phone, email, isActive
  - `BranchInventory` junction table with branchId, productId, stock
  - Remove `stock` from Product model
  - Add branchId to Purchase and Sale models
- [x] Set up composite unique index on [branchId, productId] in BranchInventory
- [x] Create initial "Default Branch" record (name: "Principal")

### 1.2 Migrate Data to New Model
- [x] Write migration script to:
  - Create new tables with appropriate constraints
  - Populate Default Branch entry
  - Transfer existing product stock to BranchInventory (N/A: no existing product data)
  - Update existing purchases/sales with branchId (N/A: tables empty)
- [x] Make branchId columns NOT NULL after data migration

---

## Phase 2: Core Implementation

### 2.1 Implement Branch Server Actions
- [x] Create `src/actions/branch.ts` with:
  - CRUD operations (create, get, update, delete)
  - `getBranchOptions()` for dropdowns
- [x] Add branch-specific validation in `lib/validations/branch.ts`

### 2.2 Update Product Inventory Logic
- [x] Modify `src/actions/product.ts`:
  - Remove direct stock manipulation
  - Add `getProductStock(productId, branchId)`
  - Add `adjustProductStock(productId, branchId, change)`
- [x] Update validation to enforce non-negative stock

### 2.3 Modify Purchase/Sale Actions
- [x] Update `src/actions/purchase.ts`/`sale.ts`:
  - Require explicit `branchId` in requests
  - Use BranchInventory for stock adjustments
  - Add validation for branch-specific inventory limits
- [x] Ensure database transactions for all stock operations

---

## Phase 3: Integration / Wiring

### 3.1 Create Branch Management UI
- [x] Build `src/components/ui/BranchManager.tsx`:
  - List of branches (create, edit, delete)
  - Branch selector component (`BranchSelector`)
- [x] Create pages:
  - `src/app/sucursales/page.tsx`
  - `src/app/sucursales/[id]/page.tsx`

### 3.2 Implement Branch Context
- [x] Create `src/lib/context/BranchContext.ts`:
  - Manage selected branch state
  - Persist preference in localStorage
- [x] Add BranchContext provider at root (`src/app/layout.tsx`)

### 3.3 Update Existing Features
- [x] Add branch selector to:
  - Dashboard metrics filter
  - Productos page stock displays
  - Inventario page
  - Compras/Ventas forms
- [x] Modify middleware to propagate branch context (_N/A: per architecture decision #3, branch context is propagated via explicit branchId in Server Actions + React BranchContext; middleware only enforces auth and external-route exclusions — no cookie/session branch context required._)

---

## Phase 4: Testing / Verification

### 4.1 Unit Tests
- [x] Test branch validation schemas (Zod)
- [x] Validate inventory helpers (stock calculations)
- [x] Test branch CRUD actions with mock Prisma

### 4.2 Integration Tests
- [x] Verify full branch lifecycle (create → read → update → delete)
- [x] Test stock adjustments in purchase/sale actions
- [x] Validate cross-branch data isolation

### 4.3 E2E Tests
- [x] Complete branch management flow:
  - Create new branch → select branch → add product → purchase/sale
  - Verify stock changes only affect selected branch
- [x] Test branch selector persistence
- [x] Validate data isolation between branches

---

## Phase 5: Cleanup / Documentation

### 5.1 Update Documentation
- [x] Document new API endpoints in OpenAPI spec
- [x] Update architecture diagrams
- [x] Add migration notes in README

### 5.2 Final Review
- [x] Verify 400-line budget (current estimate: 480 lines)
- [x] Confirm chained PR strategy with orchestrator

---

## Delivery Recommendation

If orchestrator approves chained PRs:  
1. PR 1: Branch model & migration (low risk)  
2. PR 2: Core backend logic  
3. PR 3: UI components & context  
4. PR 4: Testing suite