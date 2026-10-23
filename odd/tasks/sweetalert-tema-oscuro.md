# SweetAlert legible en tema oscuro

Todas las alertas de SweetAlert2 se ven en el tema actual (oscuro incluido) sin colores de tema hardcodeados en las llamadas.

## Specs

- **S1** (pedido, verbatim): «Cuando se cierra la caja el sweeet alert sale en blanco, corregir todos los sweet alert desde el inicio, y asi con todos las alertas de sweetalert para el tema oscuro, veamos eso».
- **S2**: la causa observada es un color de tema pasado por opción: `CashCloseModal.tsx` cerraba con `background: "#ffffff"` y `color: "#222222"`, y SweetAlert aplica esas opciones como estilo inline, que gana sobre el bloque `[data-theme="dark"] .swal2-*` de `globals.css`. Ninguna llamada pasa `background`/`color` de tema.
- **S3**: el tema se resuelve en un solo lugar (`globals.css`), no por llamada. El tema **claro** tiene que quedar visualmente igual que hoy.
- **S4**: cubre el DOM completo que dibuja SweetAlert: popup, título, contenido, `html` propio, inputs, footer, iconos, botones (confirm/cancel/close), loader, mensaje de validación y el velo del fondo.
- **S5**: los colores por llamada que son **semánticos** (rojo para borrar, verde para éxito) se mantienen; los que sólo repetían el tema o la marca se van.
- **S6**: no se rompe ninguna alerta: texto, iconos y acciones quedan iguales; sólo cambia cómo se pintan.

## Tasks

- **T1** [S2,S5] — Quitar `background` y `color` de todas las `Swal.fire` del producto y centralizar esos valores en el tema (`:root` para claro, `[data-theme="dark"]` para oscuro). Decidir caso por caso `confirmButtonColor`: se mantiene si es semántico, se va si es la marca.** — **hecha**: 37 opciones `background: "#ffffff"` / `color: "#222222"` borradas de 9 archivos (dejaban el popup y el texto en claro pase lo que pase) y los valores del tema claro centralizados en `:root` de `globals.css`. Los botones quedan como estaban: `--palette-brand-action` es el mismo `#6d28d9` que ya pasaban las llamadas.
- **T2** [S4] — Completar el bloque `[data-theme="dark"]` de `globals.css` para el DOM que hoy no cubre: iconos, `swal2-close`, `swal2-footer`, `swal2-loader`, velo, y el `html` propio que use clases literales claras.** — **hecha**: reglas nuevas para el velo (`.swal2-backdrop-show`), `.swal2-close`, `.swal2-footer`, `.swal2-loader` y `.swal2-timer-progress-bar`; los botones se acotan a `.swal2-styled` para no pisar los que usan `buttonsStyling: false` con `btn-primary`/`btn-danger`. Verificado que no hay ningún `html:` propio con clases claras (`grep` → 0).
- **T3** [S3,S6] — Verificación: `npx tsc --noEmit`, `npm run lint`, `npm run build`, las suites de los componentes tocados y una revisión visual del usuario sobre el flujo real (contar con su ojo: no hay test que vea colores).** — **parcial**: `npx tsc --noEmit` 0, `npm run lint` 0 errores / 36 avisos, `npm run build` OK, `npm run test:local-db` **109 suites / 821 tests** (incluye las 4 suites de componentes con `Swal`). Falta **la revisión visual del usuario** en producción: la única prueba de color posible.

## Log

- **L1 — Pedido, verbatim**: «Ya que estamos, Cuando se cierra la caja el sweeet alert sale en blanco, corregir todos los sweet alert desde el inicio, y asi con todos las alertas de sweetalert para el tema oscuro, veamos eso».
- **L2 — Diagnóstico (2026-10-23)**: 69 `Swal.fire` en 22 archivos, con 94 opciones de color hardcodeadas en 16 archivos. `globals.css:558-605` ya tiene un bloque oscuro para SweetAlert, pero las opciones inline lo pisan. `CashCloseModal.tsx` es la que reportó el usuario y la arregla la unidad de `odd/tasks/caja-movimientos-en-corte.md`.
- **L3 — Alcance acordado**: el modal del cierre de caja lo toca sólo la unidad del corte (superficies disjuntas, sin dos escritores sobre el mismo archivo).
- **L4 — Ejecución (2026-10-23)**: el escritor `mvkdu1dr-2-3nqk` hizo el CSS de `globals.css` (+47/−4) y **se colgó en el primer `read`**, dejando las 94 opciones inline intactas: con eso el bug seguía, porque el inline gana sobre el CSS sin `!important`. El padre terminó el barrido: borró las 37 opciones de tema de 9 archivos con un `perl` acotado a la forma exacta de la propiedad (37 líneas de 37 ocurrencias: sin falsos positivos) y ajustó 3 aserciones de `AddPurchaseButton.test.tsx` que fijaban esos colores. Los 6 colores “semánticos” del `grep` inicial son de `src/lib/status-tones.ts` (badges de estado), no de `Swal`, y no se tocaron. Los `confirmButtonColor`/`cancelButtonColor` por llamada se conservan: son semánticos y se leen bien en los dos temas.
- **L5 — Regresión ajena detectada y corregida acá**: el commit anterior (`a98e9e4`, control de stock) dejó `src/app/actions/stockControl.local-db.test.ts` sin `export {}`, así que quedó como script global y **rompía `npx tsc --noEmit` en una compilación fría** (12 errores por redeclaración con `purchase.scale.test.ts`). El build de Next no lo veía porque el caché incremental (`tsconfig.tsbuildinfo`) estaba caliente. Se agregó `export {}` y se verificó: sin el arreglo, `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit` → 12 errores; con el arreglo → 0. Va en este mismo commit.
