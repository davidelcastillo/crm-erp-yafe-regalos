# Specification: HU7 - Public Isolated Module for External Sales

## Functional Requirements

### 1. Authentication System
1.1. The system shall authenticate exactly two users whose credentials are stored in environment variables:
    - EXTERNAL_USER_1_EMAIL and EXTERNAL_USER_1_PASSWORD
    - EXTERNAL_USER_2_EMAIL and EXTERNAL_USER_2_PASSWORD
1.2. Passwords shall be compared using a timing-safe hash comparison (bcrypt.compare) to prevent timing attacks.
1.3. Upon successful authentication, the system shall create a JWT token containing:
    - User identifier (email)
    - Expiration timestamp (15 minutes from issuance)
    - The token shall be signed with a secret stored in EXTERNAL_SESSION_SECRET.
1.4. The JWT token shall be stored in an HTTP-only, Secure, SameSite=Strict cookie named `session-token`.
1.5. The cookie shall be set on the response from the login action and sent with every request to the external routes.
1.6. Middleware shall protect all routes under the `/venta-externo` path (or under a route group) by validating the `session-token` cookie:
    - If the cookie is missing, invalid, or expired, the user shall be redirected to `/login-externo`.
1.7. Upon logout (if implemented) or session expiration, the cookie shall be cleared.

### 2. Login Page (`/login-externo`)
2.1. The page shall display a form with fields for email and password.
2.2. The form shall submit to a Server Action (e.g., `loginAction`) via a POST request.
2.3. Client-side validation shall ensure both fields are filled before submission.
2.2.4.   upon successful login, the user shall be redirected to `/venta-externo`.
2.5. Upon invalid credentials, the system shall display a generic error message: "Credenciales inválidas".
    oinvalidos".
2.6. The login action shall implement rate limiting: no more than 5 failed attempts per 15 minutes per IP address.
2.7. When the rate limit is exceeded, the login action shall return an error indicating that too many attempts have been made.

### 3. External Sales Page (`/venta-externo`)
3.1. The page shall be accessible only after successful authentication (see section 1).
3.2. The page shall contain:
    - A product search component (reusing the existing search functionality from HU3/HU8) that allows the user to search by product code or name.
    - For each selected product, a row showing:
        * Product name (from search result)
        * Quantity input field (type="number", min=1, step=1, placeholder="Cant.")
        * A remove button (✕) to remove the product from the selection.
    - A payment method selection group with two radio buttons:
        * EFECTIVO
        * TRANSFERENCIA
    - A submit button labeled "Registrar Venta" (primary style, full width).
    - A dynamic message showing: "Se generarán [N] etiquetas en [P] hoja(s) A4" → **Wait, this is from HU6. For HU7, it should be about the sale.**
        Correction: For HU7, the dynamic message should show the total sale amount and maybe the number of items? Actually, the requirement doesn't specify a dynamic message for the sale page. Let's re-read the prompt-4.md.

Looking back at prompt-4.md, there is no mention of a dynamic message for the sale page. The dynamic message about labels is from HU6.

So for HU7, we should adjust. The sales page should perhaps show a summary of the sale before submitting? The prompt does not specify. It only says:
    - "Acción: 'Registrar Nueva Venta' → Modal con: selector producto (busca por código/nombre), precio compra, cantidad"

But that was for the internal sales module (HU4?). For HU7, the prompt says:
    - "Acción: "Página de ventas externa" (`/venta-externa`):
        - **Acceso restringido**: redirige a `/login-externo` si no hay sesión válida
        - UI ultra-simple (mobile-first, single column):
          - Logo/título: "Venta Rápida - [Nombre Comercio]"
          - Buscador de producto: por **código o nombre** (reutiliza `ProductSearch` de FASE 2, pero modo inline o compacto)
          - Selector de cantidad: input number (mínimo 1, paso 1)
          - Selector de método de pago: radio buttons `EFECTIVO` | `TRANSFERENCIA` (omitir `MIXTO` para simplicidad en externo)
          - Botón: "Registrar Venta" (primario, full-width)"

So there is no dynamic message about totals. We will remove that from our spec.

3.2. (continued)
    - Instead, we can have a summary section that shows the total amount and the payment method breakdown? Not required by the spec, but we can add it for clarity. However, to stick to the spec, we will not add extra requirements.

    We will stick to the exact requirements: product search, quantity input per product, payment method selection, and submit button.

3.3. The product search shall be identical to the one used in the internal sales and inventory modules (HU3/HU8), allowing the user to type and see matching products.

3.4. When a product is selected from the search results, it shall be added to the list of selected products with a default quantity of 1. The user can then adjust the quantity.

3.5. The user can remove any product from the list using the remove button.

3.6. The submit button shall be disabled if there are no products in the selection or if any quantity is less than 1.

3.7. Upon clicking the submit button, the system shall:
    - Collect the list of selected products with their quantities and the selected payment method.
    - Call a Server Action (e.g., `createExternalSaleAction`) that in turn calls the `createExternalSale` function (see section 4).
    - If the action succeeds, display a success message: "Venta registrada #<SALE_ID>" and clear the form (reset product selection, quantities, and payment method to default).
    - If the action fails (e.g., insufficient stock, product not found), display an error message with the specific reason (e.g., "Stock insuficiente", "Producto no encontrado").

### 4. Sale Creation Logic
4.1. The `createExternalSale` function (in `src/app/actions/external-sale.ts`) shall:
    - Accept an array of items, each with: productId (string), quantity (number), paymentMethod ('EFECTIVO' or 'TRANSFERENCIA').
    - For each item:
        * Retrieve the product by ID using the existing `getProductById` function (or similar) to get the current stock and base price.
        * Validate that the requested quantity is greater than zero and does not exceed the current stock.
        * If any validation fails, return an error indicating the specific problem (e.g., "Stock insuficiente para el producto X").
    - If all items are valid, perform a database transaction that:
        * Creates a new Sale record with:
            - date: current timestamp
            - totalAmount: sum of (quantity * price) for all items
            - amountPaid: 
                - If all items are EFECTIVO: totalAmount
                - If all items are TRANSFERENCIA: 0
                - If mixed: This case should not happen because we are not allowing MIXTO, but we can support per-item payment method? The spec says selector of method of payment (single selection). So the entire sale has one payment method.
                - We will assume the payment method is selected for the entire sale, not per item.
                - Therefore, we will have a single payment method for the entire sale.
                - So we need to adjust: the payment method is selected once for the entire sale, not per item.
                - Let's re-read the prompt-4.md: it says "Selector de método de pago: radio buttons `EFECTIVO` | `TRANSFERENCIA`". This implies a single selection for the entire sale.
                - Therefore, we will change the input to the `createExternalSale` function to include a single payment method for the entire sale, and each item will have the same payment method.
                - However, the items might have different prices and quantities.
                - We will adjust the function signature accordingly.
        * We will change the design: the payment method is selected for the entire sale, not per item.
        * So the function will take:
            - items: Array<{ productId: string, quantity: number }>
            - paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA'
        * Then, for each item, we validate stock and compute subtotal (quantity * price).
        * The totalAmount is the sum of subtotals.
        * If paymentMethod is EFECTIVO:
            - amountPaid = totalAmount
            - pendingBalance = 0
          If paymentMethod is TRANSFERENCIA:
            - amountPaid = 0
            - pendingBalance = totalAmount
        * Create a Sale record with the above fields and customerId: null.
        * For each item, create a SaleItem record linking to the sale, with the productId, quantity, and price (unit price from product).
        * Update the stock of each product by subtracting the quantity (using the existing stock update logic, which should be part of the sale creation transaction).
    - The transaction shall ensure that either all operations succeed or none are applied.
    - Upon success, return an object with { success: true, saleId: <new sale id> }.
    - Upon failure, return { success: false, error: <error message> }.

### 5. Security Considerations
5.1. All validation and business logic (stock checks, payment calculation, etc.) shall occur in Server Actions to prevent client-side tampering.
5.2. The login action shall use rate limiting to prevent brute-force attacks on the two credentials.
5.3. The JWT secret shall be at least 32 bytes long and stored in an environment variable (not in the codebase).
5.4. The cookie shall be set with the Secure flag (only sent over HTTPS) and SameSite=Strict to prevent CSRF.
5.5. Error messages shown to the user shall not reveal sensitive information (e.g., "Credenciales inválidas" instead of "Email incorrecto" or "Contraseña incorrecta").

### 6. Non-functional Requirements
6.1. The system shall be implemented using the existing Next.js 16 (App Router) and TypeScript setup.
6.2. Styling shall follow the existing Tailwind CSS v4 conventions and use the same color palette and component styles as the rest of the application.
6.3. All server actions shall be async and return serializable results (or throw errors that are caught and converted to error messages).
6.4. The code shall be linted and type-checked with the existing ESLint and TypeScript configurations.
6.5. The system shall not introduce any breaking changes to the existing internal authentication or sales functionality.

## Acceptance Tests (from the prompt-4.md)
### Unit Tests
- `external-auth.test.ts`:
    - Test that valid credentials return a user object.
    - Test that invalid credentials return null.
    - Test that the password comparison is timing-safe (or at least that we use bcrypt.compare).
    - Test that the JWT token is correctly created and verified.
    - Test that the cookie helpers set and get the cookie correctly.
    - Test rate limiting: after 5 failed attempts, the next attempt is blocked until the window resets.

### Integration Tests
- `external-sale-action.test.ts`:
    - Test that a sale with sufficient stock succeeds and decrements stock correctly.
    - Test that a sale with insufficient stock returns an error and does not modify stock.
    - Test that the payment method correctly sets amountPaid and pendingBalance.
    - Test that the sale and sale items are created in the database.
    - Test that the transaction rolls back if any part fails.

### E2E Tests (using Playwright or similar)
- Login flow:
    - Navigate to `/login-externo` → fill in wrong credentials → see error message.
    - Fill in correct credentials → redirect to `/venta-externo`.
    - Attempt to access `/venta-externo` directly without login → redirect to `/login-externo`.
- Sale flow:
    - Login with valid credentials.
    - Search for a product, select it, set quantity, choose payment method.
    - Submit the sale → see success message with sale ID.
    - Verify that the stock of the product decreased by the correct amount.
    - Verify that a new sale record exists in the database with the correct fields.
    - Try to submit a sale with quantity zero → validation error, button disabled.
    - Try to select a product with insufficient stock → error message.
- Session expiry:
    - Login and wait 15 minutes → attempt to access `/venta-externo` → redirected to login.

## Open Questions
- [ ] Should we display the business name (e.g., from an environment variable) in the header of the venta-externo page? The prompt-4.md does not specify, but we can add a configurable title.
- [ ] Should the session expiration be sliding (reset on activity) or fixed? We propose fixed 15 minutes for simplicity, but we can make it configurable.
- [ ] Should we limit the number of items per sale? Not specified; we will allow multiple items as in internal sales.

## References
- Prompt-4.md: The original requirements for HU7.
- Existing codebase for product search (HU3/HU8) and sale creation (Fase 1 and Fase 2).