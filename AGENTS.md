# AGENTS.md — Seguimientos-compras / Stark Commerce OS

Instrucciones de trabajo para este repositorio. **ODD es el flujo vigente; SDD queda como historial cerrado.**

## 0. Contexto del proyecto

Sistema mobile-first de gestión comercial: inventario por sucursal, productos y categorías, compras, ventas y pagos, clientes/deudas, movimientos, dashboard y catálogo externo de solo lectura.

**Stack:** Next.js 16.2.4 (App Router), React 19.2, TypeScript 5, Prisma 6.19.3, PostgreSQL/Supabase, Tailwind 4, Zod 4, Recharts, SweetAlert2, pdf-lib.

### 0.1 Documentación: orden de lectura

1. Este archivo.
2. [docs/README.md](docs/README.md).
3. [STYLE.md](STYLE.md) si vas a tocar UI/CSS.
4. El documento ODD de la feature en `odd/tasks/` si existe.
5. El código y sus consumidores. `openspec/` **solo como antecedente histórico**.

Si un documento y el código se contradicen, **no decidas por tu cuenta**: reportá la diferencia y preguntá.

### 0.2 Límites del dominio y seguridad

- Preservar validaciones de stock, pagos/deudas, sucursal y transacciones. Revisar el efecto en compras, ventas y movimientos antes de tocar una función compartida.
- No ejecutar migraciones, reparaciones de datos ni operaciones Supabase/Vercel sin autorización explícita.
- El catálogo `/sucursal/[branchId]/inventory` es **público, de solo lectura y opt-in**: la acción exige sucursal existente, activa y `isPublic=true`. No requiere el login antiguo `branch_user`, y no se reemplaza ese control ocultando un enlace en la UI.
- **RLS y permisos de la Data API de Supabase se comprueban en el entorno real.** Hay advertencias históricas de RLS deshabilitado en producción: tratalas como pendiente, nunca como resuelto ni como bug confirmado por sí solas.
- Rutas internas: sesión + rol `admin`. Una redirección del proxy **no** autoriza una mutación.

### 0.3 Idioma

Conversación y documentación en español. Conventional Commits (sin atribuciones a IA). No traducir identificadores existentes como efecto lateral.

### 0.4 Criterio de riesgo (cuándo parar y avisar)

Requiere aviso explícito y espera de respuesta: tocar dinero o deudas, stock real, permisos/auth, borrar o migrar datos, o producir pérdida irreversible de información.

### 0.5 Protocolo ODD

1. **Recibir el pedido.**
2. **Clasificar:** inline, si es chico y está entendido; ODD con documento, si necesita continuidad.
3. **Si falta un dato de producto:** preguntar (bloquea la implementación de ese bug, no del resto del plan).
4. **Reproducir** el caso antes de concluir que ya funciona.
5. **Implementar**, con RED → GREEN cuando el comportamiento es verificable.
6. **Verificar** y **cerrar** con evidencia observada, no supuesta.

Cada bug nuevo entra como unidad propia: reproducir → preguntar → implementar → verificar → siguiente. Detalle en [docs/flujo-odd.md](docs/flujo-odd.md).

## 1. Skills disponibles y carga selectiva

Índice local: `.atl/skill-registry.md` (generado por la herramienta; no se versiona). Cargar solo lo relevante, no todo el registro.

| Skill | Cuándo usarlo | Ruta |
|---|---|---|
| `next-best-practices` | App Router, RSC, Server Actions, caché | `skills/next-best-practices/SKILL.md` |
| `vercel-react-best-practices` | React/Next y rendimiento | `skills/vercel-react-best-practices/SKILL.md` |
| `supabase` | Auth, clientes, RLS, operaciones Supabase | `.agents/skills/supabase/SKILL.md` |
| `supabase-postgres-best-practices` | SQL y rendimiento en PostgreSQL | `.agents/skills/supabase-postgres-best-practices/SKILL.md` |
| `prisma-postgres` | Aprovisionamiento/operaciones Prisma Postgres | `.agents/skills/prisma-postgres/SKILL.md` |
| `mobile-design` | UI móvil, navegación, formularios, targets táctiles | `.agents/skills/mobile-design/SKILL.md` |
| `frontend-design` | Diseño de vistas y componentes | `skills/frontend-design/SKILL.md` |
| `ui-ux-pro-max` | Criterio de UI/UX y sistemas de diseño | `skills/ui-ux-pro-max/SKILL.md` |
| `cognitive-doc-design` | Guías, README, instrucciones | resolver en el registro |
| `context7-mcp` | Documentación actual de librerías | resolver en el registro |
| `work-unit-commits`, `chained-pr`, `branch-pr` | Unidades de revisión y entrega | resolver en el registro |

Antes de delegar, pasá las rutas exactas de los skills necesarios. Si falta una capacidad, decilo; no simules su ejecución ni impongas comandos de otro runtime.

## 2. Entorno y memoria

`.env` no se versiona ni se imprime. Plantilla: `.env.example`. Node **>=20.9.0** (requisito del Next instalado).

| Variable | Uso |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Conexión Prisma; confirmar el destino antes de cualquier operación de datos |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto Supabase del cliente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública del cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Compatibilidad con consumidores existentes |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor; nunca al cliente |
| `NEXT_PUBLIC_APP_ENV` | Entorno declarado; no prueba por sí solo que la base sea de desarrollo |
| `NEXT_PUBLIC_FEATURE_*` | Flags de la plantilla; verificar consumidores antes de asumir que controlan algo |
| `BRANCH_EMAIL_DOMAIN`, `ADMIN_EMAIL` | Aprovisionamiento heredado y destino de scripts administrativos |

**Base aislada:** usar una base separada de producción antes de correr tests que escriben. **En este repo no hay stack local de Supabase configurado** (`supabase/config.toml` no existe): Docker 29.8.2 está disponible y el CLI de Supabase es invocable, pero haría falta `supabase init` y `supabase start` para tener un stack local, o bien un proyecto Supabase aparte. Definí con el responsable cuál usar antes de ejecutar algo que escriba datos.

**Engram:** usar `project: "seguimientos-compras"`. Hay memorias históricas bajo `crm-erp-yafe-regalos` y variantes del nombre: consultarlas si hace falta, sin duplicar ni fusionar automáticamente. Para retomar: contexto → búsqueda del topic → observación completa → archivo local → reconciliar.

## 3. Metodología de desarrollo: ODD

### 3.1 Entrada de un bug: preguntas antes de implementar

1. Un bug por vez: pasar la lista, elegir ítem, no implementar todo junto.
2. Leer el recorrido afectado y preguntar **solo lo que falta**: pasos de reproducción, resultado actual, esperado, entorno/rol/sucursal, límites del cambio.
3. Confirmar alcance y criterios observables. No repetir preguntas ya respondidas ni armar un cuestionario fijo.
4. **Reproducir el fallo antes de concluir que ya funciona.**
5. Con el alcance aclarado, aplicar ODD.

Ficha breve, si hace falta: [docs/flujo-odd.md](docs/flujo-odd.md).

### 3.2 Clasificación

- **Chico y entendido:** inline; sin documento, con requisitos, diff y checks que permitan retomarlo.
- **Con continuidad:** antes de escribir código, crear `odd/tasks/<feature>.md` + espejo completo en Engram (`topic: odd/<feature>/tasks`). Orden: encabezado → `## Specs` (S# citando textual al usuario) → `## Tasks` (T#, S#, ruta, estado, commit) → `## Log` (pedido original y evidencia). Mantener archivo, memoria y todo visibles sincronizados. Nunca marcar hecho sin evidencia observada.

### 3.3 Implementación y delegación

- Explorar antes de escribir.
- Delegar exploración cuando el contexto se infla; delegar escritores solo por paralelismo real o necesidad de contexto, no por contar archivos.
- Los subagentes reciben el documento/T#/S#, límites de edición y comandos de verificación autorizados. No amplían alcance ni deciden por el usuario.
- Mantener validación Zod, autorización en fronteras de confianza y manejo de errores que evita pérdida de datos.
- Para APIs de librerías, consultar Context7; para Next, también sus guías instaladas.

### 3.4 Verificación

- Comportamiento determinista: test primero, observar RED, implementar GREEN, refactorizar. Agregar regresión del comportamiento previo que comparte el código modificado.
- Documentación/movimientos sin comportamiento nuevo: explicar por qué no hay RED significativo y comprobar estructura, referencias e integridad.
- Registrar comandos, salida relevante y fallos/saltos reales.
- UI: verificar el flujo; no sustituir pruebas de navegador por leer JSX.
- **Comandos que existen hoy** (no ejecutar lo que no existe): `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- **No hay E2E en CI** ni migraciones Prisma reproducibles: no afirmes cobertura E2E ni instalaciones implícitas.

### 3.5 Definition of Done

- [ ] Criterios de aceptación observados (o limitación explícita que requiere decisión).
- [ ] RED/GREEN o justificación N/A escrita.
- [ ] Checks aplicables ejecutados contra el entorno permitido.
- [ ] Documentación afectada actualizada.
- [ ] Evidencia y estado del documento ODD/espejo actualizados.
- [ ] Sin borrados, migraciones ni publicación no autorizados.

### 3.6 Reporte al usuario

1. Qué corregí.
2. Dónde (`archivo:línea`).
3. Cómo lo verifiqué (comando + resultado).
4. Qué queda pendiente o como deuda.
5. Qué necesito del usuario (si algo).

## 4. Reglas de trabajo

- **No reescribir archivos enteros.** Editá solo lo necesario salvo que el archivo sea nuevo o esté mal por completo; si no, preguntá.
- **Lazy loading de skills** por subagente; no saturar su contexto.
- **Respuestas breves** en el chat: resultado final, sin cuadros de resumen innecesarios.
- ODD es el proceso actual; `openspec/` no es un backlog activo.
- Cambios mínimos y completos: reutilizar patrones, sin dependencias ni abstracciones para un futuro no pedido.
- No borrar código, SQL, prompts ni trazabilidad por estar aparentemente sin uso: inventariar, buscar consumidores y pedir autorización con la lista concreta.
- Respetar cambios locales ajenos; no usar `git add .`, `git clean`, resets ni force push para despejar el árbol.
- `STYLE.md` rige UI/CSS; preservar accesibilidad, targets táctiles y estados de error.

## 5. Documentación técnica

| Recurso | Referencia |
|---|---|
| Stack y comandos reales | `package.json`, `package-lock.json` |
| Next.js | https://nextjs.org/docs/app |
| Prisma 6 | https://www.prisma.io/docs |
| Supabase | https://supabase.com/docs |
| Tailwind 4 | https://tailwindcss.com/docs |
| Zod | https://zod.dev/ |
| Testing Library | https://testing-library.com/docs/react-testing-library/intro/ |

## 6. Checklist rápido por tarea

- [ ] Pedido autorizado y alcance aclarado.
- [ ] Rama, diff y consumidores identificados.
- [ ] Documento ODD/espejo si requiere continuidad; skills pertinentes.
- [ ] Base aislada antes de ejecutar tests que escriben datos.
- [ ] RED/GREEN o justificación N/A.
- [ ] `npm run lint` y `npx tsc --noEmit` cuando corresponda; `npm test` y `npm run build` para cerrar.
- [ ] Documentación, evidencia y memoria actualizadas.
- [ ] Riesgos y limitaciones informados; nada publicado sin autorización.

## 7. Estructura y Git

- `src/app/`: páginas y Server Actions de negocio (`src/app/actions/`).
- `src/actions/`: acciones de autenticación existentes; no unificar árboles sin tarea específica.
- `src/components/`, `src/lib/`: UI compartida, validaciones, contexto, clientes y utilidades.
- `src/proxy.ts`, `src/middleware/`: redirecciones y acceso a rutas externas.
- `prisma/`, `supabase/`, `scripts/`: esquema y mantenimiento; `scripts/legacy/` es historial de reparación.
- `docs/`: guías actuales; `docs/history/`: prompts preservados.
- `odd/tasks/`: trabajo con continuidad; `openspec/`: historial SDD cerrado.

- Trabajo sustancial en rama de feature, con commits por unidad. El presupuesto de ~400 líneas es guía de entrega, no un tope: no recortar pruebas ni artefactos para ajustarse.
- Para cambios grandes, acordar cadena de ramas/PRs o entrega única antes de publicar.
- No crear `develop`, publicar, abrir PRs ni fusionar por arrastre de una plantilla ajena.
- RDD depende del switch del usuario: consultar su estado y seguir las continuaciones nativas. Un receipt no autoriza commit, push, PR ni merge.
