# Proposal: HU7 - Public Isolated Module for External Sales

## Intent
Create a public, isolated module for external sales that allows exactly two predefined users (credentials stored in environment variables) to register sales without access to the rest of the system. The module should be secure, simple, and reuse existing core functionalities (product search, sale creation with stock updates) while maintaining strict separation from the internal authentication system.

## Scope
- **Included**:
  - Login page (`/login-externo`) with email and password validation against the two predefined credentials.
  - Protected sales page (`/venta-externo`) that requires a valid session.
  - Product search (reusing existing `searchProducts` logic) for selecting products and quantities.
  - Payment method selection (EFECTIVO or TRANSFERENCIA only).
  - Sale creation server action that:
    * Validates stock availability.
    * Creates a Sale record with `customerId: null`.
    * Creates SaleItem records.
    * Updates product stock via existing transaction logic.
    * Sets `amountPaid` and `pendingBalance` based on payment method.
  - Session management using HTTP-only, secure, same-site cookies with JWT (15-minute expiration).
  - Rate limiting on login attempts (5 failures per 15 minutes per IP).
  - UI components for login and sales pages, following the existing Tailwind v4 styling.
- **Excluded**:
  - Access to any internal routes (products, inventory, purchases, customers, dashboard, etc.).
  - The MIXTO payment method (to keep the interface simple).
  - Any modification to the existing internal authentication system.
  - Advanced features like refunds, sales history, or reporting for external users.

## Approach
We will implement a standalone authentication system using JWT cookies, protected by a custom middleware for the `/venta-externo` route group. The system will reuse:
- Product search (`searchProducts` from HU3/HU8) for the autocomplete functionality.
- Sale and stock update logic (from Fase 1 and Fase 2) for creating sales and adjusting inventory.
- Existing Prisma client setup and database schema (Sale, SaleItem, Product tables).

The login and sales pages will be built as standard Next.js pages with React components, using form handling and client-side validation where appropriate, but with all critical validation and business logic occurring in Server Actions.

## Trade-offs
- **Isolation vs. Reuse**: By creating a separate authentication system, we ensure complete isolation but duplicate some authentication logic (e.g., cookie handling). This is acceptable given the simplicity and security requirements.
- **JWT vs. Server-side Sessions**: JWT stateless tokens avoid server-side storage overhead and are sufficient for the short-lived sessions (15 minutes) required. The alternative of server-side sessions would require additional infrastructure (e.g., Redis) for session storage, which is unnecessary for this scale.
- **Middleware vs. Per-route Protection**: Using a route-group middleware centralizes protection and reduces the risk of forgetting to protect a route, at the cost of a slight increase in complexity for the middleware logic.
- **Reusing Existing Sale Logic**: Leveraging the existing, battle-tested sale and stock update code reduces development time and risk of introducing bugs in core business logic. However, we must ensure that the external sale logic does not inadvertently affect internal sales (e.g., by using the same function without proper parameterization).

## Acceptance Criteria
1. Only the two predefined credentials can successfully log in.
2. Invalid login attempts show a generic error message (to avoid user enumeration).
3. After 5 failed login attempts from an IP within 15 minutes, further attempts are blocked until the window expires.
4. The `/venta-externo` page redirects to `/login-externo` if no valid session is present.
5. Authenticated users can search for products, select quantities, choose a payment method, and submit a sale.
6. Upon submission, stock is validated and decremented, a sale and its items are recorded, and the user sees a success message with the sale ID.
7. The sale respects the payment method: EFECTIVO sets `amountPaid` to total and `pendingBalance` to 0; TRANSFERENCIA sets `amountPaid` to 0 and `pendingBalance` to total.
8. The UI is mobile-friendly and uses the same styling as the rest of the application.
9. No internal data (e.g., full product lists, inventory values, customer information) is exposed to external users.
10. All inputs are validated and sanitized on the server to prevent injection attacks.