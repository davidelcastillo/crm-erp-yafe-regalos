# Tasks: HU7 - External Sales Module

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | 300-400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | 2 PRs (Auth + Sales) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |
| Decision needed before apply | Yes |
| Chained PRs recommended: Yes |
| Chain strategy: stacked-to-main |
| 400-line budget risk: Medium |

## Phase 1: Authentication System
- [ ] 1.1 Setup environment variables for two external users
- [ ] 1.2 Implement bcrypt password hashing with timing-safe comparison
- [ ] 1.3 Create JWT token generation endpoint with 15min expiration
- [ ] 1.4 Implement HTTP-only, Secure SameSite=Strict cookie handler
- [ ] 1.5 Add session cookie middleware for /venta-externo protection
- [ ] 1.6 Implement rate limiting (5failed/15min/IP)
- [ ] 1.7 Add logout handling and session expiration logic

## Phase 2: Login Page
- [ ] 2.1 Create /login-externo page with email/password form
- [ ] 2.2 Implement client-side form validation
- [ ] 2.3 Connect form to server-side loginAction
- [ ] 2.4 Handle success redirection to /venta-externo
- [ ] 2.5 Display generic error messages on failure
- [ ] 2.6 Integrate rate limiting mechanism

## Phase 3: External Sales Page
- [ ] 3.1 Create /venta-externo page with mobile-first UI
- [ ] 3.2 Integrate existing ProductSearch component
- [ ] 3.3 Implement quantity inputs with min=1 validation
- [ ] 3.4 Add payment method selector (EFECTIVO/TRANSFERENCIA)
- [ ] 3.5 Add remove button for product lines
- [ ] 3.6 Add submit button with disable logic

## Phase 4: Sale Creation Logic
- [ ] 4.1 Implement createExternalSaleAction server action
- [ ] 4.2 Validate product quantities against stock
- [ ] 4.3 Implement database transaction for sale creation
- [ ] 4.4 Handle payment method calculations (amountPaid/pendingBalance)
- [ ] 4.5 Update stock for all items atomically
- [ ] 4.6 Return structured response with sale ID or errors

## Phase 5: Security & Non-Functional
- [ ] 5.1 Ensure all business logic in Server Actions
- [ ] 5.2 Validate JWT secret length and env storage
- [ ] 5.3 Confirm cookie security settings
- [ ] 5.4 Implement error message sanitization
- [ ] 5.5 Ensure no breaking changes to existing flows

## Implementation Order
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

## Next Step
Ready for sdd-apply after user decision on chain strategy