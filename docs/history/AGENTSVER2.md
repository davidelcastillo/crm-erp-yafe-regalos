
This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ (resolved from this file's directory; in monorepos the next package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by next dev — verify at node_modules/next/dist/server/lib/generate-agent-files.js. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.


AGENTS.md – Configuración del agente Gentle‑AI para el proyecto Powerlifting-tournament-sist

Este archivo contiene la configuración central que debe ser consultada por el agente antes de ejecutar cualquier tarea. Incluye la metodología de desarrollo modular asistida por IA, las referencias a skills disponibles, la configuración de entornos, las reglas de trabajo y los enlaces a la documentación de las tecnologías usadas.

***
🏋️ 0. Contexto del proyecto

Plataforma para gestionar torneos de Powerlifting bajo el reglamento IPF: importación de inscripciones, pesaje, armado de tandas y grupos, mesa de control con reordenamiento de salida, arbitraje de 3 jueces con luces simultáneas (< 500 ms), scoreboard y ranking. Proyecto de grado de un único desarrollador (caso de estudio: Asociación Salteña de Powerlifting). Demo de la Fase 1: 17/11/2026.

0.1 Documentación (leer antes de proponer o diseñar)

El orden de lectura está en docs/README.md. Lo mínimo:

docs/arquitectura/decisiones.md: ADR-01 a ADR-28. Las decisiones aprobadas no se contradicen; si una tarea lo exige, se detiene y se pregunta.
docs/backlog/incremento-1.md: historias de usuario y criterios de aceptación del incremento en curso.
docs/producto/requerimientos-funcionales.md y docs/producto/bosquejo-funcional.md.

Si un documento y el código se contradicen, gana el documento y se reporta la diferencia.

0.2 Invariantes del dominio (no romper)

La bitácora (docs/bitacora-ia/entradas/000-*) registra que la IA violó estas reglas aun habiéndolas documentado. Verificarlas en cada cambio:

El atleta compite en la clase declarada (participacion.wt_class_declarada_id), no en la del pesaje. El pesaje solo valida: si supera el límite, la participación queda descalificada.
Descalificar no excluye: el descalificado (por pesaje o por blanqueo) sigue en el orden de salida y compite; solo pierde el puesto en el ranking. El ausente (NO_SHOW) sí se excluye.
Los intentos cuelgan de la participación, no de la inscripción: un movimiento compartido entre modalidades se levanta una sola vez (ADR-11).
El resultado de un intento se lee de veredicto_consolidado.resultado_vigente, nunca de intento.estado (ADR-15).
Soft delete: nada se borra físicamente (deleted_at). Las claves naturales usan índices únicos parciales WHERE deleted_at IS NULL, declarados en el esquema con @@unique(..., where: raw(...)).
IDs ULID; la columna version no se incrementa sola: actualizar con where: { id, version } y version: { increment: 1 }.
Tablas append-only: evento_auditoria, evento_tarima, reversion_jurado, cambio_peso_intento. Solo INSERT.
Toda acción sensible y todo acceso denegado se registra en evento_auditoria (HU-1.2.3).
Una regla va a la base (CHECK o índice) solo si es verdadera siempre; si depende del reloj, el orden o el rol, va a la capa de servicio (ADR-09).

0.3 Idioma

Identificadores del dominio en español, como en el esquema (participacion, tanda, pesoSolicitado). Términos técnicos genéricos en inglés (handler, schema, service).
Comentarios, documentación y mensajes de commit en español neutro.
Textos de la interfaz en español.

***
📋 1. Skills disponibles

Skill	Descripción breve	Ubicación
find-skills	Discover and install specialized agent skills from the open ecosystem when users need extended capabilities.	.agents/skills/find-skills/
frontend-design	Distinctive, production-grade frontend interfaces that reject generic AI aesthetics through intentional design choices.	.agents/skills/frontend-design/
vercel-react-best-practices	React and Next.js performance optimization across 70 rules prioritized by impact.	.agents/skills/vercel-react-best-practices/
web-design-guidelines	Audit UI code against Vercel's Web Interface Guidelines for design and accessibility compliance.	.agents/skills/web-design-guidelines/
| vercel-composition-patterns | React composition patterns for scaling components and avoiding boolean prop proliferation. | .agents/skills/vercel-composition-patterns/ |  
| next-best-practices | Next.js best practices for performance, SEO, | .agents/skills/next-best-practices/ |
| tailwind-design-system | CSS-first design system framework for Tailwind v4 with tokens, components, and responsive patterns. | .agents/skills/tailwind-design-system/ |
| tailwindcss-mobile-first | Use this skill for Tailwind CSS mobile-first responsive design: breakpoint strategy, fluid typography and spacing, touch targets, container queries, safe areas, responsive layouts, media, navigation, and mobile performance. Clave para la PWA de jueces (tablets). | .agents/skills/tailwindcss-mobile-first/ |
| STYLES | Style guide for consistent design across projects. | STYLES.md |

No aplican a este proyecto (instaladas, no cargar): turborepo (no es un monorepo) y webapp-testing (usa Playwright en Python; aquí los E2E son @playwright/test en TypeScript).

Mantener esta tabla actualizada. Antes de cada delegación ejecutar:

opencode skill run skill-registry
Usar Lazy Loading para cargar los skills solo cuando se necesiten.

***
🛠️ 2. Configuración de entorno (variables requeridas)

Asegúrate de que las siguientes variables estén definidas en el archivo .env antes de iniciar cualquier trabajo:

Variable	Descripción
DATABASE_URL	Conexión a PostgreSQL. Prisma 7 la lee desde prisma.config.ts (no desde el esquema) y no carga .env sola: usar import "dotenv/config".
DATABASE_URL_TEST	Base separada para los tests de integración (nunca la de desarrollo).
SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD	Usuario ADMIN que crea el seed. Si faltan, el seed lo omite. El password nunca se versiona.
SEED_DEMO	true para cargar el torneo de prueba.
—	La autenticación no usa variables AUTH_*: la sesión es propia (ADR-24), con token opaco en cookie httpOnly.
	El .env no se versiona; .env.example sí, con las mismas claves y valores ficticios.

Engram: usar siempre project: "tesis" explícito en cada operación; la autodetección desde el repositorio apunta a otro nombre.

***
📐 3. Metodología de desarrollo modular asistida por IA

Esta sección es el estándar de trabajo del proyecto. Su objetivo es asegurar calidad, evitar conflictos de integración en repositorios compartidos y mantener una arquitectura escalable, posicionando al desarrollador como arquitecto activo en cada decisión técnica.

3.0 Forma de trabajo OpenCode + Claude Code

Decisión

Desde gentle-ai 4.0 no existe SDD: todo pedido entra al flujo ODD (§3.4). El trabajo se reparte entre dos runtimes según el costo de tokens y el tipo de razonamiento (reparto aprobado por el autor el 07/10/2026):

Runtime	Modelos	Rol
Claude Code (suscripción Claude)	Opus	Escribe y revisa el diseño en cuatro niveles (datos, arquitectónico, interfaz, procedimental) de cada HU, dentro del documento de feature y refinando docs/diseno/. Propone un ADR cuando una decisión lo requiere. Revisa el código entregado. No escribe código de producción salvo pedido explícito del autor
OpenCode (opencode-go)	Modelos baratos (deepseek, qwen, etc.)	Explora, crea el esqueleto del documento de feature, implementa tarea por tarea con ODD (TDD, tests, commit A «tal cual lo entregó la IA») y verifica
	Motivo: se conserva el criterio de costo. El modelo caro razona y diseña; el barato ejecuta. Usar Opus vía API dentro de OpenCode consume muchos más tokens que usarlo desde Claude Code (costo plano de suscripción), y el diseño es la parte donde más rinde.

Handoff por archivos, no por comandos. El contrato entre los dos runtimes es el documento odd/tasks/<feature>.md, con su espejo en Engram (topic odd/<feature>/tasks, siempre con project: "tesis"). Ambos runtimes trabajan sobre el mismo repo y la misma base de Engram: no se copian ni se pegan artefactos entre herramientas.

Flujo

OpenCode explora y abre el documento. Crea odd/tasks/<feature>.md (y su espejo) con objetivo, problema, alcance, restricciones y lista de tareas con IDs estables, y deja la sección «Diseño» vacía con el estado «pendiente de diseño».
Handoff a Claude Code. El autor abre Claude Code en el mismo repo, elige Opus y pega la plantilla de diseño (abajo). Claude Code completa la sección «Diseño» en los cuatro niveles (N/A con motivo cuando un nivel no aplica), refina docs/diseno/ si corresponde, actualiza el espejo en Engram y deja la sección marcada «pendiente de aprobación del autor».
El autor aprueba. Revisa el diseño (los pseudocódigos de reglas del reglamento IPF son de aprobación obligatoria) y marca en el documento «Diseño aprobado por el autor: sí».
Vuelta a OpenCode. El autor pega la plantilla de implementación (abajo). OpenCode implementa tarea por tarea con TDD, un commit de unidad de trabajo por tarea y el commit A de la bitácora.
Revisión opcional por Claude Code. El autor puede pedir una revisión del código entregado contra el diseño aprobado. Las correcciones del autor van en commits B.
Bitácora. Se escribe la entrada de la HU (§3.2, paso 7).

Regla de entrada a implementación

OpenCode no empieza a escribir código de producción si el documento de feature no tiene «Diseño aprobado por el autor: sí». Única excepción: una HU cuyos cuatro niveles son N/A con motivo escrito en el documento. Si falta la aprobación, OpenCode se detiene y avisa; no la infiere.

Plantillas de prompt

Handoff OpenCode → Claude Code (diseñar)

## Handoff ODD — diseño
Feature: {feature}
Documento: odd/tasks/{feature}.md  (espejo en Engram: topic odd/{feature}/tasks, project "tesis")
Repo: {ruta-al-repo}
Runtime destino: Claude Code (modelo Opus)

Instrucciones:
1. Leé el documento odd/tasks/{feature}.md y, en Engram (project "tesis"),
   la observación del topic odd/{feature}/tasks. Si difieren, avisá y no sigas.
2. Leé AGENTS.md (§0.2 invariantes, §3.2 regla 0.1), docs/diseno/README.md y los
   criterios de aceptación de la HU en docs/backlog/.
3. Completá la sección «Diseño» del documento en los cuatro niveles: datos,
   arquitectónico, interfaz y procedimental. Marcá N/A con motivo el nivel que no
   aplique. Refiná docs/diseno/ sin contradecirlo; si una decisión lo requiere,
   proponé un ADR (no lo apruebes).
4. No escribas código de producción ni tests.
5. Dejá la sección marcada «pendiente de aprobación del autor» y
   «Diseño aprobado por el autor: no».
6. Actualizá el espejo en Engram (project "tesis", topic odd/{feature}/tasks) con el
   documento completo, y avisame «listo» con la lista de archivos tocados.

Retorno Claude Code → OpenCode (implementar)

## Retorno ODD — implementación
Feature: {feature}
Documento: odd/tasks/{feature}.md  (espejo en Engram: topic odd/{feature}/tasks, project "tesis")
Repo: {ruta-al-repo}
Runtime destino: OpenCode

Instrucciones:
1. Leé el documento y verificá que diga «Diseño aprobado por el autor: sí» (o que los
   cuatro niveles sean N/A con motivo). Si no, detenete y avisame: no escribas código.
2. Leé la sección «Diseño» completa y el espejo en Engram (project "tesis"). Si
   difieren, avisá y no sigas.
3. Implementá tarea por tarea: backend antes que frontend, TDD (RED → GREEN →
   REFACTOR), `npm test` antes de cada tarea y E2E antes de cerrar la HU. Un commit
   de unidad de trabajo por tarea, en español, sin atribución a la IA.
4. Si el código obliga a apartarse del diseño, detenete y registrá la diferencia en el
   documento; no decidas por tu cuenta.
5. Tras cada tarea, marcá el checkbox con su evidencia (comando y resultado
   observado, hash del commit) y actualizá el espejo en Engram.
6. Al terminar, el commit A de la bitácora es lo entregado «tal cual»; avisame
   «listo» con la lista de tareas cerradas y las pendientes.

Checklist de configuración

gentle-ai (4.0 o posterior) instalado y funcional en Claude Code y en OpenCode.
Engram disponible como MCP en ambos runtimes, siempre con project: "tesis".
El mismo repo se abre en ambos runtimes (mismo directorio de trabajo).
Al abrir Claude Code para diseñar o revisar, elegir Opus.
El documento odd/tasks/<feature>.md y su espejo en Engram dicen lo mismo antes de cada traspaso.

Ventajas

Token economics: Opus se paga plano (suscripción) en lugar de por token vía API en OpenCode; el modelo barato hace el trabajo de volumen.
Contexto completo: Claude Code lee el mismo repo, el mismo documento de feature y el mismo Engram; no hay pérdida de contexto en el traspaso.
Contrato legible: el diseño y su aprobación quedan escritos en un archivo versionado, sin comandos ni estado oculto entre herramientas.
Continuidad: Engram conserva el estado de la feature para cualquier sesión futura, en cualquier runtime.

Historial

Hasta gentle-ai 3.x el ciclo SDD se repartía entre ambos runtimes, con propose y design en Claude Code y el resto en OpenCode. Ese reparto y sus comandos de handoff quedaron obsoletos al eliminarse SDD en gentle-ai 4.0.0. Los artefactos de HU-1.1.1 y HU-1.2.3 en openspec/changes/** se conservan como registro histórico.

3.1 Fase 0 – Arquitectura global (solo proyectos nuevos)

Al iniciar un proyecto desde cero, establecer las bases arquitectónicas ANTES de programar la primera Historia de Usuario (HU):

Estado: decidida. Solo se modifica con un ADR nuevo.

Stack (ADR-19): Next.js 16 + TypeScript + Prisma 7 + PostgreSQL 17 en Docker. Un único proceso Node con servidor propio (server.ts) que levanta Next y ws. Sin NestJS ni Vite aparte. Despliegue en la nube en un contenedor portable (proceso persistente, no serverless).
Estructura: ver sección 7. La lógica de dominio vive en src/server/ como servicios TypeScript sin imports de Next, porque la usan tanto Next como el servidor WebSocket.
Modelo de datos: prisma/schema.prisma (aprobado; ADR-01 a ADR-18, con sesion_usuario de ADR-24 y los cambios de ADR-27 y ADR-28). Q1 a Q4 en prisma/sql/ (TypedSQL).
Mapa de exposición por módulo:

Módulo	Exposición	Prueba
Importación, pesaje, tandas y grupos, usuarios (admin)	Server Actions	Vitest contra PostgreSQL
Mesa de control y arbitraje (en vivo, bidireccional)	WebSocket (ws), mensajes validados con Zod	Vitest con cliente ws real
Scoreboard, overlays, portal (difusión, solo lectura)	Route Handler con SSE	Vitest sobre el stream + Playwright
Health check	Route Handler GET /api/health	Vitest
	Contrato de datos: schemas Zod por módulo en src/server/<modulo>/schemas.ts; los que usa también la interfaz (formularios, mensajes WS/SSE) en src/shared/. Todo dato que entra por una frontera (CSV, formulario, mensaje WS) se valida con Zod.
Orden fundacional: HU-1.1.1 (Docker + health check) → HU-1.1.2 (Prisma, migraciones, seed) → HU-1.1.3 (servidor WebSocket) → HU-1.2.x (autenticación y roles).

3.2 Ciclo de desarrollo por HU

Regla de oro: nunca solicitar un desarrollo "Full‑Stack" en un solo paso. Trabajar por slices verticales delgados: primero los flujos de mayor riesgo (validaciones, estados de error) para recibir feedback del negocio temprano.

Definition of Ready: no se inicia una HU si sus criterios de aceptación son ambiguos, si cita una regla que no está escrita o si depende de una HU sin terminar. Se pregunta al autor.
0.1. Diseño en cuatro niveles: antes de implementar, el diseño de la HU (la sección «Diseño» del documento de feature odd/tasks/<feature>.md) cubre datos, arquitectónico, interfaz y procedimental, refinando docs/diseno/ (ver su README). Lo escribe Claude Code (§3.0) y lo aprueba el autor antes de implementar, en particular los pseudocódigos de reglas del reglamento IPF. OpenCode no escribe código de producción sin «Diseño aprobado por el autor: sí» (salvo HU con los cuatro niveles N/A con motivo).
Desarrollo Full-Stack. Un solo documento de feature por HU (§3.4), cuya lista de tareas separa con claridad las de Backend y las de Frontend: primero las tareas de Backend con sus tests y luego las de Frontend. Cada tarea es una unidad de trabajo con su commit. Claude Code diseña y OpenCode implementa (§3.0).
Capa de Datos y Lógica (Backend): implementar, con las tareas de ODD de Backend, la lógica de negocio: schemas Zod (el contrato, incluyendo bordes: errores de validación, operación fallida, estados vacíos, concurrencia), DTOs, consultas a base de datos y la exposición elegida en el mapa de Fase 0.
TDD estricto: cada tarea de implementación de ODD escribe primero el test y lo ve fallar (RED), luego implementa (GREEN) y recién después refactoriza. Los criterios de aceptación de la HU son el oráculo de los tests.
Pruebas de Integración (Aislamiento): antes de tocar la interfaz visual, probar la lógica según su exposición (mapa de la sección 3.1). Server Actions y lógica pura: Vitest contra PostgreSQL. Route Handlers: Vitest llamando al handler. Postman solo como smoke test exploratorio, nunca como gate de calidad.
Capa de Presentación (Frontend): con el contrato consolidado y funcionando, ejecutar las tareas de ODD de UI. La IA estructura vistas, componentes y estados importando los tipos y schemas compartidos: la alineación frontend‑backend la valida el compilador en build time.
Pruebas End‑to‑End: testear el flujo completo desde el navegador (Playwright), verificando conexión frontend‑backend, UX y manejo de errores.
Bitácora IA: al terminar la implementación de la HU en ODD, commitear lo entregado por la IA tal cual (commit A). Las correcciones del autor van en commits aparte (B…). Luego escribir la entrada de la HU en docs/bitacora-ia/entradas/ con la plantilla v2, registrar los prompts del autor en docs/bitacora-ia/prompts/registro.md y anotar los IDs de las sesiones para exportarlas al anexo. Ver docs/bitacora-ia/README.md.
Cierre e Iteración: verificar el Definition of Done (sección 3.3) y recién entonces continuar con la siguiente HU del mismo módulo.

3.3 Definition of Done del módulo

Una HU se considera completa SOLO cuando cumple todos los criterios:

 Todos los criterios de aceptación de la HU cubiertos por al menos un test.
 Tests de la HU verdes (unitarios, integración y E2E si aplica) y npm run build sin errores.
 Migraciones aplicadas sin errores sobre una base vacía (si la HU cambia el esquema).
 Documentación actualizada en docs/ si la HU cambia una decisión, una regla o el esquema.
 Entrada de la bitácora IA escrita, con los hashes de los commits A y B.
 Demo interna de la HU (en vivo o grabada).
 Rastro del cambio cerrado: el documento odd/tasks/<feature>.md completo (tareas marcadas con su evidencia, diseño aprobado) y su espejo en Engram (project: "tesis").
 PR a develop revisado por el autor (y con su receipt, si la revisión RDD está activa).

***
3.4 Ruta de implementación: ODD

Desde gentle-ai 4.0 ODD es la única ruta (Organic Driven Development). Todo pedido se clasifica antes de la primera escritura. La ruta de ejecución NO la decide el tamaño, la cantidad de archivos ni el riesgo percibido: la decide qué hace falta para que el trabajo sea recuperable y no ambiguo.

Ruta	Cuándo	Cómo se ejecuta
Inline	Leer o decidir 1–3 archivos, o un cambio mecánico ya entendido	El orquestador lo hace directo
ODD delegada	Entender 4+ archivos, o escribir 2+ archivos no triviales	Un explorador para el mapeo + un solo writer; una unidad de trabajo por tarea
	Antes de la primera escritura, si el cambio es sustancial (dos o más pasos significativos, o progreso que vale la pena poder retomar), el orquestador crea el documento de la feature:

odd/tasks/<feature>.md en el repo, con espejo en Engram en el topic odd/<feature>/tasks (siempre con project: "tesis").
Contiene objetivo, problema, alcance, restricciones, diseño en cuatro niveles (§3.0 y §3.2, regla 0.1), checklist con IDs estables, criterios de aceptación, verificaciones aplicables, evidencia y próximo paso.
Cada tarea cierra con un commit de unidad de trabajo en la rama de la feature (si se está en la rama default, se crea la rama primero), con Conventional Commits en español y sin atribución a la IA.
El trabajo chico y ya entendido no genera documento de feature.
El reparto entre runtimes (Claude Code diseña, OpenCode implementa) y la regla de entrada a implementación están en §3.0.

Historial. SDD se usó en HU-1.1.1 y HU-1.2.3 hasta gentle-ai 4.0, que lo eliminó. Sus artefactos (openspec/changes/**) se conservan como registro histórico y no se editan. HU-1.2.3 se completó y se archivó por SDD el 05/10/2026 (PR #9 y #10, fusionados en develop). Sus acciones sensibles diferidas (AC1) las materializa cada HU dueña, por ODD.

***
🔧 4. Reglas de trabajo

ODD es la única ruta. Todo pedido entra al flujo ODD (§3.4). La ruta de ejecución la clasifica el orquestador: la cantidad de archivos, de líneas o el riesgo percibido nunca la deciden por sí solos. Claude Code diseña y OpenCode implementa (§3.0).
Delegar el trabajo pesado. A un explorador (de solo lectura) cuando haya que entender 4+ archivos y a un único writer cuando haya que escribir 2+ archivos no triviales. Nunca editar archivos directamente salvo lecturas de 1‑3 archivos, cambios mecánicos ya entendidos o comandos de estado (git, npm, etc.).
Respetar el presupuesto de líneas de cambio (review burden): unas ~400 líneas modificadas por tarea es una heurística de planificación, no un tope duro; no se recorta contenido ni se divide artificialmente para ajustarse. Al crear el documento de feature se pronostica el total; si el pronóstico o el acumulado de la rama supera ~400 líneas, se aplica la estrategia de entrega acordada con el autor (PRs encadenados, §7.2) antes del siguiente commit.
Mantener actualizado el registro de skills antes de cada delegación (sección 1).
Usar Context7 para documentación de librerías antes de escribir código que involucre Next.js, Prisma, ws, Zod o la librería de autenticación. Para Next.js, leer primero node_modules/next/dist/docs/ (versión instalada).
Aplicar buenas prácticas del stack: Server Actions para mutaciones, RSC para UI estática, Route Handlers para health check y SSE, ws para el canal en vivo (ver mapa de la sección 3.1).
Seguridad y autenticación: usuarios en la tabla usuario (modelo Usuario), contraseñas con bcryptjs. La sesión es propia, sin librería (ADR-24): token opaco cuyo SHA-256 se guarda en sesion_usuario y cookie httpOnly de 12 h. En Next 16, middleware.ts se llama proxy.ts y solo sirve para redirecciones optimistas: la autorización por rol se verifica siempre en el servidor (cada Server Action, Route Handler y mensaje WebSocket), y cada rechazo se audita con resultado = 'DENEGADO'.
Testing: unitarios e integración con Vitest (npm test) contra PostgreSQL en Docker, usando DATABASE_URL_TEST; E2E con Playwright (npm run test:e2e). Ejecutar npm test antes de cada tarea de implementación y los E2E antes de cerrar la HU.
Documentación: los documentos del proyecto viven en docs/ (ver docs/README.md). Si un cambio altera una decisión, una regla o el esquema, se actualiza el documento en el mismo PR.
Versionado y releases: Conventional Commits en español (feat(pesaje): ...). Sin líneas de atribución a la IA en los commits (Co-Authored-By u otras): la trazabilidad de la IA vive en la bitácora, con la convención de commits A/B (sección 3.2).
Prisma 7: generador prisma-client con salida en src/generated/prisma (no se versiona); conexión en prisma.config.ts; PrismaClient siempre con el adapter @prisma/adapter-pg; índices parciales con la preview partialIndexes. migrate dev ya no corre el seed: usar npx prisma db seed. Los CHECK viven en una migración SQL escrita a mano; nunca editar una migración ya aplicada.
NO REESCRIBIR ARCHIVOS ENTEROS Si se debe modificar solo una linea del archivo cambiar eso, evitar siempre escribir archivos enteros desde cero a menos que el archivo entero este mal o sea un arhivo nuevo, caso contrario preguntar siempre.
USAR LAZY LOADING PARA LAS SKILL Cada vez que lanzas un subagente, enviarle SOLO LAS SKILLS NECESARIAS, no sobrecargar su ventana de contexto con skills que no le seran de utilidad.
Respuestas en el Chat Siempre usar respuestas cortas, tratar de no hcaer cuadro de resumenes ni nada, dame la respueta final y ya, ahorremos todo lo que se pueda en escritura basura.

***
📚 5. Enlaces a documentación crítica (actualizados vía Context7)

Next.js 16 – https://nextjs.org/docs (App Router, RSC, Server Actions, middleware)
Prisma 7 – https://www.prisma.io/docs (driver adapters, prisma.config.ts, generación de cliente ESM)
Autenticación – sesión propia (ADR-24, HU-1.2.1). Se evaluaron y descartaron Auth.js (NextAuth v5) y Better Auth.
ws – https://github.com/websockets/ws (canal en vivo, HU-1.1.3)
Server-Sent Events – https://developer.mozilla.org/docs/Web/API/Server-sent_events (difusión a scoreboard y overlays)
Next.js custom server – node_modules/next/dist/docs/01-app/02-guides/custom-server.md
Tailwind CSS v4 – https://tailwindcss.com/docs
Zod v4 – https://zod.dev/
Playwright – https://playwright.dev/docs
Vitest – https://vitest.dev/

No incorporadas (evaluar cuando haga falta, con su HU): Recharts, SweetAlert2, Serwist (PWA de jueces, Incremento 3).

(El agente debe usar la herramienta Context7 para obtener la versión exacta y ejemplos de uso antes de escribir código.)

***
✅ 6. Checklist rápido antes de iniciar una nueva tarea (ODD)

 Verificar que CodeGraph este activo
 Verificar que exista el grafo de Graphify en .\graphify-out si no existe, ejecutar el comando "/graphify ."
 Verificar que .env tenga todas las variables requeridas (sección 2).
 Verificar que el servicio de base de datos esté levantado (<docker ps>).
 Ejecutar opencode skill run skill-registry.
 Confirmar el documento odd/tasks/<feature>.md y su espejo en Engram (project: "tesis"), con el diseño aprobado por el autor antes de implementar.
 Verificar el Mapa de Exposición del módulo afectado (Server Action o Route Handler) para elegir la herramienta de prueba correcta.
 Confirmar que el contrato de datos (schemas Zod) del módulo está definido y sus bordes cubiertos.
 Si la tarea implica cambios de esquema, asegurarse de que <npx prisma migrate dev> pueda ejecutarse.
 Antes de escribir código, consultar Context7 para la documentación de la librería involucrada.
 Después de escribir código, ejecutar los tests unitarios y de integración correspondientes.
 Antes de hacer commit, asegurarse de que el receipt de revisión esté disponible.
 Al finalizar, verificar el Definition of Done (sección 3.3) y cerrar el rastro: el documento ODD completo y su espejo en Engram.

***

7 Estructura por módulo

server.ts                        → servidor propio: levanta Next y `ws` en el mismo proceso
prisma/schema.prisma             → modelo de datos
prisma/migrations/               → migraciones (la de CHECK se escribe a mano)
prisma/seed.ts                   → catálogos IPF (idempotente)
prisma/sql/                      → consultas críticas Q1–Q4 (TypedSQL)
prisma.config.ts                 → conexión y seed (Prisma 7)
src/app/(routes)/<modulo>/       → páginas del módulo
src/app/api/                     → Route Handlers (health check, SSE)
src/components/<modulo>/         → componentes del módulo
src/actions/<modulo>.ts          → Server Actions del módulo (validan, autorizan y delegan en src/server)
src/server/<modulo>/             → lógica de dominio del módulo (sin imports de Next)
src/server/<modulo>/schemas.ts   → contrato de datos (Zod) del módulo
src/server/db.ts                 → instancia única de PrismaClient
src/shared/                      → schemas y tipos que usan servidor e interfaz (mensajes WS/SSE, formularios)
src/generated/prisma/            → cliente Prisma generado (no se versiona)
tests/                           → tests de integración y E2E; tests/fixtures/ para datos de prueba

7.1 Propiedad de archivos

Server Actions: cada módulo tiene SU archivo src/actions/<modulo>.ts. Son una capa delgada: validan con Zod, verifican el rol y llaman a src/server/<modulo>/. La regla de negocio no vive en la action.
Dependencias entre módulos: un módulo usa la lógica de otro importando su servicio de src/server/<otro>/, nunca duplicándola.
Base de datos: nunca editar una migración ya aplicada — crear una nueva. Todo cambio del esquema actualiza docs/arquitectura/decisiones.md si altera una decisión.
Datos personales: no versionar datos reales de atletas. Los fixtures de tests/fixtures/ son anonimizados.

7.2 Flujo de Git

Prohibido push directo a main: main solo recibe Pull Requests.
Crear una rama develop : subir todos los PR ahi y tratar como si fuera nuestra main, recien al final del desarrollo y una vez validado todo, haremos el PR a main.
Una HU = una rama feat/hu-<x.y.z>-<descripcion> = un PR a develop.
PRs chicas: máximo ~400 líneas; si se supera, partir en PRs encadenados.
Nunca force push a main ni a develop.
Cada commit debe dejar el proyecto compilando (unidad de trabajo íntegra), salvo el commit A de la bitácora si lo entregado por la IA no compila: en ese caso se aclara en el mensaje y el commit B lo corrige.
Cada dependencia nueva entra con la HU que la justifica, y se registra en su entrada de la bitácora.

***
#Contex-Mode 
Verificar instalacion con ctx stats

|Slash Command	|What it does|
|/context-mode:ctx-stats	|Context savings — per-tool breakdown, tokens consumed, savings ratio.|
|/context-mode:ctx-doctor	|Diagnostics — runtimes, hooks, FTS5, plugin registration, versions.|
|/context-mode:ctx-index	|Index a local file or directory into the persistent FTS5 knowledge base.|
|/context-mode:ctx-search	|Search previously indexed content.|
|/context-mode:ctx-upgrade	|Pull latest, rebuild, migrate cache, fix hooks.|
|/context-mode:ctx-purge	|Permanently delete all indexed content from the knowledge base.|
|/context-mode:ctx-insight|	Opens the hosted Insight dashboard (context-mode.com/insight) in your browser — org analytics for AI-assisted engineering teams.|

context-mode — MANDATORY routing rules

context-mode MCP tools available. Rules protect context window from flooding. One unrouted command dumps 56 KB into context.

Think in Code — MANDATORY

Analyze/count/filter/compare/search/parse/transform data: write code via context-mode_ctx_execute(language, code), console.log() only the answer. Do NOT read raw data into context. PROGRAM the analysis, not COMPUTE it. Pure JavaScript — Node.js built-ins only (fs, path, child_process). try/catch, handle null/undefined. One script replaces ten tool calls.

BLOCKED — do NOT attempt

curl / wget — BLOCKED
Shell curl/wget intercepted and blocked. Do NOT retry.
Use: context-mode_ctx_fetch_and_index(url, source) or context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")

Inline HTTP — BLOCKED
fetch('http, requests.get(, requests.post(, http.get(, http.request( — intercepted. Do NOT retry.
Use: context-mode_ctx_execute(language, code) — only stdout enters context

Direct web fetching — BLOCKED
Use: context-mode_ctx_fetch_and_index(url, source) then context-mode_ctx_search(queries)

REDIRECTED — use sandbox

Shell (>20 lines output)
Shell ONLY for: git, mkdir, rm, mv, cd, ls, npm install, pip install.
Otherwise: context-mode_ctx_batch_execute(commands, queries) or context-mode_ctx_execute(language: "javascript", code: "..."). Use language: "shell" only when code matches the host shell.

File reading (for analysis)
Reading to edit → reading correct. Reading to analyze/explore/summarize → context-mode_ctx_execute_file(path, language, code).

grep / search (large results)
Use context-mode_ctx_execute(language: "javascript", code: "...") in sandbox for portable filtering/counting.

Tool selection

MEMORY: context-mode_ctx_search(sort: "timeline") — after resume, check prior context before asking user.
GATHER: context-mode_ctx_batch_execute(commands, queries) — runs all commands, auto-indexes, returns search. ONE call replaces 30+. Each command: {label: "header", command: "..."}.
FOLLOW-UP: context-mode_ctx_search(queries: ["q1", "q2", ...]) — all questions as array, ONE call (default relevance mode).
PROCESSING: context-mode_ctx_execute(language, code) | context-mode_ctx_execute_file(path, language, code) — sandbox, only stdout enters context.
WEB: context-mode_ctx_fetch_and_index(url, source) then context-mode_ctx_search(queries) — raw HTML never enters context.
INDEX: context-mode_ctx_index(content, source) — store in FTS5 for later search.

Parallel I/O batches

For multi-URL fetches or multi-API calls, always include concurrency: N (1-8):

context-mode_ctx_batch_execute(commands: [3+ network commands], concurrency: 5) — gh, curl, dig, docker inspect, multi-region cloud queries
context-mode_ctx_fetch_and_index(requests: [{url, source}, ...], concurrency: 5) — multi-URL batch fetch

Use concurrency 4-8 for I/O-bound work (network calls, API queries). Keep concurrency 1 for CPU-bound (npm test, build, lint) or commands sharing state (ports, lock files, same-repo writes).

GitHub API rate-limit: cap at 4 for gh calls.

Output

Write artifacts to FILES — never inline. Return: file path + 1-line description.
Descriptive source labels for search(source: "label").

Session Continuity

Skills, roles, and decisions persist for the entire session. Do not abandon them as the conversation grows.

Memory

Session history is persistent and searchable. On resume, search BEFORE asking the user:

Need	Command
What did we decide?	context-mode_ctx_search(queries: ["decision"], source: "decision", sort: "timeline")
What constraints exist?	context-mode_ctx_search(queries: ["constraint"], source: "constraint")
	DO NOT ask "what were we working on?" — SEARCH FIRST.
If search returns 0 results, proceed as a fresh session.

ctx commands

Command	Action
ctx stats	Call stats MCP tool, display full output verbatim
ctx doctor	Call doctor MCP tool, run returned shell command, display as checklist
ctx upgrade	Call upgrade MCP tool, run returned shell command, display as checklist
ctx purge	Call purge MCP tool with confirm: true. Warns before wiping knowledge base.
	After /clear or /compact: knowledge base and session stats preserved. Use ctx purge to start fresh.