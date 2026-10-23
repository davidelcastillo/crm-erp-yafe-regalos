# Preparación de una base reutilizable

Objetivo: documentar cómo derivar el producto base sin afectar la instalación de Feria Conexx.
Alcance autorizado: plan documental y copia local independiente en `D:\SeguimientosCompras\comercio-base` (S4/L9). No cambiar auth, contratar infraestructura ni publicar repositorios.

## Specs

- **S1**: «Perfecto, documenta el plan de cambios y preparemosnos para hacer la version base del proyecto, como hago? copio y pego el proyetco? creo otro repo remoto en github?»
- **S2**: «Creo que lo mejor seria el vps, suponiendo que cobre mensual por el uso del sismema unos ~20 usd mensuales (contempla host + mantenimeinto) O cobro 50 usd para el supabase? los proyectos seran en argentina y para emprendimientos? Donde los ingresos no son tan altos»
- **S3**: «Y como probamos lo del VPS sin contratarlo aun? osea como hariamos lo del piloto comercial? Lee porfa en mis moemria de engram de TESIS, que auth uso ahi, no era nextauth creo que era Better auth o hice la autenticacion sola desde 0»

- **S4**: «Respecto a lo otro si te autorizo a crear esa ubicacion con ese nombre y hacer la copia local ahi»

## Tasks

T1–T3 corresponden a la documentación solicitada; T4–T5 a la copia local autorizada. Las demás fases de implementación siguen siendo propuestas no iniciadas.

- **T1** [S1–S3] — hecha — ruta: inline, documentación — Guía creada en `docs/base-reutilizable.md` y enlazada desde `docs/README.md`; incluye repositorios, límites, auth pendiente, fases y piloto. Evidencia: escrituras observadas; comprobación estructural en T3. Commit: no solicitado.
- **T2** [S1–S3] — hecha — ruta: inline, memoria — Espejo completo #1151, topic `odd/base-reutilizable/tasks`, proyecto `seguimientos-compras`; readback coincide al normalizar el salto de línea final que Engram elimina. Commit: no solicitado.
- **T3** [S1] — hecha — ruta: inline, verificación estructural — `git diff --check` y self-check Node: exit 0, 3 documentos, 10 enlaces locales válidos, S1–S3/T1–T3/P1–P6 y Log final; alcance solo documental. Suite, tsc, lint, build y navegador: N/A, sin cambios ejecutables. Commit: no solicitado.

- **T4** [S4] — hecha — ruta: inline, Git local — Clon independiente creado en `D:\SeguimientosCompras\comercio-base`, rama `base/preparacion`; remoto retirado solo en la copia y tres documentos trasladados. Job10 exit 0. Sin dependencias, env, despliegue ni ejecución de scripts. Commit: origen `05e934f7ce9f4e4e018e0e76099766916b4ac5ef`; sin commit nuevo solicitado.
- **T5** [S4] — hecha — ruta: inline, verificación estructural — Self-check Node exit 0: HEAD/rama correctos, `.git` independiente sin alternates ni remoto; sin env operativo, `.vercel`, dependencias, build ni estado temporal Supabase; tres documentos iguales y 10 enlaces; código sin cambios frente al origen. Rama/HEAD/remoto originales preservados. Engram sincronizado. Commit: no solicitado.

## Diseño y límites

- La instalación actual y sus cuentas de Supabase/Vercel permanecen intactas.
- Se propone un repositorio privado separado para el producto base; no un repositorio divergente por cliente.
- Cada cliente tendrá configuración, credenciales y base propias; varias instalaciones podrán compartir un VPS, no permisos ni secretos.
- La decisión de autenticación sigue abierta: autohospedar los servicios necesarios de Supabase o sustituir Auth en la nueva base. La memoria de TESIS no autoriza copiar su implementación.
- Las variantes de producto son una fase posterior, no campos de UI que se agregan en esta preparación.
- El ensayo local permite verificar instalación, aislamiento, persistencia y restauración; no prueba disponibilidad ni capacidad del proveedor de VPS.
- Diseño de UI, cambios de esquema, migración de usuarios y código de autenticación: N/A en esta unidad documental. Requieren diseño y autorización propios antes de implementarse.
- Guía operativa y criterios de aceptación propuestos: `docs/base-reutilizable.md`.

## Log

- **L1 — Pedido original de esta unidad, verbatim**: «Perfecto, documenta el plan de cambios y preparemosnos para hacer la version base del proyecto, como hago? copio y pego el proyetco? creo otro repo remoto en github?»
- **L2 — Contexto del usuario**: S2 y S3 conservan literalmente las consultas sobre precio, VPS y autenticación de TESIS. Las respuestas anteriores son propuestas, no decisiones de auth ni autorización de infraestructura.
- **L3 — Evidencia inicial**: árbol limpio; rama local `fix/bugs-usuarios`, HEAD `ddd3178`; `origin/main` local apunta al merge del PR #3 `05e934f`. `git diff --stat origin/main...HEAD` no muestra diferencias de contenido desde el ancestro compartido. No se ejecutó fetch nuevo ni se comprobó el estado actual del remoto en esta unidad.
- **L4 — Preparación segura**: `.gitignore` excluye `.env*` salvo `.env.example`, `.vercel`, dependencias, artefactos Next, cobertura y estado temporal de Supabase. `git ls-files .env .env.example .vercel prisma/migrations` devuelve únicamente `.env.example`. Esto no demuestra que el historial esté libre de secretos ni que exista una instalación reproducible: ambas comprobaciones forman parte del plan.
- **L5 — Memoria de TESIS**: #641 registra HU de auth terminada con bcrypt costo 12, cookie HttpOnly, token opaco y hash SHA-256 en `sesion_usuario`, ADR-24; #990 confirma la decisión documental. #664 contiene una propuesta diferente con `jose`: no combinarla con el registro de implementación. No se leyó el repositorio de TESIS.
- **L6 — Trazabilidad**: este documento y su espejo se agregan por la disciplina ODD del proyecto, además de la guía solicitada. No hay RED/GREEN significativo para documentación pasiva; corresponde comprobación estructural y de alcance.
- **L7 — Readback del espejo**: la comparación byte a byte inicial detectó una diferencia de un carácter: Engram elimina el salto de línea final. El contenido completo coincide con `trimEnd()` en ambos lados; no faltan secciones ni texto. Las comprobaciones posteriores usan esa normalización explícita.
- **L8 — Verificación observada**: primer self-check Node: exit 1 por escape incorrecto de barra en el comando de verificación, antes de ejecutar aserciones; no fue fallo del producto. Se corrigió el comando y el self-check devolvió exit 0: 3 documentos, 10 enlaces locales, orden Specs/Tasks/Log y alcance documental. `git diff --check`: exit 0 con aviso LF→CRLF en `docs/README.md` por configuración Git local. No se ejecutaron suite, tsc, lint, build ni navegador por ser documentación pasiva. No hay commits, copia, remoto, push, instalación, contratación ni cambios de producción en esta unidad.
- **L9 — Ampliación autorizada, verbatim**: «Mientras tanto, me gustaria hacer un video mostrando la pagina, las animaciones y asi para subirlo al ig de mi emprendimiento de sistemas, como me recomendas ahcerlo? grabo un video y se lo paso a alguna ia para que lo haga lindo? otra cosa, tambien quiero ahcer un portafolio y en el mismo ofrecer mis sitemas, el primero seria este, tenia una idea e hacer el portafolio bien dinamico asi como se ahcen las paginas ahora, asi como esta : https://www.wearebulletproof.com/ . Respecto a lo otro si te autorizo a crear esa ubicacion con ese nombre y hacer la copia local ahi»
- **L10 — Alcance de L9**: autorización de carpeta y copia local, no de publicación, contratación ni cambio de autenticación. Video/portfolio son consultas de asesoramiento: no se crean sus sitios, videos ni artefactos de implementación.
- **L11 — Copia observada**: job10 exit 0. Clon con `--no-local --no-checkout` del origen local; fetch de su `refs/remotes/origin/main`, hash contrastado, checkout del commit `05e934f7ce9f4e4e018e0e76099766916b4ac5ef`, rama `base/preparacion`, `remote remove origin` solo en la copia. Sin remotos en el destino, `.git` propio sin `objects/info/alternates`. Traslado explícito de `docs/base-reutilizable.md`, `docs/README.md` y este documento. Sin fetch remoto de GitHub ni acciones de infraestructura. La copia conserva código e historial del cliente: no es todavía una base neutral ni una auditoría de secretos.
- **L12 — Verificación de la copia**: self-check Node exit 0; HEAD/rama esperados, `.git` directorio sin alternates, sin remotos ni `.env` operativo/`.vercel`/`node_modules`/`.next`/`coverage`/`supabase/.temp`. Tres documentos idénticos entre origen y copia y 10 enlaces locales válidos. `git diff --exit-code HEAD` excluyendo esos documentos: exit 0. En el origen se mantienen rama `fix/bugs-usuarios`, HEAD `ddd3178` y URL de origin. Ambos árboles solo difieren en los tres documentos autorizados. `git diff --check` exit 0, con aviso LF→CRLF. RED/GREEN y ejecución de la aplicación: N/A por ser clon sin cambios de código ni configuración ejecutable; no se comprobó arranque ni auditó todo el historial.
