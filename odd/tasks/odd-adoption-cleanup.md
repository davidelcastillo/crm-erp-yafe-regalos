# Adopción de ODD y limpieza conservadora
Objetivo: adaptar las instrucciones, cerrar administrativamente SDD y ordenar el repositorio sin cambiar la aplicación.
Rama: `chore/odd-adoption-cleanup` · Entrega: `auto-chain`, `feature-branch-chain`; solo commits locales autorizados · Verificación: lectura estructural, integridad de archivos y referencias; Jest/build N/A si no cambia runtime.

## Specs

- **S1**: «te pongo en tu repo un AGENTSVER2.md de ejemplo de otro repo, copiesmos su estructura y lo apliquemos a este repo». Adaptar secciones al stack y convenciones reales; no importar dominio, infraestructura ni decisiones de otros repositorios. Comprobar instrucciones, enlaces y capacidades contra archivos existentes.
- **S2**: «pongamos todos los ciclos sdd en cerrados, ahora trabajamps con odd». Cierre administrativo por sustitución del proceso; conservar checklists originales y evidencia pendiente, sin inventar verificación. Registrar todos los ciclos, incluidos los ya archivados.
- **S3**: «luego limpiemos un poco el repo, hay demasiadas cosas y archivos, tratemos de borrar cosas que no sirven o no hacen falta ahi». Autorización de limpieza: «Borrar basura y ordenar la raíz (recomendado)». Borrar únicamente `write_file.py`, `temp-label-printing-spec.md`, `migrate_full.sql` y `CUsersdavid.configopencode/`; reubicar scripts e históricos conservando bytes y actualizando referencias. No tocar código de aplicación, secretos, base de datos, skills instalados ni cambios previos de `.atl/`.
- **S4**: «te doy los bugs, por cada bugs me ahces preguntas para exclarecer el scope o el bug como tal y una vez vemos eso seguimos con odd». Documentar un flujo por bug: reproducción y contexto, preguntas puntuales, alcance y resultado esperado explícitos, implementación ODD, verificaciones y cierre. No implementar bugs funcionales aún no entregados.

### Diseño

- **Datos**: N/A para datos de negocio; ninguna conexión ni ejecución de scripts SQL/TS de reparación. Los documentos y scripts históricos se conservan íntegros al moverlos.
- **Arquitectura**: `AGENTS.md` rige el trabajo actual; `openspec/README.md` establece el cierre histórico de SDD. Retirar la configuración activa de SDD a su archivo histórico. Los ciclos existentes se trasladan a una carpeta de transición común; no se reescriben sus checklists.
- **Interfaz**: N/A para UI; documentación en español, coherente con el repositorio. `docs/README.md` orienta y `docs/flujo-odd.md` describe las preguntas por bug. Corregir guías vigentes del catálogo público sin cambiar su comportamiento.
- **Procedimental**: inventariar → adaptar instrucciones → archivar SDD → limpiar con allowlist y verificar bytes/referencias → verificar el diff y registrar evidencia. Detenerse ante referencias o archivos inesperados, nunca ampliar borrados por inferencia.
- **Ruta**: implementación inline secuencial: adopción, archivo y limpieza comparten enlaces/registro documental y cada paso depende de la ubicación final del anterior; no hay unidades independientes para escritores paralelos. Exploración delegada ya observada (`mv9ksu66-2-m5ae`). Verificación independiente si el riesgo/assessment la exige.
- **Presupuesto**: previsión de 650–900 líneas documentales autoradas más movimientos detectables como renombres. Estrategia elegida por el usuario: `feature-branch-chain`; límites locales U1 instrucciones/guías, U2 cierre SDD, U3 limpieza, U4 evidencia final. Sin push, PR ni merge.
- **Rollback**: revertir las unidades locales en orden inverso; las eliminaciones están versionadas y los movimientos conservarán sus bytes. No restaurar ni descartar cambios ajenos de `.atl/` o `AGENTSVER2.md`.

## Tasks

- **T1** [S1,S4] — inline — in_progress — Adaptar AGENTS y guías vigentes, documentar preguntas por bug — commit: pendiente.
- **T2** [S2] — inline — pending — Cerrar y archivar todos los ciclos SDD con evidencia pendiente explícita — commit: pendiente.
- **T3** [S3] — inline — pending — Aplicar limpieza autorizada y reubicaciones con integridad y referencias — commit: pendiente.
- **T4** [S1–S4] — inline + verificación independiente según riesgo — pending — Verificar, reconciliar memoria y dejar listo el flujo para bugs — commit: pendiente.

## Log

- **L1 — Solicitud original, 2026-10-15**: «Okey, empecemos  solucionar estas cosas, te pongo en tu repo un AGENTSVER2.md de ejemplo de otro repo, copiesmos su estructura y lo apliquemos a este repo, pongamos todos los ciclos sdd en cerrados, ahora trabajamps con odd,luego limpiemos un poco el repo, hay demasiadas cosas y archivos, tratemos de borrar cosas que no sirven o no hacen falta ahi, y por ultimo, preparemonos para solucionar varias coasas de bugs funcionales, porpogongamos el siguiente framework, te doy los bugs, por cada bugs me ahces preguntas para exclarecer el scope o el bug como tal y una vez vemos eso seguimos con odd».
- **L2 — Decisiones del usuario**: «Borrar basura y ordenar la raíz (recomendado)»; «Sí, autorizo esas lecturas» para las referencias auxiliares enumeradas; «Cadena sobre una rama de feature (recomendado)» en respuesta a la autorización de commits locales. Ninguna decisión autoriza publicación ni cambios de datos.
- **L3 — Baseline**: `main` en `7d91643`; cambios previos en `.atl/.skill-registry.cache.json` y `.atl/skill-registry.md`; `AGENTSVER2.md` aportado por el usuario sin seguimiento. RDD global activo según `gentle-ai review mode status`. Memoria explícita: `seguimientos-compras`.
- **L4 — Evidencia previa**: explorador inventarió 14 carpetas SDD no archivadas, estados contradictorios y pendientes manuales; no se infiere implementación desde checkboxes. Comprobación local: `temp-label-printing-spec.md` y `migrate_full.sql` tienen 0 bytes. Advertencias históricas RLS/BD de tests no revalidadas: no ejecutar suite ni scripts contra bases desconocidas.
- **L5 — Inicio**: rama de trabajo creada. Se agrega este documento y su espejo por exigencia de trazabilidad, aunque el cambio de instrucciones por sí solo no los necesitaría. Sin RED/GREEN: cambio documental y movimientos de archivos, sin regla ejecutable nueva; se comprobarán integridad, referencias y superficies de runtime intactas.
