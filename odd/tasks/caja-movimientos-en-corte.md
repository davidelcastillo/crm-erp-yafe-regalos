# Corte de caja con movimientos de plata

El cierre de caja suma (ingresos) y resta (egresos) los movimientos de caja al total del corte, cada uno en su medio, para poder corregir un error de carga de una venta sin tocar la venta.

## Specs

- **S1** (pedido, verbatim): «ahora que los ingresos/egresos de plata tambien sumen o resten al total al cerrar la caja, asi lo usamos como correcion cuando cargamos algo mal de una venta».
- **S2** (decisión del usuario sobre cómo): **cada movimiento en su medio** — efectivo suma/resta al efectivo del corte, transferencia a la transferencia, mixto a mixto. Un ingreso en efectivo sube el efectivo a retirar; un egreso lo baja.
- **S3** (decisión del usuario sobre la lectura): **el modal muestra el desglose** de ventas + ingresos − egresos por medio, para que el total cierre contra el listado.
- **S4**: la ventana es la misma que la de las ventas: movimientos con `date` posterior al último `closedAt` de la sucursal. Un movimiento con fecha anterior al último cierre no entra; uno posterior entra una sola vez (el siguiente cierre mueve el piso).
- **S5**: un egreso puede dejar el total de un método en negativo; no se recorta a cero (la caja quedó corta y el número tiene que decirlo).
- **S6**: los cortes ya guardados **no se recalculan**: sus columnas quedan como se firmaron. Sin migración: los movimientos se pliegan en las columnas que ya existen (`cashTotal`, `transferTotal`, `mixedTotal`, `total`).
- **S7**: la regla documentada cambia: `docs/caja-y-cierre.md` decía que el corte **no** suma movimientos; pasa a decir que sí y con qué ventana.

## Tasks

- **T1** [S1,S2,S4,S5,S6] — `src/app/actions/cash.ts`: `totalesDeCaja` suma el libro de caja por medio dentro de la ventana y agrega el desglose a `getCashClosePreview`; `closeCash` persiste los totales ya mezclados. Test en `src/app/actions/cash.close.test.ts` (integración, base local): ingreso y egreso de efectivo, ingreso por transferencia, movimiento anterior al corte que no cuenta, y el caso sin movimientos que queda igual que antes.** — **hecha** (escritor `mvkdtcqk-1-krdl`): `totalesDeCaja` lee ventas y movimientos en paralelo, agrupa los movimientos por `type`+`method` con la ventana del último cierre, calcula `{ventas, ingresos, egresos, total}` por medio y devuelve `desglose`; `closeCash` persiste los totales plegados. RED observado: 5 casos fallidos (`desglose` ausente, `cashTotal: 100` en vez de `-75`, `total: 180` en vez de `25`). GREEN: 9/9. Triangulado con un `INGRESO` `MIXTO` para cubrir el tercer medio.
- **T2** [S3] — `src/app/ventas/components/CashCloseModal.tsx` (+ su test): cada línea por medio muestra «ventas X + ingresos Y − egresos Z»; las líneas con total 0 se siguen ocultando; nada de colores de tema hardcodeados en las dos `Swal.fire` del archivo (ver `odd/tasks/sweetalert-tema-oscuro.md`).** — **hecha**: desglose «Ventas X + ingresos Y − egresos Z» por medio, `!== 0` en lugar de `> 0` para no esconder un medio negativo, `plata()` imprime `-$75.00`, «Total de ventas» pasó a «Total del corte» y se quitaron `background`/`color` del `Swal.fire`. RED 1 fallido (la aserción esperaba 2 nodos y hay 3) → GREEN 11/11.
- **T3** [S7] — `docs/caja-y-cierre.md`: reescribir la línea del «Qué **no** hace» y la sección del cierre con la regla nueva y la ventana.** — **hecha**: la sección del cierre suma «Qué suma» y «La ventana», el «Qué no hace» ya no dice que ignora los movimientos y aclara que no se abren columnas nuevas (S6).

## Log

- **L1 — Pedido, verbatim**: «Bueno, cambio de planes, ahora que los ingresos/egresos de plata tambien sumen o resten al total al cerrar la caja, asi lo usamos como correcion cuando cargamos algo mal de una venta». Antes de eso el usuario preguntó si el cierre contaba los movimientos; la respuesta verificada fue que no (`cash.ts:130-160` leía solo ventas, y `docs/caja-y-cierre.md:22` lo declaraba como regla). Con esta autorización la regla cambia.
- **L2 — Decisiones (2026-10-23)**: medio por medio y con desglose visible, elegidas entre las opciones presentadas (S2, S3).
- **L3 — Cierre (2026-10-23)**: T1–T3 hechas y revisadas por el padre. Checks observados: `npm run test:local-db` → **109 suites / 821 tests** (la suite del cierre subió a 9 casos y el modal a 11); `npx tsc --noEmit` 0; `npm run lint` 0 errores / 36 avisos previos; `npm run build` OK. El padre revisó el diff de `cash.ts` (ventana, signo por tipo, plegado en columnas existentes) y del modal. Deuda declarada: `registerCashMovementSchema` no acepta `method: MIXTO`, así que un movimiento mixto hoy sólo puede venir por fuera de la UI; el plegado ya está cubierto por test.
