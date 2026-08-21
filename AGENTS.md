# AGENTS.md – Configuración del agente Gentle‑AI para el proyecto *Seguimientos‑compras*

Este archivo contiene la configuración central que debe ser consultada por el agente antes de ejecutar cualquier tarea.  
Incluye referencias a los *skills* disponibles, la configuración de entornos, las reglas de trabajo y los enlaces a la documentación más reciente de las tecnologías usadas.

---

## 📋 1. Skills disponibles (actualizados)

| Skill | Descripción breve | Trigger / Uso recomendado |
|-------|-------------------|---------------------------|
| **_shared** | Referencias compartidas para todos los skills SDD. | - |
| **branch‑pr** | Crear PRs con checks de issue‑first. | Al abrir o preparar PRs. |
| **chained‑pr** | Dividir cambios grandes en PRs encadenados. | Cuando el forecast supere 400 líneas o se solicite explícitamente. |
| **cognitive‑doc‑design** | Diseñar docs que reduzcan la carga cognitiva. | Al escribir guías, READMEs, RFCs, etc. |
| **comment‑writer** | Escribir comentarios cálidos y directos. | En feedback de PR, issues, Slack, etc. |
| **context7‑mcp** | Obtener documentación actualizada de libs/frameworks vía Context7. | Preguntas sobre Next.js, Prisma, Supabase, Tailwind, etc. |
| **customize‑opencode** | Modificar únicamente la configuración de OpenCode. | Nunca para código de aplicación. |
| **find‑skills** | Descubrir e instalar nuevos skills. | Cuando se busca funcionalidad extra. |
| **go‑testing** | Patrón de testing para Go. | No aplicable al proyecto actual. |
| **issue‑creation** | Crear issues con checks de issue‑first. | Al reportar bugs o nuevas funcionalidades. |
| **judgment‑day** | Revisión adversarial doble (blind). | Cuando se requiere validación extrema. |
| **mobile‑design** | Directrices mobile‑first, touch‑first y respeto de plataforma. | En cualquier trabajo de UI/UX. |
| **next‑best‑practices** | Buenas prácticas de Next.js (App Router, RSC, etc.). | Desarrollo de páginas, layout, datos, etc. |
| **nextjs** | Experto en Next.js App Router. | Cuando se trabaja con routing, server actions, etc. |
| **prisma‑postgres** | Setup y operaciones de Prisma con Postgres. | Migraciones, seed, queries avanzadas. |
| **sdd‑apply** | Implementar tareas desde specs y diseño. | Fase de aplicación SDD. |
| **sdd‑archive** | Archivar cambios SDD completados. | Después de verify. |
| **sdd‑design** | Crear diseño técnico desde propuesta. | Fase de diseño SDD. |
| **sdd‑explore** | Explorar ideas antes de comprometerse. | Fase de exploración SDD. |
| **sdd‑init** | Inicializar contexto SDD, testing capabilities, registry. | Primer paso de cualquier cambio SDD. |
| **sdd‑onboard** | Onboarding guiado de SDD usando el código real. | Cuando se quiere aprender el flujo. |
| **sdd‑propose** | Crear propuesta SDD (intent, scope, approach). | Fase de propuesta SDD. |
| **sdd‑spec** | Escribir especificaciones delta desde propuesta. | Fase de spec SDD. |
| **sdd‑tasks** | Desglosar spec y diseño en tareas implementables. | Fase de task‑planning SDD. |
| **sdd‑verify** | Validar implementación contra spec, diseño y tareas. | Fase de verificación SDD. |
| **skill‑creator** | Crear nuevos skills LLM‑first. | Cuando se necesita un skill a medida. |
| **skill‑improver** | Mejorar y auditar skills existentes. | Mantenimiento de skills. |
| **skill‑registry** | Mantener actualizado el registro de skills. | Cuando se añaden/eliminan skills. |
| **supabase** | Cualquier tarea relacionada con Supabase (DB, Auth, Edge, Storage, etc.). | Configuración, migraciones, queries, auth, etc. |
| **supabase‑postgres‑best‑practices** | Optimización y buenas prácticas de Postgres desde Supabase. | Tuning de índices, queries, vacuum, **vercel‑react‑best‑practices** | Guías de rendimiento de Vercel para React/Next.js. | Optimización de bundle, SSR, ISR, etc. |
| **work‑unit‑commits** | Planificar commits como unidades de trabajo revisables. | Antes de aplicar cambios en SDD (para PRs chained o single‑PR). |

> **Nota:** Los skills marcados con *mobile‑design* y *next‑best‑practices* son especialmente relevantes para las nuevas funcionalidades de la v3 (gestionar sucursales, categorías, filtrado, dashboard personalizable, portal externo de solo‑lectura, etc.).

---

## 🛠️ 2. Configuración de entorno (variables requeridas)

Asegúrate de que las siguientes variables estén definidas en el archivo `.env` (o en la configuración de Supabase/Vercel) antes de iniciar cualquier trabajo:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a la base de datos PostgreSQL de Supabase. |
| `DIRECT_URL` | URL directa (usada por Prisma en entornos de CI). |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Key publishable (anon) para el cliente. |
| `SUPABASE_SERVICE_ROLE_KEY` | Key de servicio para operaciones de admin (seed, migraciones, etc.). |
| `NEXT_PUBLIC_APP_ENV` | `development`, `staging` o `production` (afecta comportamiento de middlewares y feature flags). |
| `NEXT_PUBLIC_FEATURE_BRANCHES` | `true` si se quiere habilitar la gestión de sucursales (Fase 2/3). |
| `NEXT_PUBLIC_FEATURE_CATEGORIES` | `true` si se quiere habilitar categorías de productos (Fase 2). |
| `NEXT_PUBLIC_FEATURE_SOFT_DELETE` | `true` si se quiere habilitar el soft‑delete de productos (Fase 2). |
| `NEXT_PUBLIC_FEATURE_EXTERNAL_BRANCH_VIEW` | `true` si se quiere habilitar la vista externa de inventario por sucursal (HU05). |
| `BRANCH_EMAIL_DOMAIN` | Dominio usado para generar el email del usuario de sucursal (`sucursal-<code>@<domain>`). Default `feriaconexx.com`. |

---

## 📐 3. Reglas de trabajo (actualizadas)

1. **Siempre usar SDD** para cualquier cambio que implique más de un archivo o que afecte la lógica de negocio.  
   - Flujo: `explore → propose → spec → design → tasks → apply → verify → archive`.  
   - En modo **interactivo** (predeterminado) revisa el resumen de cada fase antes de continuar; en modo **automático** el orchestrator actúa como gatekeeper entre fases.

2. **Delegar todo el trabajo pesado** a los sub‑agentes `sdd‑*`.  
   - Nunca edites archivos directamente salvo para lecturas de 1‑3 archivos o comandos de estado (git, npm, etc.).  
   - Usa la herramienta `task` con `subagent_type` adecuado (ver tabla de skills) para cada fase.

3. **Respetar el presupuesto de líneas de cambio** (review burden).  
   - Después de `sdd‑tasks`, el orchestrator consulta el *Review Workload Forecast*.  
   - Si el forecast indica > 400 líneas cambiadas o se necesita decisión, aplicar la **delivery strategy** configurada en la pre‑flight (ask‑on‑risk, auto‑chain, single‑pr, exception‑ok).  
   - En caso de `ask‑on‑risk`, el orchestrator preguntará al usuario si quiere dividir en PRs encadenados o aceptar un `size:exception`.

4. **Mantener actualizado el registro de skills** antes de cada delegación.  
   - Al inicio de la sesión (o antes de la primera delegación) ejecuta:  
     ```bash
     opencode skill run skill-registry
     ```  
   - Luego, cada sub‑agente recibirá la lista de skills a cargar mediante el campo `skill_resolution` del prompt.

5. **Usar Context7 para documentación de libs**.  
   - Antes de escribir código que implique Next.js, Prisma, Supabase, Tailwind, Recharts, Zod, SweetAlert2, etc., llama a `context7_resolve-library-id` + `context7_query-docs` para obtener la versión más reciente y ejemplos de uso.

6. **Aplicar las buenas prácticas de Vercel y Next.js** (skill `vercel-react-best-practices` y `next-best-practices`).  
   - Prioriza **Server Actions** para mutaciones, **React Server Components** para UI estática, y **Edge Functions** solo cuando sea estrictamente necesario.

7. **Seguridad y autenticación** (Fase 1 ya implementada).  
   - Todas las rutas internas (excepto `/login` y las rutas externas de sucursal) deben estar protegidas por el middleware que verifica la sesión de Supabase y el rol `admin`.  
   - Las rutas externas `/sucursal/[branchId]/inventory` usan un middleware separado que solo permite rol `branch_user` y verbos `GET`.  

8. **Testing**  
   - **Unit tests**: Jest + React Testing Library para componentes y lógica pura.  
   - **Integration tests**: Prisma + Supabase (usar entorno de test de Supabase o Docker) para flujos completos (crear sucursal → asignar stock → compra → venta → movimiento).  
   - **E2E**: Playwright con configuración móvil (emular Android) para validar flujos de usuario críticos (login, compra con distribución, venta por sucursal, movimiento de stock, acceso al portal externo).  
   - El agente debe ejecutar `npm test` antes de cada `sdd‑apply` y `npm run test:e2e` antes de `sdd‑verify` si existen tests E2E.

9. **Documentación**  
   - Cada nuevo feature debe contar con su propio archivo markdown en `docs/` siguiendo la plantilla de `cognitive-doc-design`.  
   - Actualizar `README.md` con un resumen de las funcionalidades de la v3 y enlaces a los documentos detallados.

10. **Versionado y releases**  
    - Usa **Conventional Commits** (`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`).  
    - Para releases en `main`, valida que el *receipt* de revisión exista y que no haya cambios pendientes (ver sección *Trigger Rules* del documento de SDD).  
    - Si el release es *major* o sigue a un incidente de seguridad, requiere una revisión extraordinaria (Judgment Day o revisión de 4R) antes de publicar.

11. **Estilo visual - CSS / Tailwind**
   - Leer el archivo STYLE.MD en la raíz del proyecto.
---

## 📚 4. Enlaces a documentación crítica (actualizados vía Context7)

- **Next.js 16 (App Router)** – <https://nextjs.org/docs/app>  
- **Prisma ORM** – <https://pris.ly/d/prisma-doc>  
- **Supabase (DB, Auth, Edge, Storage)** – <https://supabase.com/docs>  
- **Tailwind CSS v4** – <https://tailwindcss.com/docs>  
- **Recharts** – <https://recharts.org/en-US>  
- **Zod v4** – <https://zod.dev/>  
- **SweetAlert2** – <https://sweetalert2.github.io/>  
- **Playwright** – <https://playwright.dev/docs/intro>  

*(El agente debe usar la herramienta `context7` para obtener la versión exacta y ejemplos de uso antes de escribir código.)*

---

## ✅ 5. Checklist rápido antes de iniciar una nueva tarea SDD

- [ ] Verificar que `.env` tenga todas las variables requeridas.  
- [ ] Ejecutar `opencode skill run skill-registry` para tener el registro actualizado.  
- [ ] Confirmar la **pre‑flight de SDD** (modo, artifact store, delivery strategy, review budget).  
- [ ] Si la tarea implica cambios de esquema, asegurarse de que Prisma esté instalado y que el comando `prisma migrate dev` pueda ejecutarse.  
- [ ] Si la tarea incluye nuevas rutas o componentes, revisar que los archivos de `src/app/` sigan la convención de **route groups** (`(routes)`, `(auth)`, etc.) según el proyecto actual.  
- [ ] Antes de escribir cualquier línea de código, consultar Context7 para la documentación más reciente de la librería involucrada.  
- [ ] Después de escribir código, ejecutar los tests unitarios y de integración correspondientes.  
- [ ] Antes de hacer commit, asegurarse de que el *receipt* de revisión esté disponible (o crear uno mediante `review/start` si no existe).  
- [ ] Al finalizar, archivar el cambio con `sdd‑archive` y actualizar el changelog/READEME si corresponde.   
