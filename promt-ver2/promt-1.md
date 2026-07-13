# Change: FASE 1 - Precios + Código de Producto (AAA000 auto-generado)

## Contexto
Proyecto: Stark Commerce OS (Next.js 16 + Prisma + Supabase + Tailwind v4)
BD actual: 102 productos en tabla `Product` con campos: `id`, `name`, `description?`, `stock`, `createdAt`, `updatedAt`
**Importante**: La `description` actual **contiene el código de producto** (ej: "AA001", "PROD005") en los 102 registros existentes.

## Requerimientos

### HU1: Precio de venta base en Producto
- Agregar campo `price` (Decimal, 2 decimales, default 0)
- Usar en: crear/editar producto, lista, modal venta (pre-fill), dashboard analytics

### HU2: Código de producto auto-generado (prefijo letras + secuencial)
- **Nuevo campo `code`** (String, @unique) — formato: **LETRAS + 3 dígitos** (AA001, PROD000, XYZ999)
- **Nuevo campo `codePrefix`** (String, 2-4 letras) — para queries y lógica
- **Migración de datos existente**: 
  - Copiar `description` actual → `code` (los 102 productos ya tienen su código ahí)
  - Limpiar `description` → null/empty (para que sea descripción real opcional)
- **Lógica auto-generación** (nuevos productos):
  - Usuario ingresa **solo prefijo** (2-4 letras A-Z, ej: "AA", "PROD", "XYZ")
  - Sistema busca último `code` con ese prefijo y **autocompleta número +1**
  - Si no existe ninguno con ese prefijo → **empieza en 000** (ej: PROD000)
  - Formato: siempre 3 dígitos con leading zeros
  - Validar: prefijo 2-4 letras mayúsculas, code unique, max 999 por prefijo
- **Code no editable** tras creación (solo lectura), prefijo no cambia

## Criterios de aceptación combinados

### Schema & Migración
1. `prisma/schema.prisma`: Product con `price Decimal @default(0)`, `code String @unique`, `codePrefix String?`
2. Migración aplicada sin pérdida: 102 productos → `code` poblado desde `description`, `price=0`, `description=null`
3. `@@index([codePrefix])` para queries rápidas

### Lógica auto-código (nuevos productos)
4. Función pura `getNextCode(prefix: string, existingCodes: string[]): string` en `src/lib/utils/product-code.ts`
   - Input: "AA" + ["AA000","AA001"] → "AA002"
   - Input: "NEW" + [] → "NEW000"
   - Case-insensitive: "aa" → "AA"
   - Error si llega a 999
5. Transacción Prisma en `create` para evitar race conditions (retry o advisory lock)

### UI/UX
6. **Crear/Editar Producto** (`ProductForm.tsx`):
   - Campo **Precio** (number, ≥0, required)
   - Campo **Prefijo (2-4 letras)** — solo en creación; en edición: code readonly + prefijo no editable
   - Validación Zod: prefijo regex `/^[A-Z]{2,4}$/`, price ≥ 0
7. **Lista Productos** (`ProductCard.tsx`): mostrar **Código** prominente + Precio
8. **Inventario** (`InventarioCard.tsx`): mostrar Código
9. **Modal Venta** (HU3 futuro): buscar por código (preparar `searchProducts` action)

### Tests
10. Unit: `product-code.test.ts` (generación, edge cases, concurrencia)
11. Integration: `product.test.ts` (create con precio+code, migración)
12. E2E: flujo crear producto → aparece en lista con code+price → venta usa precio

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | Add price, code, codePrefix + migración data |
| `src/actions/product.ts` | create/update/get + `getNextCode` logic + search |
| `src/lib/utils/product-code.ts` | Función pura `getNextCode` (testable aislada) |
| `src/lib/validations/product.ts` | Zod schemas (create: prefix+price; update: price only) |
| `src/app/productos/components/ProductForm.tsx` | Inputs precio + prefijo (create) / code readonly (edit) |
| `src/app/productos/components/ProductCard.tsx` | Mostrar code + price |
| `src/app/inventario/components/InventarioCard.tsx` | Mostrar code |
| `src/app/dashboard/components/ProductAnalytics.tsx` | Usar price para ganancias |
| Tests: `product-code.test.ts`, `product.test.ts`, e2e |

## Notas técnicas
- **Decimal en Prisma** → `number` en TS (Prisma devuelve string/number, usar `Number()`)
- **Concurrencia código**: `prisma.$transaction` con `SELECT ... FOR