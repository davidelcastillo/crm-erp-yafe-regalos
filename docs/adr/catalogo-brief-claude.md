# Brief — Fase de diseño del catálogo externo (solo diseño, no código)

Este es un encargo de **diseño en modo plan**. No escribas código de implementación, no toques la
base de datos, no hagas commits. Tu único entregable es un documento de diseño.

## Contexto que tenés que leer primero (en este orden)

1. `docs/adr/catalogo-externo.md` — la fuente de verdad del cambio: invariante
   (existencias ≠ publicación ≠ presentación), modelo (`CatalogItem`, `CatalogItemBranch`,
   `ProductImage`), vista `catalog_public`, ADR-01 a ADR-13 (12 y 13 ya decididos).
2. `docs/adr/catalogo-externo-er.mmd` y `docs/adr/catalogo-externo-mapa.mmd` — modelo y capas.
3. `STYLE.md` — el lenguaje visual vigente.
4. El portal público actual para no repetir sus errores: `src/app/sucursal/[branchId]/inventory/`
   y `src/lib/components/ExternalInventoryTable.tsx`.
5. Componentes existentes reutilizables: `BottomNav`, modales de stock
   (`StockAdjustmentModal`, `MoveStockModal`), `BranchPicker`, `CategorySelector`.

## Restricciones duras

- **Estilo del front actual**: no propongas un rediseño ni un design system nuevo. El catálogo v1
  usa el lenguaje visual y los componentes que ya existen. Cambiar el estilo es una fase posterior
  que el dueño todavía no pidió.
- **Plan free de Supabase**: miniatura en grilla, foto grande solo en ficha, hasta 4 fotos por
  producto, redimensionado en el navegador antes de subir. Nada que suponga transformaciones de
  imagen del lado del servidor.
- **Catálogo global** como supuesto de trabajo (ADR-01 sigue pendiente de confirmación con el
  cliente final: si tu diseño depende de que sea global, marcalo).
- La ruta pública es una adición a la allowlist del proxy; el catálogo lee por la vista
  `catalog_public`, jamás con grants sobre las tablas.

## Entregable

Escribí `docs/adr/catalogo-externo-diseno.md` en español, con:

1. **Página pública del catálogo**: estructura de grilla y ficha de producto; cómo se ve la
   etiqueta de sucursales (varias, una, ninguna); estado de agotado («Consultar» vs «Disponible»);
   qué NO se muestra (stock exacto, datos internos).
2. **Admin de curaduría**: dónde vive (¿página nueva, sección de inventario, desde la card de
   producto?), flujo para publicar/despublicar, toggle de sucursales nombrables por producto,
   orden y destacados. Mobile-first, como todo el sistema.
3. **Subida de fotos**: flujo UX de hasta 4 fotos por producto (desde dónde se suben, reorder,
   borrado, estados de error, tamaño máximo y feedback).
4. **Preguntas abiertas numeradas**: todo lo que no puedas decidir solo con el ADR, como preguntas
   concretas para el dueño, no como supuestos.
5. **Desacuerdos**: si algo de este brief o del ADR te parece inconsistente con el código o con
   los límites, decilo explícitamente en una sección final. No lo resuelvas por tu cuenta.

No modifiques ningún otro archivo. Si necesitás aclarar algo antes de arrancar, escribí tus
preguntas al final del mismo documento y avisá que está listo.
