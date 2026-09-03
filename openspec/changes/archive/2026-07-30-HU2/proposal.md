# Proposal: HU2 - Branch Management

## Intent
Enable the system to manage multiple business branches (sucursales) to support inventory tracking, sales reporting, and operational visibility across different physical locations. Each branch will have its own inventory counts, sales data, and operational settings while sharing the core product catalog.

## Scope

### In Scope
- Branch entity with fields: id, name, address, phone, email, isActive, createdAt, updatedAt
- CRUD operations for branches (Create, Read, Update, Delete)
- Branch selection in sales and purchase processes to track location-specific transactions
- Inventory tracking per branch (stock levels maintained per product per branch)
- Branch-based reporting capabilities (sales by branch, inventory by branch)
- Default branch configuration for new transactions
- API endpoints for branch management
- UI components for branch management in the admin interface
- Unit, integration, and E2E tests

### Out of Scope
- Complex hierarchical branch structures (sub-branches, regions)
- Multi-currency support per branch
- Advanced warehouse management features (bins, lots, serial tracking)
- Inter-branch transfer automation (manual process only)
- Branch-specific pricing or promotions
- Employee management per branch (handled separately)

## Capabilities

### New Capabilities
- `branch-management`: Complete CRUD operations for business branches
- `multi-location-inventory`: Track inventory levels per branch
- `location-based-transactions`: Associate sales and purchases with specific branches
- `branch-reporting`: Generate reports filtered by branch

### Modified Capabilities
- `product-management`: Products now maintain stock levels per branch instead of global stock
- `purchase-management`: Purchases must specify a target branch for received inventory
- `sales-management`: Sales must specify a source branch for inventory deduction
- `dashboard`: Branch selection filter for dashboard metrics
- `user-management`: Optional branch assignment for user access control

## Approach
1. Add Branch entity to Prisma schema with essential fields
2. Modify Product model to remove global stock field and introduce BranchInventory junction table
3. Update Purchase and Sale models to reference branch instead of implicit single location
4. Create Branch CRUD operations as Server Actions
5. Update existing mutation functions (createPurchase, createSale) to require branch selection
6. Build Branch management UI in `/sucursales` route
7. Modify inventory queries to filter by selected branch
8. Update dashboard to show branch-specific metrics with branch selector
9. Implement branch context provider for UI components to access current branch
10. Add middleware to ensure branch context is maintained for relevant operations

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Add Branch model, BranchInventory junction table, update Product, Purchase, Sale models |
| `src/actions/branch.ts` | New | Server Actions for branch CRUD operations |
| `src/actions/inventory.ts` | Modified | Update inventory functions to work with branch-specific stock |
| `src/actions/purchase.ts` | Modified | Require branchId parameter for purchase creation |
| `src/actions/sale.ts` | Modified | Require branchId parameter for sale creation |
| `src/lib/validations/branch.ts` | New | Zod validation schemas for branch data |
| `src/components/ui/BranchManager.tsx` | New | Main branch management interface |
| `src/components/ui/BranchSelector.tsx` | New | Component for selecting branch in forms |
| `src/app/sucursales/page.tsx` | New | Branch management page |
| `src/app/sucursales/[id]/page.tsx` | New | Branch detail/edit page |
| `src/app/layout.tsx` | Modified | Add branch context provider |
| `src/lib/context/BranchContext.ts` | New | React context for branch selection |
| `src/app/dashboard/page.tsx` | Modified | Add branch selector and filter metrics by branch |
| `src/app/productos/page.tsx` | Modified | Show branch-specific stock levels |
| `src/app/inventario/page.tsx` | Modified | Show branch-specific inventory |
| `src/app/clientes/page.tsx` | Modified | Add branch context where relevant |
| `src/app/ventas/page.tsx` | Modified | Require branch selection for new sales |
| `src/app/compras/page.tsx` | Modified | Require branch selection for new purchases |
| `package.json` | Modified | May need additional dependencies for form handling |
| `src/middleware.ts` | Modified | Enhance to maintain branch context |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Data migration complexity | Medium | Provide migration scripts to assign existing data to default branch |
| Performance impact of joins | Low | Proper indexing on foreign keys; denormalize if needed |
| UI complexity increase | Medium | Implement branch selector as reusable component; default to user's preferred branch |
| Breaking changes to existing APIs | Low | Version API changes carefully; maintain backward compatibility where possible |
| Inventory consistency issues | Medium | Use transactions for stock operations; add validation checks |

## Rollback Plan
1. Revert prisma schema changes
2. Remove branch-related Server Actions and components
3. Restore Product model to have global stock field
4. Update Purchase and Sale models to remove branchId
5. Revert UI changes to remove branch selection
6. Restore previous inventory and transaction logic
7. No data loss if migration scripts preserve data in backup tables

## Dependencies
- Existing Product, Purchase, Sale, Customer models
- Existing authentication system (for authorization)
- Existing form validation patterns (Zod)
- Existing UI component library (shadcn/ui)

## Success Criteria
- [ ] Branch CRUD operations functional via UI and API
- [ ] Inventory tracked separately per branch
- [ ] Sales and purchases require branch selection
- [ ] Dashboard shows branch-filtered metrics
- [ ] Existing data migrated to default branch without loss
- [ ] Performance impact minimal (<10% increase in query times)
- [ ] All existing functionality preserved with branch awareness
- [ ] Unit tests pass for all new and modified functions
- [ ] Integration tests verify branch-specific workflows
- [ ] E2E tests cover branch creation, switching, and reporting

## Dependencies on Other HUs
- HU1 (Product Management): Foundation for product catalog
- HU4 (External Portal): Will need to respect branch context for external users
- HU6 (Label Printing): May need branch context for label generation
- HU7 (External Sales): Will operate under specific branch context