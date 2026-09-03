# Change: FASE 1 - Seguridad Core

## Contexto
Proyecto: Stark Commerce OS (Next.js 16 + Prisma + Supabase + Tailwind v4)
Estado actual: Las rutas del sistema principal están abiertas. Se requiere implementar un cerrojo de seguridad global utilizando la autenticación nativa de Supabase antes de avanzar con la creación de roles, tablas de sucursales, o rutas externas de solo lectura (HU05).

## Requerimientos

### HU6: Login de administrador para todo el sistema
- Integración Supabase Auth: Configurar el cliente de servidor y navegador usando @supabase/ssr para App Router.
- Página de Autenticación: Crear ruta /login con formulario de acceso (email y contraseña).
- Protección Global (Middleware): Interceptar todas las peticiones a rutas privadas. Si no existe una sesión activa, redirigir automáticamente a /login.
- Cierre de Sesión (Logout): Implementar botón y Server Action para destruir la sesión y limpiar las cookies.
- Preparación de Arquitectura: Asegurar que el middleware sea modular para excluir fácilmente futuras rutas externas (ej: /sucursal/*) que tendrán su propia lógica de acceso en las siguientes fases.

## Criterios de aceptación combinados

### Configuración & Middleware
1. src/lib/supabase/server.ts y client.ts configurados correctamente con manejo de cookies para Next.js 16.
2. src/middleware.ts intercepta rutas protegidas (/dashboard, /inventario, /ventas, etc.) y valida la sesión con supabase.auth.getUser().
3. Exclusión explícita en el matcher del middleware para archivos estáticos (_next/static, favicon.ico, imágenes) y la propia ruta /login.

### Lógica de Autenticación (Server Actions)
4. Acciones en src/actions/auth.ts:
    - login(formData: FormData): Valida credenciales con Supabase, maneja errores (ej: credenciales inválidas) y redirige al dashboard.
    - logout(): Ejecuta supabase.auth.signOut(), limpia cookies seguras y redirige a /login.
5. Manejo seguro de errores sin exponer detalles sensibles del backend al cliente.

### UI/UX
6. Página de Login (LoginForm.tsx):
    - Inputs controlados para Email y Password.
    - Validación Zod frontend (email válido, password min length).
    - Feedback visual (Loading state useFormStatus durante la petición, Toast/Alert para credenciales incorrectas).
    - Diseño responsivo (mobile-first).
7. Layout Principal:
    - Componente LogoutButton.tsx integrado en el Navbar o Sidebar existente.

### Tests
10. Unit: Pruebas sobre la validación Zod del esquema de login.
11. E2E/Integration: Flujo de intento de acceso a /dashboard sin sesión (redirect a /login) → Login exitoso → Redirect a /dashboard → Logout → Redirect a /login.

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/middleware.ts` | Crear/Modificar para validación de sesión global con refresh de tokens |
| `src/lib/supabase/server.ts` | Configurar utilidades de Supabase SSR (cookies get, set, remove) |
| `ssrc/lib/supabase/client.ts` | Configurar utilidades de Supabase para cliente (browser) |
| `src/actions/auth.ts` | Server Actions login y logout |
| `src/lib/validations/auth.ts` | Zod schema para el formulario de login |
| `src/app/login/page.tsx` | Página layout del login |
| `src/app/login/components/LoginForm.tsx` | Formulario interactivo UI ("use client") |
| `src/app/components/BottomNav.tsx` | Añadir componente LogoutButton |

## Notas técnicas
- **Supabase SSR:** Usar estrictamente @supabase/ssr (no el paquete viejo @supabase/auth-helpers-nextjs que está deprecado) para garantizar la compatibilidad con Next.js 16.

- **Refresh de Sesión:** Es vital que el middleware refresque el token de acceso modificando las cookies de respuesta de Next.js según la documentación oficial de Supabase SSR para evitar desconexiones inesperadas.

- **Seguridad:** No usar localStorage en el cliente para manejar la sesión; depender exclusivamente de las cookies HTTP-only gestionadas por el servidor.

## PROMT por Fase SSD
**Qué debe generar el orchestrator (a través de los sub‑agentes):** 

1. Explorar el estado actual de autenticación (probablemente solo las páginas externas de sucursal).
2. Proponer
    - Configurar Supabase Auth para manejar login de rol admin (email + contraseña).
    - Crear la página /login con formulario y Server Action de autenticación.
    - Implementar un Middleware en Next.js que proteja TODAS las rutas del sistema excepto /login y las rutas externas de sucursal (/sucursal/*) (serán implementadas luego).
    - Añadir Server Action de Logout y colocarlo en el navbar/layout principal.
3. Especificar flujos de usuario:
    - Intento de acceso a cualquier ruta protegida sin sesión → redirige a /login.
    - Login exitoso → establece sesión (cookie/JWT) y redirige a la página solicitada o al dashboard.
    - Logout → elimina sesión y redirige a /login.
    - Las rutas /sucursal/* usan un middleware distinto que solo permite rol branch_user y únicamente verbos GET. (serán implementadas luego).
4. Diseñar componentes/Server Actions:
    - Server Actions: adminLogin, adminLogout.
    - Componentes: LoginForm, AdminLayout (que verifica la sesión y muestra/logout), BranchMiddleware (solo‑lectura).
5. Tareas (dividir en unidades de trabajo):
    - Configuración de Supabase Agente (roles admin y branch_user).
    - Creación de página /login y su Server Action.
    - Implementación del middleware de protección de rutas (admin y branch).
    - Añadir logout al layout.
    - Seed/script de creación del primer admin (solo en dev/staging).
6. Aplicar las tareas en batches.
    - Verificar con pruebas unitarias (login/logout, middleware) y pruebas de integración (intentar acceder sin sesión, con rol incorrecto, con rol correcto).
    - Archivar el cambio.