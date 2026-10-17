# Change: HU7 - Página externa de ventas (login de 2 usuarios predefinidos)

## Contexto
- Necesidad: URL pública (`/venta-externa` o similar) donde **usuarios externos** (ej: cajeros en mostrador, personal temporal) puedan registrar ventas **sin acceso al resto del sistema**
- Solo **2 usuarios específicos** permitidos (credenciales predefinidas en variables de entorno)
- Acceso limitado: **únicamente** registrar venta (producto, cantidad, método de pago) → confirmación
- **Ningún acceso** a: lista de productos completa, inventario, compras, clientes, dashboard, configuración
- Autenticación simple: sesión corta (ej: 15 min) o token en cookie httpOnly
- Base existente: Ya tenemos lógica de venta (FASE 2) y búsqueda de productos (HU3/HU8)

## Requerimiento
Crear un **módulo público aislado** con:
1. **Página de login** (`/login-externo`):
   - Campos: Email, Password
   - 2 usuarios válidos (definidos en `.env`):
     - `EXTERNAL_USER_1_EMAIL`, `EXTERNAL_USER_1_PASSWORD`
     - `EXTERNAL_USER_2_EMAIL`, `EXTERNAL_USER_2_PASSWORD`
   - Validación: credenciales exactas (no hash en DB, pero sí comparado seguro vía `bcrypt.compare` o similar)
   - Al éxito: establecer cookie httpOnly `session-token` (JWT firmado con secreto de servidor) o redirigir a `/venta-externa`
   - En caso de fallo: mensaje "Credenciales inválidas" (sin especificar cuál es incorrecto por seguridad)
2. **Página de ventas externa** (`/venta-externa`):
   - **Acceso restringido**: redirige a `/login-externo` si no hay sesión válida
   - UI ultra-simple (mobile-first, single column):
     - Logo/título: "Venta Rápida - [Nombre Comercio]"
     - Buscador de producto: por **código o nombre** (reutiliza `ProductSearch` de FASE 2, pero modo inline o compacto)
     - Selector de cantidad: input number (mínimo 1, paso 1)
     - Selector de método de pago: radio buttons `EFECTIVO` | `TRANSFERENCIA` (omitir `MIXTO` para simplicidad en externo)
     - Botón: "Registrar Venta" (primario, full-width)
   - Al enviar:
     - Valida: producto seleccionado, cantidad ≥1
     - Llama a Server Action `createExternalSale` (nueva)
     - En éxito: muestra mensaje "Venta registrada #<ID>" + opción "Nueva venta" (limpia form)
     - En error: muestra error específico (stock insuficiente, producto no encontrado, etc.)
   - **No muestra**: precios de costo, ganancias, stock detallado (solo confirma que hay stock suficiente al validar)
3. **Lógica de venta externa**:
   - Reutiliza validación de stock existente (evita venta si cantidad > stock)
   - Calcula `totalAmount = cantidad * precioProducto` (precio base de producto, **no editable** por externo)
   - Establece:
     - `paymentMethod`: según selección (EFECTIVO/TRANSFERENCIA)
     - `amountPaid`: 
       - `EFECTIVO` → = totalAmount
       - `TRANSFERENCIA` → = 0 (pendiente)
     - `pendingBalance`: totalAmount - amountPaid
   - `customerId`: `null` (venta mostrador/anónima)
   - Guarda venta estándar en tabla `Sale` + `SaleItem` (reutilizando esquema existente)
4. **Seguridad y límites**:
   - Rate limit en login: 5 intentos cada 15 minutos por IP
   - Sesión: expira en 15 minutos (configurable)
   - CORS: solo permitir peticiones desde mismo dominio (Next.js)
   - SQLi/XSS: protegido por Prisma ORM y React escaping (validar pero confiar en stack)
   - **NO** exponer rutas de admin/api internos (todo bajo `/api/external/*` si se usa API route)
   - Mensajes de error genéricos en login (no revelar si usuario existe o no)

## Criterios de aceptación
1. **Autenticación**:
   - Login solo funciona con las 2 credenciales de `.env`
   - Cookies son httpOnly, secure (en producción), sameSite=strict
   - Sesión expira tras 15 min de inactividad (refresh on activity opcional)
   - Intento fallido → mensaje genérico + rate limit visible después de 3 fails
2. **Página `/venta-externa`**:
   - Redirige a login si no autenticado
   - UI muestra solo: buscador producto, cantidad, método pago, botón submit
   - Buscador funciona exactamente como en venta interna (HU3/HU8) pero en modo compacto
   - Al vender: stock se reduce correctamente (verificado en inventario)
   - Mensaje de éxito incluye ID de venta (ej: "Venta #1001 registrada")
3. **Lógica de venta**:
   - Precio usado: **precio base del producto** (HU1), no editable por externo
   - Método de pago afecta `amountPaid`/`pendingBalance` como en venta interna (HU4)
   - Stock verificado antes de crear transacción (evita negatividad)
4. **Tests**:
   - Unit: `external-auth.test.ts` (validación de credenciales, rate limit)
   - Integration: `external-sale-action.test.ts` (crear venta con stock, pago correcto)
   - E2E: 
     - Login fallido → mensaje de error
     - Login exitoso → registrar venta → verificar stock disminuyó
     - Acceso directo a `/venta-externa` sin login → redirige a login
     - Después de 15 min → sesión expirada → redirige a login

## Archivos a modificar/crear
| Archivo | Acción |
|---------|--------|
| `.env` | Agregar: `EXTERNAL_USER_1_EMAIL`, `EXTERNAL_USER_1_PASSWORD`, `EXTERNAL_USER_2_EMAIL`, `EXTERNAL_USER_2_PASSWORD`, `EXTERNAL_SESSION_SECRET` |
| `src/lib/auth-external.ts` | **Nuevo**: utilidades para verificar credenciales, crear/validar sesión JWT |
| `src/middleware.ts` | Agregar ruta `/venta-externa/*` a protección (o crear `/app/(external)/middleware.ts`) |
| `src/app/login-externo/page.tsx` | **Nuevo**: página de login |
| `src/app/venta-externo/page.tsx` | **Nuevo**: página de venta externa (protected) |
| `src/app/venta-externo/components/ExternalSaleForm.tsx` | **Nuevo**: formulario con buscador producto + cantidad + método pago |
| `src/actions/external-sale.ts` | **Nuevo**: Server Action `createExternalSale` (reutiliza lógica de venta interna pero con restricciones) |
| `src/actions/product.ts` | Reusar `searchProducts` (ya existe) |
| `src/lib/rate-limit.ts` (opcional) | Utilidad para rate limit en login (simple in-memory o Redis si escala) |
| Tests: `external-auth.test.ts`, `external-sale-action.test.ts`, e2e flow |

## Notas técnicas
- **Sesión JWT simples**: 
  - Al login exitoso: firmar payload `{ userId, email, exp: Date.now() + 900000 }` (15 min) con `EXTERNAL_SESSION_SECRET`
  - Verificar en middleware/route protector
  - **No usar cookies de NextAuth** (overkill para 2 usuarios) → custom lighter
- **Reutilización máxima**:
  - Misma lógica de stock y cálculo de total que venta interna (FASE 4)
  - Misma acción de búsqueda de productos (`searchProducts` de HU3/HU8)
  - Evitar duplicar código: poner venta compartida en `src/actions/sale-base.ts` si es necesario
- **UI mínima**:
  - Usar mismos estilos de Tailwind v4 que el resto de la app
  - Botón primario: `bg-[#ff385c] text-white` (color marca de la app)
  - Inputs: `border-border rounded-md p-2`
  - Mensajes: `text-sm text-red-500` para errores, `text-green-600` para éxito
- **Manejo de errores**:
  - En acción externa: lanzar `Error` con mensaje amigable (ej: "Stock insuficiente", "Producto no encontrado")
  - En componente: mostrar `error.message` en `alert`-like component
  - Nunca exponer stack traces ni detalles de BD
- **Escalabilidad futura**: 
  - Si crecen los usuarios, migrar a tabla `ExternalUser` en BD con roles
  - Pero por ahora: 2 usuarios hardcodeados en `.env` es suficiente y simple
- **No tocar**:
  - Schema de `Sale`/`SaleItem` (ya existe y es apto)
  - Lógica de transacción de stock (ya probada en FASE 1+2)
  - Seguridad de rutas internas (seguirán protegidas por auth estándar)