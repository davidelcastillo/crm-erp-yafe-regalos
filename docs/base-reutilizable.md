# Preparar el producto base reutilizable

## Qué se prepara ahora

Una base común para personalizar el sistema para emprendimientos, con instalaciones independientes y un ensayo local de despliegue en VPS. La instalación existente de Feria Conexx no se migra ni se modifica por este plan.

Estado: **plan documentado y clon local creado; cambios funcionales no iniciados**. Seguimiento: [unidad ODD](../odd/tasks/base-reutilizable.md).

## Repositorios: no copiar y pegar toda la carpeta

Se propone separar dos responsabilidades:

- **Repositorio actual**: conserva Feria Conexx, su historial y su despliegue existente.
- **Producto base `comercio-base`**: nombre y carpeta local autorizados. Recibirá la evolución reutilizable y sus pruebas. El remoto privado futuro sigue sin crearse ni publicarse.

No crear un fork divergente por cada comercio. Los clientes consumen versiones identificadas de la base, con configuración y datos propios. La separación de repositorios no sincroniza cambios automáticamente: las correcciones reutilizables necesarias para Feria Conexx deberán portarse y verificarse explícitamente mientras siga en el repositorio original.

### Secuencia para crear la base, cuando se autorice

1. Elegir una carpeta absoluta de destino fuera del repositorio actual y autorizar su uso. Confirmar nombre y privacidad del nuevo remoto.
2. Elegir un commit de `main` verificado como origen. El último merge conocido es `05e934f7ce9f4e4e018e0e76099766916b4ac5ef` (PR #3); antes de derivar, actualizar referencias y comprobar qué versión se está usando. El smoke previo respondió correctamente, pero no se confirmó la identidad/estado del despliegue exacto de Vercel: no presentarlo como prueba de ese commit en producción.
3. Crear un clon independiente, no un worktree, para que tenga su propio `.git` y configuración. Copiar únicamente contenido versionado: un clon normal no arrastra los archivos locales ignorados. Esta entrega documental todavía no tiene commit y un clon no la incluirá: antes de derivar, acordar su commit o trasladar explícitamente estos tres documentos con su diff, sin copiar el resto de archivos locales.
4. Trabajar en la nueva carpeta y retirar allí el remoto `origin` heredado antes de publicar. No cambiar los remotos ni la configuración de despliegue del repositorio original. Registrar el repositorio y commit de procedencia en la documentación de la base.
5. Revisar archivos y **todo el historial que se pretende publicar** para detectar secretos, datos de clientes, referencias de infraestructura y material que no corresponda redistribuir. Que `.env` esté ignorado hoy no demuestra un historial limpio. No imprimir credenciales en logs. Si aparece material sensible, detener la publicación y acordar rotación y estrategia de saneamiento; no reescribir el historial del proyecto original.
6. Crear en GitHub un repositorio **privado y vacío**, sin inicializar README, licencia ni `.gitignore`, y agregarlo como nuevo `origin` de la copia. Crearlo y hacer push requieren autorización explícita.
7. Publicar solo después de la revisión. Si se conserva el historial, el remoto privado también conservará marcas y documentación históricas de Feria Conexx; no confundir privacidad con anonimización. Si eso no es aceptable, acordar una importación de snapshot revisada con procedencia documentada en vez de subir ese historial.
8. No conectar Vercel, Supabase ni un VPS por arrastre. Preparar credenciales nuevas y configuración independiente para el laboratorio.

No usar una plantilla de GitHub como mecanismo de actualización de clientes: genera una copia inicial, no mantiene las copias sincronizadas.

### Qué no se lleva de la carpeta local

- `.env` y cualquier secreto o backup real.
- `.vercel/` y asociaciones locales con producción.
- `node_modules/`, `.next/`, `coverage/`, builds y cachés.
- Volúmenes Docker, contenido de bases, sesiones o exportaciones reales.
- Estado local de herramientas y conexiones al stack Supabase actual.

Conservar código, tests, lockfile, esquema y trazabilidad versionada. Auditar scripts y SQL heredados antes de ejecutarlos; no borrarlos por considerarlos aparentemente innecesarios. `.env.example` deberá revisarse para contener solo variables y valores de ejemplo seguros.

## Copia local preparada

- Destino autorizado: `D:\SeguimientosCompras\comercio-base`.
- Origen: repositorio local `D:\SeguimientosCompras\seguimientos-compras`, referencia conocida `origin/main`.
- Commit fijado: `05e934f7ce9f4e4e018e0e76099766916b4ac5ef` (merge del PR #3).
- Rama de trabajo de la copia: `base/preparacion`.
- Clon Git independiente, creado con `--no-local`, sin worktree compartido ni almacén de objetos alternativo; remoto heredado retirado solo en la copia.
- Los tres documentos de este plan se trasladan explícitamente porque todavía no tienen commit en el origen.
- No se instalaron dependencias, ejecutaron scripts del proyecto ni conectaron servicios. No hay remoto nuevo, push ni contratación.
- La identidad del negocio y el código de Supabase aún son los originales: esto es una copia preparatoria, no una base neutral ni un entorno de demo listo para ejecutar.
- Auditar el historial y la configuración versionada antes de cualquier publicación o ejecución; el clon no sanea datos históricos ni elimina automáticamente referencias de producción presentes en código o documentación.

## Arquitectura propuesta

- Una base común de código; no ramas permanentes por cliente.
- Identidad configurable: nombre, bienvenida, logo, colores, metadatos y marca del PDF. Mantener el diseño mobile-first, sin rediseño incidental.
- Funciones opcionales solo cuando exista una necesidad concreta. Desactivarlas debe controlar UI y acciones/rutas del servidor; no reemplaza la autorización por rol ni debe borrar historial.
- Una instalación por cliente, con configuración, secretos y base separados. Un VPS compartido no implica una base multiempresa.
- Versiones identificadas y actualización deliberada por instalación; un merge no despliega a todos automáticamente.

No se incluye ahora plataforma de plugins, panel de configuración, multitenancy, facturación integrada ni variantes de producto. Talles/colores con stock propio requieren diseño de compras, ventas, inventario y movimientos antes de implementarse.

## Decisión pendiente: autenticación

PostgreSQL por sí solo no sustituye Supabase Auth. Antes de implementar el laboratorio se debe elegir una opción y registrar sus consecuencias:

| Opción | Ventaja | Trabajo y límites |
| --- | --- | --- |
| Autohospedar los servicios necesarios de Supabase | Conserva el enfoque de autenticación actual | Más servicios y recursos; operación, configuración, backups y actualizaciones propios. |
| Sustituir Supabase Auth en la nueva base | Permite evaluar una instalación de aplicación + PostgreSQL | Rediseñar y verificar login, logout, sesiones, roles, altas administrativas y recuperación de acceso; no es un reemplazo de una sola variable. |

Si se sustituye Auth, comparar una biblioteca mantenida con una solución propia acotada; no elegir por el mero hecho de que TESIS tenga código reutilizable. La memoria de TESIS #641 describe sesiones persistidas con token opaco y hash en base, no Better Auth/NextAuth. La inspección y posible reutilización de ese repositorio requieren acceso autorizado y revisión del código vigente.

No migrar usuarios ni sesiones reales de Feria Conexx en esta fase. Para el laboratorio, usar usuarios ficticios y credenciales nuevas. La decisión de auth tiene riesgo de seguridad y requiere diseño, autorización y verificación independiente.

## Fases propuestas, no iniciadas

### P1. Derivar y auditar el repositorio

Origen fijado, copia independiente, revisión de historial, remotos correctos y procedencia registrada. No realizar push sin autorización. Cierre: demostrar que no se copiaron secretos locales ni conexiones activas a producción.

### P2. Extraer la identidad del comercio

Centralizar los puntos de marca presentes en login, encabezados, metadatos, catálogo y PDF; inventariar todos los consumidores antes de editar. Mantener una configuración explícita por instalación. Cierre: dos identidades ficticias pueden usar el mismo código sin cambiar reglas de negocio; tests y verificación visual en navegador.

### P3. Resolver Auth y preparar una base vacía

Decidir y diseñar la autenticación; preservar las validaciones de rol y límites de sucursal. Preparar esquema, aprovisionamiento inicial y estrategia reproducible de migraciones para una base nueva, sin ejecutar SQL manual de producción como instalador. Cierre: login/logout y acceso autorizado/rechazado observados en estado aislado; esquema reproducible sin copiar datos ni usuarios reales. Diseñar esta fase antes de implementarla y separar auth como unidad de riesgo.

### P4. Ensayar despliegue local equivalente a VPS

Máquina virtual Linux con recursos limitados; Docker para los servicios elegidos, aplicación en modo producción y proxy de entrada. No instalar ni modificar el host o una VM sin autorización del destino. Probar en una copia aislada para no pisar `.next` del servidor de desarrollo actual. No publicar PostgreSQL en Internet ni abrir un túnel como atajo.

Cierre con evidencia:

- Arranque desde un entorno limpio y configuración documentada.
- Login y recorridos de productos, compras, ventas, inventario y PDF con datos ficticios.
- Persistencia tras reiniciar contenedores y máquina.
- Backup y restauración en un destino vacío distinto, incluidos los archivos que correspondan.
- Dos instalaciones ficticias aisladas por datos, secretos y configuración.
- RAM, CPU, disco y tiempos de respuesta medidos con una carga acordada. No prometer capacidad de un proveedor a partir de esos números locales.
- HTTPS y cookies seguras verificados en un entorno de prueba antes de recibir datos reales.

### P5. Preparar el piloto comercial

Acordar con un comercio el alcance, alta, cuota, soporte, duración, exportación de datos y salida del servicio. USD 20 mensuales es una hipótesis a validar, no una tarifa rentable demostrada. Separar desarrollo a medida del mantenimiento del producto.

Contratar alojamiento real solo tras autorización: el ensayo local no demuestra disponibilidad comercial. Antes de cargar datos reales, verificar seguridad, respaldos externos, restauración, monitoreo, actualización y una alternativa operativa ante caídas. No comprometer soporte permanente ni tiempos de recuperación no probados.

### P6. Medir y decidir si se amplía

Registrar costo total, horas de atención, incidentes y consumo del piloto. Decidir precio, capacidad y siguiente cliente con esa evidencia. No asumir que agregar clientes mantiene constante el costo ni que todos los cambios particulares deben entrar al núcleo.

## Próxima decisión necesaria

Nombre y ruta de la copia ya autorizados: `comercio-base`, en `D:\SeguimientosCompras\comercio-base`. Para cambiar código: elegir el enfoque de autenticación y aprobar el alcance de la primera unidad. Abrir una sesión de trabajo en ese directorio para continuar con su contexto y permisos propios; el proyecto original no se convierte en la base por arrastre. Publicar en GitHub, contratar VPS y migrar producción son autorizaciones separadas.

## Verificación de este plan

Documento pasivo: RED/GREEN, tests de negocio, build y navegador no aplican a esta entrega documental. Verificar enlaces locales, estados de la unidad ODD, integridad del espejo y que el diff solo afecte documentación. No considerar ninguna fase implementada por figurar en esta guía.
