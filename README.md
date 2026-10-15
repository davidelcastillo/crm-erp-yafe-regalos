# Stark Commerce OS

**Sistema de gestión de inventario para comercios locales** - Mobile-first, optimizado para Android.

## 🚀 Características

- **Productos en Inventario**: gestión de productos, categorías y stock; `/productos` redirige a `/inventario`
- **Módulo de Compras**: Registro de ingresos con múltiples productos por compra
- **Módulo de Ventas**: Registro de ventas con validación de stock
- **Módulo de Inventario**: Gestión de stock en tiempo real
- **Módulo de Clientes**: Seguimiento de deudas por cliente
- **Dashboard**: Estadísticas globales y análisis por producto

## 🆕 Nuevas funcionalidades (v3 / Fase 4)

- **Sucursales**: gestión completa con código único, y usuario de sucursal creado automáticamente en Supabase Auth (rol `branch_user`).
- **Catálogo externo de solo lectura**: acceso sin login a `/sucursal/[branchId]/inventory` únicamente para sucursales activas y publicadas (`isPublic=true`, solo `GET`).
- **Exportación a PDF**: asistente de 3 pasos para descargar el inventario de una sucursal como `inventario-<branchCode>-<YYYYMMDD>.pdf`.
- **Dashboard configurable**: selector de periodo (7/30/90 días o personalizado) y de sucursal, con etiquetas de contexto "(Sucursal X)" / "(Todas)".
- **Búsquedas mejoradas**: búsqueda unificada server-side en inventario (nombre, código, descripción, categoría) y búsqueda con debounce + "Cargar más" en ventas.

Documentación detallada:

- [Índice de documentación y flujo ODD](./docs/README.md)
- [Preguntas de alcance y resolución de bugs](./docs/flujo-odd.md)
- [Historial SDD cerrado](./openspec/README.md)
- [Gestión de sucursales](./docs/gestion-sucursales.md)
- [Portal externo de sucursal](./docs/portal-externo-sucursal.md)
- [Exportar inventario a PDF](./docs/exportar-inventario-pdf.md)

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Base de Datos**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Validación**: Zod
- **Estilos**: Tailwind CSS
- **UI**: SweetAlert2, Mobile-first Design

## 📋 Requisitos

- Node.js >=20.9.0 (requisito del Next.js instalado)
- Supabase (PostgreSQL)

## ⚡ Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd seguimientos-compras

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Copiar la plantilla y completar con tus valores (ver .env.example):
cp .env.example .env

# 4. Revisar esquema y destino de la base de datos
# No ejecutar db push ni SQL históricos sobre una base con datos sin autorización y respaldo.
# Confirmar con el responsable cómo preparar una base aislada para este entorno.

# 5. Generar cliente Prisma
npx prisma generate

# 6. Iniciar servidor de desarrollo
npm run dev
```

## 📁 Estructura del Proyecto

```
seguimientos-compras/
├── prisma/
│   └── schema.prisma          # Schema de base de datos
├── src/
│   ├── app/
│   │   ├── actions/          # Server Actions (CRUD)
│   │   ├── productos/        # Módulo Productos
│   │   ├── compras/         # Módulo Compras
│   │   ├── ventas/          # Módulo Ventas
│   │   ├── inventario/      # Módulo Inventario
│   │   ├── clientes/       # Módulo Clientes
│   │   ├── dashboard/       # Módulo Dashboard
│   │   └── components/      # Componentes compartidos
│   └── lib/
│       ├── prisma.ts        # Cliente Prisma
│       └── parse-prisma.ts  # Utilidad de serialización
├── docs/                   # Guías actuales e historial preservado
├── odd/tasks/              # Trabajo ODD que requiere continuidad
├── openspec/               # Historial SDD cerrado
├── jest.config.js          # Configuración de tests
├── package.json
└── README.md
```

## 🧪 Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar con coverage
npm test -- --coverage
```

Jest + React Testing Library cubren acciones y componentes. No se fija un número de tests: depende del checkout y la ejecución observada. Hay antecedentes de tests con base real; comprobar aislamiento y autorización antes de ejecutar la suite. Playwright y `test:e2e` no están configurados en este baseline.

## 📱 UI/UX

- **Mobile-first**: Diseño optimizado para pantallas pequeñas
- **Bottom Navigation**: Navegación inferior fija
- **Bottom Sheets**: Modales tipo hoja inferior en móvil
- **Responsive**: Se adapta a escritorio

## 🔒 Validaciones

- **Zod**: Validación de Server Actions
- **Transacciones Prisma**: Operaciones atómicas
- **Stock validation**: Previene ventas sin stock disponible

## 📦 Deployment

### Vercel ( Recomendado)

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Deploy
vercel
```

### Variables de Entorno en Vercel

Configurar las variables del entorno según `.env.example` y [AGENTS.md](./AGENTS.md), incluidas las conexiones de base y Supabase. `SUPABASE_SERVICE_ROLE_KEY` es solo de servidor; nunca exponerla al cliente. No desplegar como parte de una limpieza documental.

## 📝 Comandos Útiles

```bash
npm run dev          # Desarrollo
npm run build      # Build producción
npm run start      # Iniciar producción
npm test           # Tests
npx prisma studio  # UI de base de datos
```

## 🤝 Contribuir

1. Fork del repositorio
2. Crear branch (`git checkout -b feature/nueva-caracteristica`)
3. Commit (`git commit -m 'Agrega nueva característica'`)
4. Push (`git push origin feature/nueva-caracteristica`)
5. Abrir Pull Request

## 📄 Licencia

MIT

---

## Auth-User-Id en Branch

La tabla `Branch` incluye un campo `authUserId` que almacena el ID de usuario de Supabase Auth asociado con cada sucursal. Este campo es único y nullable, permitiendo:

1. Eliminación precisa de usuarios de Auth al borrar una sucursal
2. Asociación explícita entre sucursales y usuarios del sistema
3. Back-fill de registros existentes mediante el servicio de administración

El campo permite asociar el usuario heredado de Auth; no concede acceso al catálogo público. Los SQL históricos conservados no equivalen a un historial reproducible de migraciones Prisma: comprobar cada entorno antes de operar sobre el esquema.

---

**Stark Commerce OS** - Controla tu negocio desde cualquier lugar.