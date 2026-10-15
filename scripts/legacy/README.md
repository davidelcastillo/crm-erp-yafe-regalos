# Scripts históricos

Se conservan por su valor de reparación/historia; **no son pasos de instalación ni de arranque** y no se ejecutan desde `package.json`.

| Archivo | Origen | Uso |
|---|---|---|
| `migrate.sql` | Raíz del repo antes de la transición ODD del 2026-10-15 | Migración SQL inicial: `PaymentMethod`, código/precio de `Product`, `paymentMethod` de `Sale` e índice único de `Product.code`. Escrito para una base concreta; revisar el destino antes de usarlo |
| `populate-branch-codes.ts` | Raíz del repo, igual origen | Reparación puntual: completa `Branch.code` en filas antiguas con `NULL`. Requiere el alias `@/lib/prisma`, por lo que se ejecuta desde el contexto del proyecto |

Los backfills referenciados por documentación archivada siguen en `scripts/` (`backfill-admin-claim.mjs`, `backfill-branch-authuserid.mjs`).