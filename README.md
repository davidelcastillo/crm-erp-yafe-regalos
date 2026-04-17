# Stark Commerce OS

**Sistema de gestión de inventario para comercios locales** - Mobile-first, optimizado para Android.

## 🚀 Características

- **Módulo de Productos**: CRUD completo con stock
- **Módulo de Compras**: Registro de ingresos con múltiples productos por compra
- **Módulo de Ventas**: Registro de ventas con validación de stock
- **Módulo de Inventario**: Gestión de stock en tiempo real
- **Módulo de Clientes**: Seguimiento de deudas por cliente
- **Dashboard**: Estadísticas globales y análisis por producto

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Base de Datos**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Validación**: Zod
- **Estilos**: Tailwind CSS
- **UI**: SweetAlert2, Mobile-first Design

## 📋 Requisitos

- Node.js 18+
- Supabase (PostgreSQL)

## ⚡ Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd seguimientos-compras

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crear archivo .env con:
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# 4. Sincronizar base de datos
npx prisma db push

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
├── promts/                  # Prompts de desarrollo
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

**33 tests pasando** - Cubren Server Actions y lógica de negocio.

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

Agregar en el dashboard de Vercel:
- `DATABASE_URL`
- `DIRECT_URL`

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

**Stark Commerce OS** - Controla tu negocio desde cualquier lugar.