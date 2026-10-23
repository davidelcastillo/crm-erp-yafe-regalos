# Caja y cierre de caja

Dos cosas distintas, y conviene no mezclarlas: la **plata que entra o sale sin ser una venta** (movimientos de caja) y el **corte** que vuelve a arrancar los indicadores (cierre de caja). Ninguna de las dos toca el stock ni borra ventas.

## Movimientos de caja

- Dónde: `/ventas`, botón **Caja**.
- Qué registra: ingresos y egresos de plata de **una** sucursal (correcciones de conteo, cambio, gastos pagados de la caja), en efectivo o por transferencia.
- Cada movimiento lleva **fecha propia**, elegible al cargar: un ajuste de un día anterior se registra con ese día.
- El saldo de la sucursal sale de sus movimientos (ingresos − egresos), y el libro muestra los últimos movimientos con esos totales.
- Entra en el **balance del dashboard**: los ingresos suman a los ingresos del tablero y los egresos a los egresos, dentro del período elegido.
- No toca ventas ni stock. Para mover **productos** los modales están en `/inventario` (Mover Stock y Entrada/Salida): son el mismo tipo de libro, con otra cosa adentro.

## Cierre de caja

- Dónde: `/ventas`, botón **Cerrar caja**. Pide primero la sucursal y después calcula el corte de esa sucursal desde su último cierre.
- Qué muestra: el total en **efectivo** (lo que se retira), el total en **transferencia** (lo que se verifica) y el total en **mixto** aparte — una venta mixta no guarda cuánto fue de cada medio. Cada línea abre su desglose «ventas X + ingresos Y − egresos Z», para que el número cierre contra el listado. Los medios con total 0 no se muestran; uno en **negativo** sí, porque la caja quedó corta y el número tiene que decirlo.
- Qué suma: las **ventas** y los **movimientos de caja** de la sucursal posteriores a su último cierre, **cada uno en su medio** (un ingreso suma al efectivo, a la transferencia o al mixto; un egreso resta). Sirve como corrección cuando una venta se cargó mal, sin tocar la venta.
- La **ventana** es la misma que la de las ventas: un movimiento con fecha anterior al último cierre no entra, y uno posterior entra una sola vez (el siguiente cierre mueve el piso).
- Qué hace al confirmar: guarda el corte, con los movimientos ya sumados y restados en sus columnas. Los cortes ya guardados **no se recalculan**: quedan como se firmaron. Desde ahí:
  - los **indicadores** del dashboard arrancan de cero: las ventas y la plata anteriores a ese cierre dejan de contar;
  - en el **listado de ventas**, las ventas de la caja anterior se ven con el fondo oscurecido y el rótulo «Caja anterior», y las nuevas quedan en blanco;
  - **nada se borra**: el histórico sigue completo y la caja anterior se reconstruye sumando lo anterior al corte.
- Qué **no** hace: no toca stock, no cierra la caja de las otras sucursales, no bloquea ventas nuevas y no abre columnas nuevas: los movimientos de caja quedan plegados en los totales del corte.
- Las **compras** no son la caja: siguen el período elegido y no se resetean con el cierre.

## Dónde vive

- Acciones: `src/app/actions/cash.ts` (`registerCashMovement`, `getCashMovements`, `getCashClosePreview`, `closeCash`); esquemas Zod en `src/lib/validations/cash.ts`.
- Piso del cierre para los indicadores y para el listado: `src/lib/cash-close.ts`.
- Modelos: `CashMovement` y `CashClose` en `prisma/schema.prisma`.
- UI: `src/app/ventas/components/CashMovementsModal.tsx` y `src/app/ventas/components/CashCloseModal.tsx`.
