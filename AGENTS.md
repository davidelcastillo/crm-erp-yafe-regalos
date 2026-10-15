# AGENTS.md — Seguimientos-compras / Stark Commerce OS

Configuración de trabajo para este repositorio. **ODD es el flujo vigente**; SDD se conserva únicamente como historial cerrado. Adaptado de la estructura de `AGENTSVER2.md`, sin importar decisiones de su proyecto de origen.

## 0. Contexto del proyecto

Sistema mobile-first de gestión comercial: inventario por sucursal, productos y categorías, compras, ventas y pagos, clientes/deudas, movimientos, dashboard y catálogo externo de solo lectura.

Stack instalado: **Next.js 16.2.4, React 19.2, TypeScript 5, Prisma 6.19, PostgreSQL/Supabase, Tailwind 4, Zod 4, Recharts, SweetAlert2 y pdf-lib**. Consultar `package.json` y `package-lock.json` antes de asumir versiones. No migrar el stack como efecto lateral de una corrección.

### 0.1 Documentación: orden de lectura

1. Este archivo y [docs/README.md](docs/README.md).
2. [STYLE.md](STYLE.md) si hay UI/CSS.
3. La guía del módulo y, si existe, el documento ODD de la feature en `odd/tasks/`.
4. El código y sus consumidores/tests; [openspec/README.md](openspec/README.md) solo para antecedentes.

Una contradicción entre requisitos aprobados, documentación y código se informa y se aclara; no se resuelve inventando una regla de negocio. Las instrucciones del runtime activo conservan su precedencia.

### 0.2 Límites del dominio y de seguridad

- Preservar validaciones de stock, pagos/deudas, sucursal y transacciones existentes. Revisar sus efectos en compras, ventas y movimientos antes de modificar una función compartida.
- No borrar datos, ejecutar migraciones, reparar registros ni operar Supabase/Vercel sin autorización explícita para el entorno elegido.
- Las rutas internas requieren sesión y rol `admin`; no confundir una redirección del proxy con autorización de una mutación en el servidor.
- El catálogo `/sucursal/[branchId]/inventory` es público, de solo lectura y opt-in: la acción exige una sucursal existente, activa y con `isPublic=true`. No requiere el login antiguo `branch_user`.
- Que una sucursal no esté publicada debe impedir devolver su inventario. No reemplazar este control por ocultar un enlace en la UI.
- El estado real de RLS y los permisos de la API de Supabase se comprueban en el entorno autorizado: no se deducen del proxy ni de un informe histórico.

### 0.3 Idioma

Conversación y documentación del proyecto en español. Conservar nombres y convenciones existentes en código, contratos y UI; no traducir identificadores como parte de otra tarea. Commits con Conventional Commits, sin atribuciones automáticas a IA.

## 1. Skills disponibles y carga selectiva

El índice resoluble es `.atl/skill-registry.md`; el `SKILL.md` de cada skill es su fuente de verdad. Cargar únicamente lo relevante, no todo el registro. No asumir que una herramienta o skill de otro runtime está instalada.

| Skill | Cuándo usarlo | Ubicación de proyecto o resolución |
|---|---|---|
| `mobile-design` | UI móvil, navegación, formularios, accesibilidad táctil | `.agents/skills/mobile-design/SKILL.md` |
| `next-best-practices` | App Router, RSC, Server Actions, caché | `skills/next-best-practices/SKILL.md` |
| `vercel-react-best-practices` | React/Next y rendimiento | `skills/vercel-react-best-practices/SKILL.md` |
| `frontend-design` | Diseño de vistas y componentes | `skills/frontend-design/SKILL.md` |
| `supabase` | Auth, clientes, RLS y operaciones Supabase | `.agents/skills/supabase/SKILL.md` |
| `supabase-postgres-best-practices` | Consultas y rendimiento PostgreSQL | `.agents/skills/supabase-postgres-best-practices/SKILL.md` |
| `prisma-postgres` | Aprovisionamiento/operaciones Prisma Postgres cuando corresponda; no confundir con toda consulta Prisma ORM | `.agents/skills/prisma-postgres/SKILL.md` |
| `cognitive-doc-design` | Guías e instrucciones | Resolver en el runtime/registro |
| `context7-mcp` | Documentación actual de librerías | Resolver en el runtime/registro |
| `work-unit-commits`, `chained-pr`, `branch-pr` | Unidades de trabajo y entrega revisable | Resolver en el runtime/registro |

Antes de delegar, comprobar el registro y pasar las rutas exactas de los skills necesarios. Actualizarlo con la herramienta disponible solo si hace falta y está autorizado; no imponer comandos de OpenCode en Pi ni escribir caches durante una investigación de solo lectura. Si falta una capacidad, declararlo sin simular su ejecución.

## 2. Configuración de entorno y memoria

Node debe cumplir la versión exigida por Next instalado (actualmente **>=20.9.0**). `.env.example` contiene la plantilla; `.env` no se versiona ni se imprime en herramientas o informes.

| Variable | Uso |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Conexión Prisma; comprobar el destino antes de cualquier operación de datos |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto Supabase del cliente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública usada por el cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Compatibilidad cuando un consumidor existente la utilice |
| `SUPABASE_SERVICE_ROLE_KEY` | Administración solo en servidor; nunca exponerla al cliente |
| `NEXT_PUBLIC_APP_ENV` | Entorno declarado; no prueba por sí solo que la BD sea de desarrollo |
| `NEXT_PUBLIC_FEATURE_*` | Flags documentados en la plantilla; comprobar sus consumidores antes de asumir que controlan una funcionalidad |
| `BRANCH_EMAIL_DOMAIN` | Aprovisionamiento heredado de usuarios de sucursal |
| `ADMIN_EMAIL` | Destino explícito para scripts administrativos que lo admitan |

Los nombres DEV/PROD guardados en memoria no acreditan la configuración actual. No correr tests de integración ni scripts de mantenimiento sin identificar una base aislada y su autorización.

**Engram:** usar explícitamente `project: "seguimientos-compras"`. Existen memorias históricas bajo `crm-erp-yafe-regalos` y variantes del nombre; consultarlas si hace falta, sin duplicarlas, borrarlas ni fusionarlas automáticamente. Para retomar una feature: contexto → búsqueda del topic → observación completa → archivo local → reconciliación.

## 3. Metodología de desarrollo: ODD

### 3.0 Forma de trabajo

El humano define producto y alcance; el orquestador mantiene el contexto, coordina las herramientas disponibles y responde por el resultado. Pi es el runtime de esta sesión; no se exige alternar entre Claude Code y OpenCode ni un modelo específico.

Trabajar por unidades pequeñas y verificables, sin mezclar una corrección con refactors o nuevas funcionalidades no acordadas.

### 3.1 Entrada de un bug: preguntas antes de implementar

Flujo detallado y ficha: [docs/flujo-odd.md](docs/flujo-odd.md).

1. Recibir la lista y elegir un bug con el usuario; no implementar toda la lista como un bloque.
2. Leer el recorrido afectado y preguntar lo que falte: pasos/datos de reproducción, resultado actual, resultado esperado, entorno/rol/sucursal y límites del cambio.
3. Confirmar el alcance y los criterios observables. No repetir preguntas ya respondidas ni convertir cada bug en un cuestionario fijo.
4. Reproducir el fallo antes de concluir que ya funciona. Si no se reproduce, registrar el caso y pedir la evidencia concreta que falta.
5. Con el alcance aclarado, aplicar ODD. Una pregunta de producto pendiente detiene la implementación de ese bug.

### 3.2 Clasificación y trazabilidad

Todo pedido entra por autorización → exploración → resolución de dudas → clasificación → implementación → verificación → cierre.

- **Pequeño y entendido:** ejecución inline, sin artefactos durables innecesarios; requisitos, diff y checks deben permitir retomarlo.
- **Trabajo que necesita continuidad:** crear antes de escribir código `odd/tasks/<feature>.md` y su espejo completo en Engram, topic `odd/<feature>/tasks`.
- Orden del documento: encabezado breve, `## Specs` con S# y citas exactas, `## Tasks` con T#/S#/ruta/estado/commit, `## Log` al final con la solicitud original y evidencia posterior.
- Dentro de Specs, explicitar diseño de datos, arquitectura, interfaz y procedimiento; usar N/A con motivo cuando no corresponda. No inventar una aprobación humana.
- Mantener sincronizados archivo, memoria y todo visible después de cada transición. Nunca marcar como hecho lo que no tiene evidencia.
- El diseño y la profundidad se ajustan a la incertidumbre y el riesgo; no crear ceremonias o dependencias entre runtimes por defecto.

### 3.3 Implementación y delegación

Explorar antes de escribir. Delegar un mapa acotado cuando la investigación exceda el presupuesto de contexto; delegar escritores por paralelismo real con superficies disjuntas o necesidad de contexto, no por contar archivos. Una verificación independiente corresponde a cambios de alto riesgo según el harness activo.

Los subagentes reciben el documento/T#/S# por referencia, límites de edición y comandos de verificación autorizados. No pueden ampliar el alcance ni decidir por el usuario. Si una capacidad requerida no está disponible, reportar el límite.

Mantener validación con Zod, autorización en fronteras de confianza y manejo de errores que evita pérdida de datos. Para librerías, consultar Context7 antes de escribir código que use sus APIs; para Next, consultar también sus guías instaladas si están disponibles. No inventar disponibilidad de documentación, MCP o herramientas.

### 3.4 Verificación y Definition of Done

- Para comportamiento determinista: test primero, observar RED, implementar GREEN y luego refactorizar. Añadir regresión del comportamiento previo que comparte el código modificado.
- Para documentación/movimientos sin comportamiento nuevo: explicar por qué no hay RED significativo y comprobar estructura, referencias e integridad.
- Tests aplicables y criterios de aceptación observados; registrar comandos, salida relevante y fallos/saltos/pendientes reales.
- UI: verificar el flujo y accesibilidad móvil según herramientas disponibles; no sustituir pruebas de navegador por lectura de JSX.
- Documentación afectada actualizada en la misma unidad.
- Para trabajo con trazabilidad: tareas, evidencia, commits autorizados y espejo reconciliados.
- Informar resultado, riesgo y siguiente paso; no declarar pruebas manuales, despliegues o bases verificadas si no se observaron.

## 4. Reglas de trabajo

- ODD es el proceso actual. [SDD archivado](openspec/README.md) no es un backlog activo ni una fuente de órdenes para ejecutar tareas antiguas.
- Cambios mínimos y completos: reutilizar patrones existentes, sin dependencias ni abstracciones para un futuro no pedido.
- Ediciones dirigidas; reescribir un archivo completo solo cuando su estructura completa deba cambiar, como esta transición de instrucciones.
- No borrar código, scripts SQL, prompts ni trazabilidad por estar aparentemente sin uso. Inventariar, buscar consumidores y obtener autorización de la lista de borrado.
- Respetar modificaciones locales ajenas; no usar `git add .`, `git clean`, resets ni force pushes para despejar el árbol.
- `STYLE.md` rige UI/CSS. Preservar accesibilidad, targets táctiles y estados de error.
- Respuestas breves: decisión, resultado y próximo paso, con bloqueos concretos.

## 5. Documentación técnica y herramientas de calidad

| Recurso | Referencia |
|---|---|
| Stack y comandos reales | `package.json`, `package-lock.json` |
| Next.js | https://nextjs.org/docs/app |
| Prisma 6 | https://www.prisma.io/docs |
| Supabase | https://supabase.com/docs |
| Tailwind 4 | https://tailwindcss.com/docs |
| Zod | https://zod.dev/ |
| React/Testing Library | https://testing-library.com/docs/react-testing-library/intro/ |

Disponibles: Jest + React Testing Library (`npm test`), ESLint (`npm run lint`), TypeScript (`npx tsc --noEmit`) y build (`npm run build`). Hay antecedentes de tests con BD real: revisar aislamiento antes de la suite. **No hay script `test:e2e` ni Playwright declarado** en el baseline de esta transición; no afirmar cobertura E2E ni instalarla implícitamente. El historial SQL conservado no equivale a migraciones Prisma reproducibles.

## 6. Checklist de entrada y cierre

- [ ] Pedido autorizado y alcance aclarado; preguntas del bug resueltas.
- [ ] Rama, diff local y consumidores del recorrido identificados.
- [ ] Documento ODD/espejo cuando haga falta continuidad; skills pertinentes cargados.
- [ ] Entorno de datos aislado antes de ejecutar tests que acceden a BD.
- [ ] RED/GREEN o justificación N/A; verificaciones pertinentes observadas.
- [ ] Documentación, evidencia, tareas y memoria actualizadas.
- [ ] Riesgos y limitaciones informados; publicación solo con autorización.

## 7. Estructura y Git

- `src/app/`: páginas y Server Actions de negocio en `src/app/actions/`.
- `src/actions/`: acciones de autenticación existentes; no unificar árboles sin una tarea específica.
- `src/components/`, `src/lib/`: UI compartida, validaciones, contexto, clientes y utilidades.
- `src/proxy.ts`, `src/middleware/`: redirecciones y decisión de acceso a rutas externas.
- `prisma/`, `supabase/`, `scripts/`: esquema y mantenimiento; no ejecutarlos durante exploración.
- `docs/`: guías actuales; `docs/history/`: prompts y antecedentes preservados.
- `odd/tasks/`: unidades actuales con continuidad; `openspec/`: historial SDD cerrado.

Trabajo sustancial en rama de feature, con commits por unidad cuando estén autorizados. Revisar el presupuesto de unas 400 líneas autoradas como guía de entrega, sin recortar pruebas o artefactos obligatorios para ajustarse. Para cambios grandes, acordar cadena de ramas/PRs o entrega única antes de publicar. No crear `develop`, publicar, abrir PRs ni fusionar por arrastre de una plantilla ajena.

RDD depende del switch del usuario: consultar su estado, aplicar assessment y seguir las continuaciones nativas cuando correspondan. Un receipt no autoriza commit, push, PR ni merge. No exigir reviews para cada checkbox ni fabricar receipts.
