# Bugfix: FASE 2 - ProductSearch no persiste name/code en modal Venta

## Contexto
- FASE 2 completada: `ProductSearch` funciona y busca correctamente
- Modal "Nueva Venta": `src/app/ventas/components/AddSaleButton.tsx` → abre modal con `ProductSearch`
- Al seleccionar producto en `ProductSearch`: **solo se actualiza `price`**, `name` y `code` **no se guardan en el estado del formulario**
- Error al guardar: "Debo seleccionar al menos un producto" (porque `name`/`code` vacíos)

## Problema técnico
`ProductSearch` (mode='modal') usa `onSelect(product)` pero el parent (`AddSaleButton` modal) **no actualiza su estado local** con `product.name` y `product.code`. Solo reacciona a `product.price`.

El formulario de venta espera un objeto `item` con: `{ productId, name, code, price, quantity }` — pero `name` y `code` llegan `undefined`.

## Requerimiento
Fixear el flujo de selección para que **persista todos los campos** del producto seleccionado.

### En `AddSaleButton.tsx` (modal venta)
1. Estado local del form: `selectedProduct: { productId, name, code, code, code, price, quantity } | null`
2. Al `onSelect(product)` de `ProductSearch`:
   ```ts
   setSelectedProduct({
     productId: product.id,
     name: product.name,      // ← FALTABA
     code: product.code,      // ← FALTABA
     price: product.price,    // ← YA FUNCIONA
     quantity: 1
   })