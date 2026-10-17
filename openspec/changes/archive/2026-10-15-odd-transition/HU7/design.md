# Design: HU7 - Public Isolated Module for External Sales

## Technical Approach

We are creating an isolated module for external sales with login for two predefined users. This module will be completely separate from the internal authentication system, reusing existing core functionalities (product search, sale creation with stock update) but with its own authentication and routes.

## Architecture Decisions

### Decision: Isolated Authentication System

**Choice**: Implement a separate authentication system for external users using JWT cookies, isolated from the internal employee/auth system.

**Alternatives considered**:
- Extend the existing authentication system (if any) to handle external users: Rejected because the requirement states no shared state with the main app auth system, and we don't want to complicate the existing auth.
- Use server-side session-based authentication: Rejected because JWT stateless tokens are simpler for this isolated module and don't require server-side storage.

**Rationale**:
- **Isolation**: External users should not be able to access internal routes and vice versa.
- **Simplicity**: JWT with HTTP-only cookies is straightforward for this use case.
- **Security**: Using HttpOnly, Secure, SameSite cookies and timing-safe comparison for credentials.

### Decision: Route Protection via Middleware

**Choice**: Use a custom middleware in `src/app/(external)/middleware.ts` (using route groups) to protect the `/venta-externo` route, redirecting to `/login-externo` if no valid session.

**Alternatives considered**:
- Protect each route individually with a wrapper component: Less efficient and prone to missing protection.
- Use Next.js middleware in the root: Would require path matching for external routes, which is acceptable but less organized.

**Rationale**:
- Route groups allow colocating middleware with protected routes.
- Centralized protection ensures any route under the `(external)` group (if we add more) is protected.

### Decision: Reuse Existing Sale and Product Logic

**Choice**: Reuse existing `getProductById` and `searchProducts` actions from `src/app/actions/product.ts`. For sale creation, we will create a new action `createExternalSale` in `src/app/actions/external-sale.ts` that follows the same transactional pattern as `registerSale` but adapted for external sales (no customer, only EFECTIVO/TRANSFERENCIA).

**Alternatives considered**:
- Directly call Prisma client in route handlers: Would duplicate code and bypass existing validation and transaction patterns.
- Modify the existing `registerSale` to accept external sales: Would complicate the existing function and risk breaking internal sales.

**Rationale**:
- **DRY principle**: Reuse tested and proven functions.
- **Consistency**: Use the same patterns (Zod validation, Prisma transactions, revalidation) as the existing codebase.
- **Isolation**: Changes are confined to new files, minimizing risk to existing functionality.

## Data Flow

```
User accesses /venta-externo → Middleware checks for valid external session cookie → 
If absent or invalid → Redirect to /login-externo → 
User submits login form → Action validates credentials against ENV vars → 
On success, sets HTTP-only JWT cookie → Redirects to /venta-externo → 
User selects product via search (reuses existing searchProducts action) → 
Enters quantity and selects payment method (EFECTIVO/TRANSFERENCIA) → 
Submits form → Calls createExternalSale action → 
Action validates input, checks stock, creates sale with customerId=null, 
calculates amountPaid/pendingBalance based on payment method, 
decrements product stock in a transaction → 
Returns success → Show success message and reset form.
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/auth-external.ts` | Create | Contains functions for verifying credentials, creating/verifying JWT, and cookie helpers. |
| `src/app/login-externo/page.tsx` | Create | Login page with email/password form, calls login action. |
| `src/app/login-externo/action.ts` | Create | Server action to handle login: validates credentials, sets JWT cookie. |
| `src/app/(external)/layout.tsx` | Create | Layout for the external group (optional, for common layout). |
| `src/app/(external)/middleware.ts` | Create | Middleware to validate session cookie for routes under `(external)`. |
| `src/app/venta-externo/page.tsx` | Create | Protected sales page with product search, quantity input, payment method selection, and submit button. |
| `src/app/venta-externo/action.ts` | Create | Server action to handle sale submission (calls `createExternalSale`). |
| `src/app/actions/external-sale.ts` | Create | Contains `createExternalSale` function encapsulating the business logic for creating an external sale. |
| `.env.example` | Update | Add example variables for the two external users and JWT secret. |
| `.env.local` (not committed) | Update | Actual values for environment variables. |

## Interfaces / Contracts

### auth-external.ts

```typescript
export interface ExternalUser {
  id: string; // email or a fixed ID
  email: string;
}

export function verifyExternalCredentials(email: string, password: string): Promise<ExternalUser | null>;
export function createExternalSessionToken(user: ExternalUser): string;
export function verifyExternalSessionToken(token: string): ExternalUser | null;
export function setAuthCookie(res: Response, token: string): void;
export function getAuthCookie(request: Request): string | null;
```

### external-sale.ts

```typescript
export interface ExternalSaleItem {
  productId: string; // string from form, converted to number internally
  quantity: number;
  price: number; // unit price from product
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA';
}

export interface ExternalSaleResult {
  success: true;
  saleId: number;
} | {
  success: false;
  error: string;
}

export async function createExternalSale(
  items: ExternalSaleItem[]
): Promise<ExternalSaleResult>;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `auth-external.ts` functions | Jest tests for credential verification, token creation/validation, cookie handling. |
| Unit | `external-sale.ts` function | Mock Prisma client to test stock validation, transaction rollback, payment calculation. |
| Integration | Login flow | Test end-to-end: submit invalid credentials → error, valid credentials → cookie set, access protected route. |
| Integration | Sale creation | Test: insufficient stock → error, valid sale → sale created, stock decremented, correct payment allocation. |
| E2E | Full flow | Use Playwright to simulate: login, search product, add to cart, complete sale, verify success message. |

## Deployment / Rollout

- No database migration required (uses existing tables).
- No feature flag needed; the new routes are active immediately upon deployment.
- Rollback: Simply remove the new files and environment variables; no impact on existing functionality.

## Open Questions

- [ ] What should be the business name displayed in the header of the venta-externo page? Should we use an environment variable (e.g., `NEXT_PUBLIC_BUSINESS_NAME`) or a constant?
- [ ] Should the external session expire after a fixed time (e.g., 15 minutes) or be sliding? We propose a fixed 15-minute expiration for simplicity.
- [ ] Should we limit the number of items per sale? Not specified; we will allow multiple items as in internal sales.

## Next Step

Ready for tasks (sdd-tasks).