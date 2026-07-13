# Change: FASE 2 - Ventas: Búsqueda por código/nombre + Método de pago

## Contexto
- FASE 1 completada: Product tiene `price` (Decimal), `code` (String @unique, formato AAA000), `codePrefix`
- 102 productos migrados con códigos en `code`, `description` limpiada
- Modal "Nueva Venta" existe en `src/app/ventas/components/AddSaleButton.tsx`
- Página Inventario existe en `src/app/inventario/page.tsx` + `InventarioList.tsx`
- Schema Sale actual: `id`, `date`, `totalAmount`, `amountPaid`, `pendingBalance`, `customerId?`, `items[]`

## Requerimientos

### HU3 + HU8: Búsqueda universal por código Y nombre (Ventas + Inventario)
**Componente reutilizable**: `ProductSearch` (`src/components/ui/ProductSearch.tsx`)

#### En Modal Venta (Agregar producto)
- Input búsqueda visible al abrir modal (placeholder: "Buscar por código o nombre...")
- Debounce 300ms, max 10 resultados
- Resultados muestran: **Código | Nombre | Precio | Stock**
- Click/Enter selecciona → autocompleta formulario (nombre, precio, código)
- Botón "Ver todos" → lista completa si búsqueda vacía

#### En Página Inventario
- Input búsqueda en header de la lista
- Mismo comportamiento: filtra por `code` ILIKE %q% OR `name` ILIKE %q%
- Filtrado in-place (no modal), lista se actualiza dinámicamente
- Combinar con filtros existentes (stock bajo, etc.) → AND

#### Action compartida
- `searchProducts(query: string)` en `src/actions/product.ts`
  - Retorna `{ code, name, price, stock }[]` (max 20)
  - Query: `WHERE code ILIKE %query% OR name ILIKE %query%`
  - Usar índice compuesto si existe (`@@index([code, name])`)

---

### HU4: Método de pago en Venta (Transferencia / Efectivo / Mixto)

#### Schema
- Enum `PaymentMethod`: `EFECTIVO` | `TRANSFERENCIA` | `MIXTO`
- Sale: agregar `paymentMethod PaymentMethod @default(EFECTIVO)`

#### Lógica automática amountPaid / pendingBalance
| paymentMethod | amountPaid | pendingBalance |
|---------------|------------|----------------|
| `EFECTIVO`    | = totalAmount | 0 |
| `TRANSFERENCIA` | 0 | = totalAmount |
| `MIXTO`       | input manual (efectivo + transferencia) | total - amountPaid |

#### UI en Modal Venta
- Selector visible (radio group o select) — default `EFECTIVO`
- Si `MIXTO`: mostrar 2 inputs number (monto efectivo, monto transferencia)
- Validación: suma = totalAmount
- Guardar en BD

#### Mostrar en
- Lista ventas (`SalesList.tsx`): badge/chip con método
- Dashboard: filtro por método, totales por método

---

## Criterios de aceptación combinados

### Búsqueda (HU3+HU8)
1. `searchProducts(query)` action funciona y retorna datos correctos
2. `ProductSearch` componente reutilizable (mode: 'modal' | 'inline')
3. Modal venta: búsqueda integrada, selecciona → llena form
4. Inventario: búsqueda en header, filtra lista in-place
5. Mobile: touch-friendly, scrollable, full-width inputs
6. Tests: unit (search), integration (modal + inline), e2e

### Método pago (HU4)
7. Schema: enum + campo en Sale + migración
8. Modal venta: selector + lógica auto amountPaid/pendingBalance
9. `MIXTO`: 2 inputs, validación suma = total
10. Lista ventas: badge método visible
11. Dashboard: filtros/totales por método
12. Tests: unit (lógica paid/pending), integration, e2e

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | Enum PaymentMethod, Sale.paymentMethod |
| `src/actions/product.ts` | `searchProducts(query)` |
| `src/actions/sale.ts` | create/update con lógica paymentMethod |
| `src/lib/validations/sale.ts` | Zod schema venta con paymentMethod |
| `src/components/ui/ProductSearch.tsx` | **Nuevo** componente reutilizable |
| `src/app/ventas/components/AddSaleButton.tsx` | Modal integra ProductSearch + paymentMethod selector |
| `src/app/ventas/components/SalesList.tsx` | Badge método de pago |
| `src/app/inventario/components/InventarioList.tsx` | Header integra ProductSearch (inline) |
| `src/app/dashboard/components/*` | Filtros/totales por método (opcional, puede ser follow-up) |
| Tests: `product-search.test.ts`, `sale-payment.test.ts`, e2e |

---

## Notas técnicas
- **Índice**: agregar `@@index([code, name])` en Product si no existe (FASE 1)
- **Debounce**: `useDeferredValue` o `setTimeout` 300ms en cliente
- **Mobile**: modales = bottom sheets 90vh, search input sticky top
- **Reutilización**: `ProductSearch` recibe `onSelect` (modal) o `onFilter` (inline)
