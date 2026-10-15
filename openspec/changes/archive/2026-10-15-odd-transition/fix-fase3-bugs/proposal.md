# Proposal: Fix FASE 3 Bugs

## Intent

Fix two blocking bugs preventing FASE 3 completion: a build error from wrong import path in AddPurchaseButton.tsx, and test failures from incorrect jest mock pattern in ProductForm.test.tsx.

## Scope

### In Scope
- Fix import path in `src/app/compras/components/AddPurchaseButton.tsx` (line 5)
- Fix `useRouter` mock in `src/app/productos/components/ProductForm.test.tsx` (lines 14-18, 157, 209, 247)
- Verify all 109 tests pass after fixes

### Out of Scope
- New features or functionality changes
- Refactoring beyond the minimal fixes
- Other test files (will address if discovered during verification)

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None

## Approach

1. **Import Fix**: Change `import { getProducts } from '../../actions/purchase'` to `import { getProducts } from '../../actions/product'` in AddPurchaseButton.tsx
2. **Mock Fix**: Convert the `useRouter` mock from a plain object to `jest.fn()` returning the router object, enabling `.mockReturnValue()` calls in test cases
3. Run `npm run test` to verify all tests pass

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/compras/components/AddPurchaseButton.tsx` | Modified | Fix import path for getProducts |
| `src/app/productos/components/ProductForm.test.tsx` | Modified | Fix useRouter mock to be jest.fn() |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Other test files have similar mock issues | Low | Run full test suite, fix any additional failures found |
| Import fix breaks other imports | Low | Verify getProducts is only used in this component |

## Rollback Plan

Revert the two file changes via git:
```bash
git checkout src/app/compras/components/AddPurchaseButton.tsx
git checkout src/app/productos/components/ProductForm.test.tsx
```

## Dependencies

- None (pure bug fixes)

## Success Criteria

- [ ] `npm run build` completes without errors
- [ ] `npm run test` passes all 109 tests (0 failures)
- [ ] No regressions in existing functionality