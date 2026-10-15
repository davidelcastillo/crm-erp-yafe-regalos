# Guías del proyecto

El trabajo nuevo usa **ODD**, con preguntas de alcance por bug antes de implementar. SDD queda como historial cerrado, no como una lista de tareas a ejecutar.

## Recorrido recomendado

1. [Instrucciones del repositorio](../AGENTS.md): límites, stack, entorno y verificación.
2. [Flujo ODD por bug](flujo-odd.md): datos de reproducción, preguntas y cierre.
3. Guía del módulo:
   - [Gestión de sucursales](gestion-sucursales.md).
   - [Catálogo público de sucursal](portal-externo-sucursal.md).
   - [Exportar inventario a PDF](exportar-inventario-pdf.md).
4. [Estilo visual](../STYLE.md) para UI/CSS.

## Actual frente a histórico

- `odd/tasks/`: documentos de trabajo que requieren continuidad; sus estados y evidencia se conservan también en Engram, proyecto `seguimientos-compras`.
- [Historial SDD](../openspec/README.md): cierre administrativo, artefactos originales y comprobaciones pendientes al retirarlo. Cerrado no significa verificado de nuevo.
- `docs/history/`: prompts y antecedentes preservados durante la limpieza. No son instrucciones vigentes.

## Base de datos para tests

Los tests que escriben datos corren contra un stack local de Supabase en Docker, nunca contra un proyecto remoto:

1. `supabase db start` — levanta la base local desechable (configuración en `supabase/config.toml`; `supabase stop` la baja).
2. `npm run db:local:push` — aplica el esquema de Prisma a esa base.
3. `npm run test:local-db` — corre la suite contra ella.

`scripts/local-db.mjs` resuelve la URL del stack local, rechaza cualquier host que no sea local y avisa si la base no está levantada. `prisma db push` contra una base con datos ajenos sigue necesitando autorización explícita.

## Antes de ejecutar comandos

Los scripts SQL/TS de reparación son mantenimiento manual, no pasos de instalación ni de arranque. No usar credenciales de producción para probar una corrección.
