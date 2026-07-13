# Change: FASE 3 - Crear producto inline desde modal de Compra

## Contexto
- FASE 1+2 completadas: Product tiene `price`, `code` (AAA000), `codePrefix`
- Modal "Registrar Nueva Compra" en `src/app/compras/components/AddPurchaseButton.tsx`
- Formulario de producto ya existe: `src/app/productos/components/ProductForm.tsx` (reutilizable)
- Action `createProduct` en `src/actions/product.ts` funciona (precio + código auto)

## Requerimiento
En modal de **Compra**: botón **"➕ Nuevo producto"** al lado del selector de productos.
- Click → abre **modal anidado** (bottom sheet encima) con `ProductForm` completo
- Usuario llena: **Nombre** + **Prefijo (letras)** + **Precio** → código auto-generado (HU2)
- Al guardar: 
  1. Cierra modal producto
  2. **Dropdown compra se actualiza** (refetch productos)
  3. **Nuevo producto queda seleccionado** automáticamente
  4. Datos ya ingresados en compra (cantidad, precio compra) **se conservan**
- Fluido: sin recargar página, sin perder estado

## Criterios de aceptación

### UI/UX
1. Botón "➕ Nuevo producto" visible junto al select de productos en modal compra
2. Modal producto: reusa `ProductForm` (nombre + prefijo + precio, validaciones Zod)
3. Mobile: bottom sheets apilados (compra 90vh → producto 90vh encima, z-index correcto)
4. Al crear: toast "Producto creado" → dropdown actualizado + nuevo seleccionado
5. Cancelar modal producto → vuelve a compra sin cambios

### Lógica
6. `createProduct` action existente funciona (ya valida prefijo, genera código, precio)
7. Dropdown compra: `getProducts` se re-ejecuta tras crear (SWR/react-query o manual refresh)
8. Estado compra preservado: `purchaseItems` (cantidad, precioCompra) no se pierden
9. Si usuario cancela creación → dropdown sin cambios, estado compra intacto

### Tests
10. Unit: `ProductForm` validaciones (ya existen)
11. Integration: flujo completo compra → crear producto → seleccionado
12. E2E: usuario crea compra, agrega producto nuevo, completa compra, verifica stock

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/app/compras/components/AddPurchaseButton.tsx` | Agregar botón "Nuevo producto" + estado modal anidado |
| `src/app/compras/components/PurchaseModal.tsx` | (Nuevo o extender) Manejar modal producto anidado + refresh dropdown |
| `src/app/productos/components/ProductForm.tsx` | **Reusar** tal cual (props: `onSuccess`, `initialData?`) |
| `src/actions/product.ts` | `createProduct` ya existe — solo usar |
| `src/actions/purchase.ts` | `getProducts` para refresh dropdown (ya existe) |
| Tests: `purchase-create-product.test.tsx`, e2e |

---

## Notas técnicas
- **Estado compartido**: `AddPurchaseButton` maneja `showProductModal` + `selectedProductId`
- **Refresh dropdown**: `mutate` key de `getProducts` o `router.refresh()` si Server Component
- **Z-index**: modal compra `z-50`, modal producto `z-60` (Tailwind)
- **Accesibilidad**: `aria-modal`, focus trap en modal anidado
- **DRY**: `ProductForm` no se duplica — se importa y usa

---

## Dependencias
- ✅ FASE 1: `price`, `code`, `codePrefix` en Product
- ✅ FASE 2: `ProductForm` validado, `createProduct` funcional
- ❌ No tocar schema ni migraciones