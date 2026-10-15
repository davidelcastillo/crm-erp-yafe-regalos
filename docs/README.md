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

## Antes de ejecutar comandos

Los checks con BD necesitan un destino aislado y autorizado. Los scripts SQL/TS de reparación son mantenimiento manual, no pasos de instalación ni de arranque. No usar credenciales de producción para probar una corrección.
