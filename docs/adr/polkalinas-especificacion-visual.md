# Polkalina's · Especificación visual del sistema de gestión

**Stack:** Next.js 16 + Tailwind 4 (tokens en `@theme`), mobile-first.
**Base:** la paleta y las tipografías de los mockups HTML de Polkalina's.
**Dos variantes:**

| | **Variante A · recolor** | **Variante B · interfaz plana** |
|---|---|---|
| Estructura | Se mantiene igual: glass con blur, degradé en encabezados, bottom-sheets y radios grandes | Superficies crema y blanco planas, sin blur ni degradé |
| Bordes | Sutiles: blanco translúcido sobre el glass | Marcados: 2 px cacao en botones y 1 px `#EADAD6` en paneles |
| Radios | Grandes: `rounded-2xl` / `rounded-3xl` | Medios: `rounded-xl` / `rounded-[18px]`; botones y chips en `rounded-full` |
| Sombras | Suaves, tintadas de cacao | Ninguna en reposo; solo al arrastrar en el Kanban y en el FAB |
| Títulos | Fraunces **regular**, sin itálica | Fraunces **itálica** como identidad en títulos, etiquetas de sección y precios |
| Encabezado | Degradé cacao → vino con texto crema | Fondo crema, borde inferior y franja "piano" opcional |

> **Convención del documento:** 🅰 = solo variante A · 🅱 = solo variante B · sin marca = igual en las dos.

---

## 1. Mapa de tokens

### 1.1 Contraste verificado (WCAG 2.1, calculado)

| Par (texto / fondo) | Ratio | Uso | ¿Pasa? |
|---|---|---|---|
| cacao `#4A2C2A` / crema `#FFF6F0` | **11.69** | Texto principal | ✅ AAA |
| cacao / blanco `#FFFFFF` | 12.46 | Texto en cards y paneles | ✅ AAA |
| suave `#76574F` / crema | **6.07** | Texto secundario | ✅ AA |
| suave / blanco | 6.47 | Texto secundario en cards | ✅ AA |
| suave / rosa `#F2C4CC` | 4.17 | — | ❌ **No usar** |
| cacao / rosa | 8.04 | Texto sobre chips y columnas rosa | ✅ AAA |
| frutilla `#C8323C` / crema | **4.95** | Precios y links de acento (≥ 16 px) | ✅ AA |
| frutilla / blanco | 5.28 | Acento dentro de cards | ✅ AA |
| frutilla / rosa | 3.41 | — | ❌ **No usar como texto** |
| crema / frutilla | 4.95 | Texto en FAB y badges rojos | ✅ AA |
| crema / cacao | 11.69 | Texto en botón primario | ✅ AAA |
| rosa / cacao | 8.04 | Ítem activo y texto secundario en la barra oscura | ✅ AAA |
| crema / `#A8262F` (frutilla oscura) | 6.60 | Botón danger y hover del acento | ✅ AA |
| **Badges 11–12 px** | | | |
| ok `#2F5B33` / `#E3EFE3` | 6.65 | En stock, Pagado, Disponible | ✅ |
| warn `#7A4A06` / `#FBE7C8` | 6.18 | Stock bajo, Reservada, vence hoy | ✅ |
| bad `#8E1F28` / `#F6D5D7` | 6.49 | Agotado y errores | ✅ |
| neutro `#5E4E4B` / `#ECE6E4` | 6.38 | Entregado y Vendida en el sistema | ✅ |
| blanco / warn `#7A4A06` | 7.47 | **vencida** (ámbar sólido) | ✅ |
| cacao / arena `#F3E3D3` | 9.93 | Badge Reservado y columna del Kanban | ✅ |
| suave / columnas del Kanban (`#F3E3D3`, `#E3EFE3`, `#ECE6E4`) | 5.16 / 5.46 / 5.24 | Metadatos en columnas | ✅ |
| **No texto (UI ≥ 3:1, criterio 1.4.11)** | | | |
| borde `#EADAD6` / crema | 1.27 | Solo decorativo (paneles) | ⚠️ no sirve para controles |
| **borde-control `#8A6E68`** / crema | **4.37** | Borde de inputs, checkbox y select | ✅ |
| foco frutilla / crema (anillo con offset) | 4.95 | Anillo `focus-visible` | ✅ |
| 🅰 crema / glass oscuro (blanco 10 % sobre cacao) | 8.63 | Texto en glass del encabezado | ✅ |
| 🅰 rosa / glass oscuro (blanco 10 % sobre vino `#6B2F32`) | 4.94 | Texto secundario en el encabezado | ✅ (solo hasta /10) |
| 🅰 cacao / glass claro (blanco 70 % sobre rosa) | 10.96 | Texto en cards glass del cuerpo | ✅ |
| 🅰 suave / glass claro (blanco 70 % sobre rosa) | 5.69 | Secundario en cards glass | ✅ |

**Reglas que salen de esta tabla:**

1. **Frutilla nunca va como texto sobre rosa**, y **suave tampoco**. Sobre rosa, todo el texto va en cacao.
2. **Texto en frutilla**, solo sobre crema o blanco, y mejor desde 14 px semibold. El rojo es acento, no texto corrido.
3. **`#EADAD6` es solo para separar paneles.** Para inputs, checkbox y select se usa `--color-borde-control: #8A6E68`.
4. 🅰 **En el encabezado con degradé,** el texto secundario rosa solo va sobre glass `white/10`. Con `/15` o más, usar crema.
5. **Peligro y acento se separan:** la frutilla es marca (precios, FAB, ítem activo) y lo destructivo usa **frutilla oscura `#A8262F`**, siempre con ícono y texto explícito.

### 1.2 `globals.css`: tokens comunes (se pegan en las dos variantes)

```css
@import "tailwindcss";

@theme {
  /* Marca (valores crudos) */
  --color-crema: #FFF6F0;
  --color-rosa: #F2C4CC;
  --color-frutilla: #C8323C;
  --color-cacao: #4A2C2A;
  --color-gris: #D8D2D0;
  --color-arena: #F3E3D3;
  --color-vino: #6B2F32;

  /* Semánticos */
  --color-superficie: #FFF6F0;          /* fondo de la app */
  --color-superficie-suave: #F7EFEA;    /* hover de filas y chips; fondo de toolbars */
  --color-superficie-fuerte: #FFFFFF;   /* cards, paneles, modales, inputs */
  --color-texto: #4A2C2A;
  --color-texto-suave: #76574F;
  --color-texto-invertido: #FFF6F0;
  --color-acento: #C8323C;
  --color-acento-hover: #A8262F;
  --color-primario: #4A2C2A;
  --color-primario-hover: #3A2220;
  --color-primario-active: #2A1817;
  --color-peligro: #A8262F;
  --color-peligro-hover: #8E1F28;
  --color-borde: #EADAD6;               /* paneles y divisores (decorativo) */
  --color-borde-control: #8A6E68;       /* inputs, checkbox, select (≥ 3:1) */
  --color-foco: #C8323C;                /* anillo focus-visible */
  --color-deshabilitado-bg: #ECE6E4;
  --color-deshabilitado-texto: #76574F;

  /* Estados (fondo / texto) */
  --color-ok-bg: #E3EFE3;      --color-ok: #2F5B33;
  --color-warn-bg: #FBE7C8;    --color-warn: #7A4A06;
  --color-bad-bg: #F6D5D7;     --color-bad: #8E1F28;
  --color-neutro-bg: #ECE6E4;  --color-neutro: #5E4E4B;

  /* Kanban (fondo por columna) */
  --color-col-reservado: #F3E3D3;
  --color-col-pagado: #E3EFE3;
  --color-col-enviar: #F2C4CC;
  --color-col-entregado: #ECE6E4;

  /* Skeleton */
  --color-skeleton: #EFE4DF;
  --color-skeleton-brillo: #F7EFEA;

  /* Series de gráficos (ver punto 8) */
  --color-serie-1: #4A2C2A;
  --color-serie-2: #C8323C;
  --color-serie-3: #A86E2A;
  --color-serie-4: #B9566A;
  --color-serie-5: #5E8C6A;
  --color-serie-6: #76574F;

  /* Tipografía (con next/font, ver punto 11) */
  --font-sans: var(--font-work-sans), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-fraunces), ui-serif, Georgia, serif;
}
```

> Tailwind 4 resuelve `var(--font-…)` en tiempo de ejecución si el bloque de fuentes se declara con `@theme inline`. Si `font-display` no toma la fuente, mové las dos líneas `--font-*` a un bloque `@theme inline { … }` aparte.

### 1.3 🅰 Tokens propios de la variante A

```css
@theme {
  --color-marca-desde: #4A2C2A;                      /* degradé del encabezado */
  --color-marca-medio: #6B2F32;
  --color-marca-hasta: #8E2A33;
  --color-glass: rgb(255 255 255 / 0.70);            /* cards glass sobre el cuerpo */
  --color-glass-borde: rgb(255 255 255 / 0.60);
  --color-glass-oscuro: rgb(255 255 255 / 0.10);     /* glass dentro del encabezado */
  --color-glass-oscuro-borde: rgb(255 255 255 / 0.18);
  --shadow-glass: 0 8px 24px -12px rgb(74 44 42 / 0.25);
  --shadow-levantar: 0 16px 32px -12px rgb(74 44 42 / 0.40);
  --radius-panel: 1.5rem;                            /* 24 px */
  --radius-control: 1rem;                            /* 16 px */
}
```

### 1.4 🅱 Tokens propios de la variante B

```css
@theme {
  --radius-panel: 18px;
  --radius-control: 12px;
  --shadow-levantar: 0 12px 24px -8px rgb(74 44 42 / 0.35);  /* solo Kanban y FAB */
  --shadow-fab: 0 6px 16px rgb(74 44 42 / 0.25);
}
```

### 1.5 Resumen de qué cambia entre variantes

| Token o propiedad | 🅰 | 🅱 |
|---|---|---|
| Fondo del encabezado | `bg-linear-to-br from-marca-desde via-marca-medio to-marca-hasta` | `bg-superficie border-b border-borde` |
| Superficie de cards | `bg-glass backdrop-blur-md border-glass-borde` | `bg-superficie-fuerte border-borde` |
| Radio de panel | `rounded-3xl` (24 px) | `rounded-[18px]` |
| Borde de botón secundario | 1.5 px `border-cacao/30` | **2 px `border-cacao`** |
| Sombra de card | `shadow-glass` | ninguna |
| Títulos | `font-display font-normal not-italic` | `font-display italic` |

---

## 2. Botones

### 2.1 Estados por tipo

| Tipo | Reposo | Hover | Active | Focus-visible | Disabled |
|---|---|---|---|---|---|
| **Primario** | fondo cacao · texto crema · borde cacao | `#3A2220` | `#2A1817` + `scale-[.98]` | anillo 2 px frutilla, offset 2 px crema | fondo `#ECE6E4` · texto suave · sin borde |
| **Secundario** 🅰 | `white/70` + blur · texto cacao · borde `cacao/30` 1.5 px | `white/90` | `white` | ídem | ídem |
| **Secundario** 🅱 | transparente · texto cacao · **borde cacao 2 px** | fondo `#F7EFEA` | fondo `#EFE4DF` | ídem | borde `#D8D2D0` · texto suave |
| **Ghost** | transparente · texto cacao · sin borde | `#F7EFEA` | `#EFE4DF` | ídem | texto suave |
| **Danger** | fondo `#A8262F` · texto crema | `#8E1F28` | `#7A1A22` | ídem | igual que el primario deshabilitado |
| **Ícono** (44×44) | transparente · ícono cacao | `#F7EFEA` | `#EFE4DF` | ídem | ícono `#D8D2D0` |
| **Pequeño** | igual que su tipo, alto 40 px, `text-sm` | — | — | — | — |
| **Acento** (solo FAB y CTA públicos) | fondo frutilla · texto crema | `#A8262F` | `#8E1F28` | ídem | — |

> Los botones pequeños miden 40 px de alto. Dentro de listas táctiles, envolvelos para que el área tocable llegue a 44 px; si no, usá el tamaño normal.

### 2.2 SweetAlert2

| Hoy | Nuevo | Contraste con su texto |
|---|---|---|
| Confirmar `#6d28d9` | **Cacao `#4A2C2A`** (`#3A2220` en hover) | crema 11.69 |
| Destructivo `#dc2626` | **Frutilla oscura `#A8262F`** | crema 6.60 |
| Cancelar (gris por defecto) | Secundario: borde cacao y texto cacao; con colores nativos, **`#76574F`** | blanco 6.47 |

Lo recomendado es apagar los estilos propios de Swal y usar las mismas clases de Tailwind. Crear `lib/alerta.ts`:

```ts
import Swal from "sweetalert2";

const base = "inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-full font-sans font-semibold text-[15px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 focus-visible:ring-offset-superficie-fuerte";

export const alerta = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true, // cancelar a la izquierda, confirmar a la derecha
  customClass: {
    // 🅰 popup glass · 🅱 popup plano (cambiar según variante)
    popup: "rounded-3xl bg-superficie-fuerte text-texto font-sans p-6", // 🅱: "rounded-[18px] border border-borde bg-superficie-fuerte text-texto font-sans p-6"
    title: "font-display text-2xl text-texto", // 🅱: agregar "italic"
    htmlContainer: "text-texto-suave text-base",
    actions: "gap-3 w-full flex-col-reverse sm:flex-row sm:justify-end",
    confirmButton: `${base} w-full sm:w-auto bg-primario text-texto-invertido border-2 border-primario hover:bg-primario-hover active:bg-primario-active`,
    cancelButton: `${base} w-full sm:w-auto bg-transparent text-texto border-2 border-cacao hover:bg-superficie-suave`, // 🅰: "border-[1.5px] border-cacao/30"
    denyButton: `${base} w-full sm:w-auto bg-peligro text-texto-invertido border-2 border-peligro hover:bg-peligro-hover`,
  },
});

export const confirmarBorrado = (que: string) =>
  alerta.fire({
    title: `¿Eliminar ${que}?`,
    text: "Esta acción no se puede deshacer.",
    icon: "warning",
    iconColor: "#7A4A06",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
    customClass: { confirmButton: `${base} w-full sm:w-auto bg-peligro text-texto-invertido border-2 border-peligro hover:bg-peligro-hover` },
  });
```

Si se mantienen los colores nativos de Swal: `confirmButtonColor: "#4A2C2A"`, `cancelButtonColor: "#76574F"` y, en lo destructivo, `confirmButtonColor: "#A8262F"`. Íconos de Swal: `success "#2F5B33"`, `warning "#7A4A06"`, `error "#A8262F"` e `info "#4A2C2A"`.

---

## 3. Navbar superior, BottomNav y footers

### 3.1 Navbar superior (título, menú ☰ y acciones a la derecha)

| Elemento | 🅰 Degradé | 🅱 Plana |
|---|---|---|
| Fondo | degradé cacao → vino → `#8E2A33` | crema con `border-b border-borde`; franja "piano" opcional debajo, de 12 px en el celu |
| Título | crema · Fraunces regular 20 px | cacao · **Fraunces itálica** 20 px |
| Subtítulo (usuario o rol) | rosa 12 px, solo con glass hasta `/10` | suave 12 px |
| Botón ☰ y acciones | ícono crema, hover `white/10` | ícono cacao, hover `#F7EFEA` |
| Pegajosa | `sticky top-0 z-30` | ídem |

### 3.2 BottomNav móvil

| Estado | Ícono y texto | Indicador |
|---|---|---|
| Activo | frutilla `#C8323C` · `font-semibold` | 🅰 píldora `bg-rosa/60` detrás del ícono · 🅱 barra de 3 px frutilla arriba del ítem |
| Inactivo | suave `#76574F` | — |
| Badge contador | fondo frutilla · texto crema · 11 px · `min-w-[18px] h-[18px]` | crema/frutilla 4.95 ✅ |

Fondo: 🅰 `bg-white/80 backdrop-blur-md border-t border-white/60` · 🅱 `bg-superficie-fuerte border-t border-borde`.

### 3.3 Footers

- **Footer de modal (bottom-sheet):** acciones apiladas, con la primaria abajo y a todo el ancho. 🅰 `bg-white/80 backdrop-blur-md` · 🅱 `bg-superficie-fuerte border-t border-borde`. Agregar `pb-[calc(1rem+env(safe-area-inset-bottom))]`.
- **Footer de página** (pie de formularios largos): `sticky bottom-[72px]` en el celu, para no tapar la BottomNav, y `static` desde `md`.

---

## 4. Cards

### 4.1 Tarjeta de producto o prenda

Contenido: foto 4:5 (o miniatura 64×80 en lista), **nombre**, **código** (`PK-0142`), **precio** y **badge de estado**.

| Elemento | 🅰 | 🅱 |
|---|---|---|
| Contenedor | glass claro, `rounded-3xl`, `shadow-glass` | blanco, `rounded-2xl`, `border border-borde` |
| Nombre | Work Sans 15 px semibold, cacao, `truncate` | **Fraunces** 16 px, cacao, `line-clamp-2` |
| Código | Work Sans 13 px, suave, `tabular-nums` | ídem |
| Precio | Work Sans 16 px bold, cacao | **Fraunces itálica** 18 px, cacao |
| Estado | badge (punto 5) | ídem |

### 4.2 ActionCard (acceso rápido con ícono, título y descripción)

- 🅰: glass claro, ícono dentro de un círculo `bg-rosa/70`, título Fraunces regular.
- 🅱: blanco con borde, ícono dentro de un círculo `bg-rosa`, título **Fraunces itálica** y chevron a la derecha.
- Estado presionado: 🅰 `active:scale-[.98] active:bg-white/90` · 🅱 `active:bg-superficie-suave`.

### 4.3 Toolbar o banda de acciones

Es la franja con buscador, chips y acciones sobre los listados.
- 🅰 glass claro pegajosa debajo del navbar.
- 🅱 `bg-superficie` con `border-b border-borde`.
- En el celu el contenido se desliza en horizontal (`overflow-x-auto`) y no hace salto de línea.

---

## 5. Badges de estado

Forma común: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap`. Todos con punto de 6 px opcional (`size-1.5 rounded-full bg-current`), para no depender solo del color.

| Grupo | Estado | Fondo | Texto | Ratio |
|---|---|---|---|---|
| **Operativos** | En stock | `ok-bg` | `ok` | 6.65 |
| | Stock bajo | `warn-bg` | `warn` | 6.18 |
| | Agotado | `bad-bg` | `bad` | 6.49 |
| **Kanban de pedidos** | Reservado | `arena #F3E3D3` | `cacao` | 9.93 |
| | Pagado | `ok-bg` | `ok` | 6.65 |
| | Para enviar | `rosa` | `cacao` | 8.04 |
| | Entregado | `neutro-bg` | `neutro` | 6.38 |
| | **vence hoy** | `warn-bg` | `warn` + ícono reloj | 6.18 |
| | **vencida** | `warn` sólido `#7A4A06` | blanco | 7.47 |
| **Vidriera pública** | Disponible | `ok-bg` | `ok` | 6.65 |
| | Reservada | `warn-bg` | `warn` | 6.18 |
| | Vendida | `cacao` sólido | `crema` | 11.69 |
| | Consultar | `rosa` | `cacao` | 8.04 |

🅱 En la vidriera, las etiquetas Reservada y Vendida van como banda sobre la foto (`absolute inset-x-2.5 bottom-2.5 rounded-[10px] py-2 text-center`), igual que en los mockups.

---

## 6. Formularios

| Estado | Fondo | Borde | Texto | Extra |
|---|---|---|---|---|
| Reposo | blanco | 1.5 px `#8A6E68` (`borde-control`) | cacao 16 px | placeholder suave |
| Hover | blanco | `cacao` | — | — |
| Foco | blanco | `cacao` | — | anillo 2 px frutilla + offset 2 px |
| Error | `bad-bg/40` | 1.5 px `bad` | cacao | mensaje 13 px `bad` con ícono y `aria-invalid` |
| Deshabilitado | `#ECE6E4` | transparente | suave | `cursor-not-allowed` |

- **Label:** Work Sans 14 px semibold, cacao, `mb-1.5`. 🅱 en encabezados de grupo, Fraunces itálica 17 px.
- **Ayuda:** 13 px suave, `mt-1`.
- **Alto:** 44 px en input, select y date picker (`min-h-11`); checkbox de 20 px dentro de un label de 44 px.
- **Radios:** 🅰 `rounded-2xl` · 🅱 `rounded-xl`.
- **Fuente:** 16 px en el celu, para que iOS no haga zoom.
- **Date picker:** usar `<input type="date">` con las mismas clases y `accent-color` cacao. Si usás un componente propio, el día seleccionado va con fondo cacao y texto crema, y el día de hoy con anillo frutilla.

---

## 7. Chips de filtro, tabs segmentados y FAB

| Componente | Inactivo | Activo |
|---|---|---|
| Chip de filtro | blanco · borde `#EADAD6` · cacao | **cacao sólido · texto crema** (🅰 opcional `bg-rosa` con texto cacao) |
| Tab segmentado | contenedor `#F1E6E1`; tab transparente con texto suave | tab blanco · texto cacao · `shadow-xs` (🅱 sin sombra: `ring-1 ring-borde`) |
| FAB | frutilla · texto e ícono crema · 52 px de alto · `rounded-full` | hover `#A8262F` |

El FAB va `fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))]`, por encima de la BottomNav y solo en el celu (`md:hidden`).

---

## 8. KPI cards y gráficos (Recharts)

**KPI:** etiqueta 13 px suave, valor 24 px (celu) o 30 px (desktop) y nota 12 px suave.
- 🅰 valor en Work Sans bold.
- 🅱 valor en **Fraunces** 28/34 px.
- Valores de alerta (reservas sin cobrar) en frutilla.
- Siempre `tabular-nums`.

**Series** (orden recomendado; todas ≥ 3:1 sobre blanco o crema):

| # | Token | Hex | vs blanco | Uso |
|---|---|---|---|---|
| 1 | `--color-serie-1` | `#4A2C2A` cacao | 12.46 | Serie principal o total |
| 2 | `--color-serie-2` | `#C8323C` frutilla | 5.28 | Destacado (mes actual) |
| 3 | `--color-serie-3` | `#A86E2A` ocre | 4.26 | Tercera categoría |
| 4 | `--color-serie-4` | `#B9566A` rosa oscuro | 4.56 | Cuarta (no ponerla al lado de frutilla) |
| 5 | `--color-serie-5` | `#5E8C6A` verde salvia | 3.86 | Quinta |
| 6 | `--color-serie-6` | `#76574F` suave | 6.47 | "Otros" |

- Cacao y frutilla se distinguen poco entre sí (2.36). En barras apiladas o tortas, separá los segmentos con un trazo blanco de 2 px (`stroke="#FFFFFF" strokeWidth={2}`) y mostrá etiquetas o leyenda.
- El rosa `#F2C4CC` **no** se usa como serie (1.4:1). Sirve para áreas de fondo (`fillOpacity={0.35}`) debajo de una línea cacao.
- **Configuración de Recharts:**
  - Grilla: `CartesianGrid stroke="#EADAD6" strokeDasharray="3 3" vertical={false}`
  - Ejes: `tick={{ fill: "#76574F", fontSize: 12, fontFamily: "var(--font-work-sans)" }}`, `axisLine={false}`, `tickLine={false}`
  - Tooltip: `contentStyle={{ background: "#FFFFFF", border: "1px solid #EADAD6", borderRadius: 12, color: "#4A2C2A" }}`, `cursor={{ fill: "#F7EFEA" }}`
  - Barras: `radius={[8, 8, 4, 4]}`
- 🅰 Dentro de un card glass, el fondo del gráfico queda transparente. 🅱 Fondo blanco.

---

## 9. Kanban de pedidos

| Columna | Fondo | Encabezado |
|---|---|---|
| Reservado | `#F3E3D3` | cacao 15 px semibold + contador |
| Pagado | `#E3EFE3` | ídem |
| Para enviar | `#F2C4CC` | ídem (texto **cacao**, nunca suave ni frutilla) |
| Entregado | `#ECE6E4` | ídem |

- **Tarjeta:** blanca, borde `#EADAD6`, radio 14 px (🅰 `rounded-2xl` con `white/90`). ID 12 px suave, canal en chip `#F7EFEA`, clienta 15 px semibold, total 15 px bold, nota 13 px suave.
- **Arrastre (`data-dragging=true`):** `shadow-levantar`, `rotate-1`, `scale-[1.02]`, `ring-2 ring-frutilla/40` y `cursor-grabbing`. La columna destino muestra `ring-2 ring-inset ring-cacao/30`.
- **Celu:** una columna por vez con tab segmentado; el resto oculto.
- 🅰 Las columnas pueden ser glass tintado (`bg-[#F3E3D3]/80 backdrop-blur-sm`). 🅱 Columnas sólidas.

---

## 10. Skeletons y spinners

- **Skeleton:** fondo `#EFE4DF` sobre crema y `#F3E9E4` dentro de cards blancas, con `motion-safe:animate-pulse`. Radio igual al del elemento que reemplaza.
- **Spinner:** anillo de 2 px `#EADAD6` con segmento superior **frutilla** y `animate-spin`. Dentro del botón primario, anillo `crema/30` con segmento crema.
- Se respeta `prefers-reduced-motion`: el pulso se apaga con `motion-reduce:animate-none`.

---

## 11. Tipografía

### 11.1 Reglas de uso

| Rol | Fuente | 🅰 | 🅱 | Tamaño celu / desktop |
|---|---|---|---|---|
| Marca "Polkalina's" | Fraunces | itálica | itálica | 20 / 24 px |
| Título de página (h1) | Fraunces | regular | **itálica** | 26 / 34 px, `leading-tight` |
| Título de sección o card (h2) | 🅰 Work Sans semibold · 🅱 Fraunces | 17 px semibold | **itálica** 20 px | 17–20 px |
| Etiqueta de sección (kicker) | Work Sans | 12 px semibold, mayúsculas, `tracking-[.14em]`, suave | ídem | 12 px |
| Cuerpo | Work Sans | 16 px / 1.5 | ídem | 16 px |
| Secundario y metadatos | Work Sans | 13–14 px, suave | ídem | 13–14 px |
| **Datos** (precios, totales, KPI, códigos, cantidades) | Work Sans `tabular-nums` | semibold o bold | **Fraunces itálica** para precios y KPI destacados; códigos y cantidades siguen en Work Sans | precio 16–18 px, KPI 24–34 px |
| Botones, chips, badges y tabs | Work Sans | semibold | ídem | 15 / 13 / 12 / 13–14 px |

**Nunca uses Fraunces** en tablas, inputs, badges ni números que se comparan en columna: con Work Sans `tabular-nums` quedan alineados.

### 11.2 Carga con `next/font`

```tsx
// app/fonts.ts
import { Fraunces, Work_Sans } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],          // fuente variable: no se declaran pesos
  display: "swap",
  variable: "--font-fraunces",
});

export const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-work-sans",
});
```

```tsx
// app/layout.tsx
import { fraunces, workSans } from "./fonts";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${workSans.variable}`}>
      <body className="min-h-dvh bg-superficie font-sans text-base text-texto antialiased">{children}</body>
    </html>
  );
}
```

```css
/* globals.css: además de los bloques del punto 1 */
@theme inline {
  --font-sans: var(--font-work-sans), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-fraunces), ui-serif, Georgia, serif;
}
```

---

## 12. Recetas de clases (className exactos)

> Cada componente tiene una línea **🅰** y una **🅱**. Si hay una sola línea, es igual en las dos.

### Botones

```txt
Base (las dos)
inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-full font-semibold text-[15px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 focus-visible:ring-offset-superficie disabled:cursor-not-allowed disabled:bg-deshabilitado-bg disabled:text-deshabilitado-texto disabled:border-transparent

Primario
🅰 + bg-primario text-texto-invertido border border-primario shadow-glass hover:bg-primario-hover active:bg-primario-active active:scale-[.98]
🅱 + bg-primario text-texto-invertido border-2 border-primario hover:bg-primario-hover active:bg-primario-active active:scale-[.98]

Secundario
🅰 + bg-white/70 backdrop-blur-md text-texto border-[1.5px] border-cacao/30 hover:bg-white/90 active:bg-white
🅱 + bg-transparent text-texto border-2 border-cacao hover:bg-superficie-suave active:bg-skeleton disabled:border-gris

Ghost
+ bg-transparent text-texto border border-transparent hover:bg-superficie-suave active:bg-skeleton

Danger
🅰 + bg-peligro text-texto-invertido border border-peligro hover:bg-peligro-hover active:bg-[#7A1A22]
🅱 + bg-peligro text-texto-invertido border-2 border-peligro hover:bg-peligro-hover active:bg-[#7A1A22]

Acento (FAB y CTA de la vidriera)
+ bg-acento text-texto-invertido border-2 border-acento hover:bg-acento-hover active:bg-peligro-hover

Pequeño (se suma a cualquiera)
min-h-10 px-3.5 text-sm

Ícono
inline-flex size-11 shrink-0 items-center justify-center rounded-full text-texto hover:bg-superficie-suave active:bg-skeleton focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 focus-visible:ring-offset-superficie disabled:text-gris
Ícono sobre el encabezado 🅰: inline-flex size-11 shrink-0 items-center justify-center rounded-full text-crema hover:bg-white/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rosa
```

### Navbar superior

```txt
Contenedor
🅰 sticky top-0 z-30 flex items-center gap-2 px-2 py-2 bg-linear-to-br from-marca-desde via-marca-medio to-marca-hasta text-crema md:px-6 md:py-3
🅱 sticky top-0 z-30 flex items-center gap-2 px-2 py-2 bg-superficie text-texto border-b border-borde md:px-6 md:py-3

Bloque de título (min-w-0 para que trunque)
flex min-w-0 flex-1 items-center gap-2.5
Título
🅰 font-display text-xl leading-none truncate
🅱 font-display italic text-xl leading-none truncate
Subtítulo
🅰 text-xs text-rosa truncate
🅱 text-xs text-texto-suave truncate

Glass dentro del encabezado 🅰 (buscador o resumen)
rounded-2xl bg-glass-oscuro border border-glass-oscuro-borde backdrop-blur-md px-4 py-3 text-crema

Franja "piano" 🅱 (debajo del navbar, opcional)
h-3 md:h-4 bg-[url('/piano.svg')] bg-repeat-x bg-[length:auto_100%] border-y border-cacao   (exportá piano.svg desde la franja del kit de marca)
```

### BottomNav

```txt
Contenedor
🅰 fixed inset-x-0 bottom-0 z-40 flex bg-white/80 backdrop-blur-md border-t border-white/60 px-1.5 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden
🅱 fixed inset-x-0 bottom-0 z-40 flex bg-superficie-fuerte border-t border-borde px-1.5 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden

Ítem
relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-texto-suave aria-[current=page]:text-acento focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco rounded-xl

Indicador activo
🅰 (en el ícono) rounded-full px-3 py-1 group-aria-[current=page]:bg-rosa/60
🅱 (antes del ícono) absolute top-0 inset-x-5 h-[3px] rounded-full bg-acento opacity-0 group-aria-[current=page]:opacity-100
(el ítem lleva "group")

Badge contador
absolute top-1 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-acento text-texto-invertido text-[11px] font-semibold leading-[18px] text-center tabular-nums
```

### Modal bottom-sheet y footers

```txt
Fondo
fixed inset-0 z-50 bg-cacao/45 backdrop-blur-[2px] transition-opacity duration-200

Hoja
🅰 fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-levantar md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl
🅱 fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[22px] bg-superficie border-t border-borde md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[22px] md:border

Tirador
mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-gris

Título del modal
🅰 font-display text-2xl px-5 pt-3
🅱 font-display italic text-2xl px-5 pt-3

Footer del modal
🅰 sticky bottom-0 flex flex-col-reverse gap-2.5 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 backdrop-blur-md sm:flex-row sm:justify-end
🅱 sticky bottom-0 flex flex-col-reverse gap-2.5 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-superficie-fuerte border-t border-borde sm:flex-row sm:justify-end
(los botones adentro llevan: w-full sm:w-auto)

Footer de página (formularios)
🅰 sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col-reverse gap-2.5 px-4 py-3 bg-white/80 backdrop-blur-md md:static md:mx-0 md:flex-row md:justify-end md:bg-transparent md:backdrop-blur-none md:px-0
🅱 sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col-reverse gap-2.5 px-4 py-3 bg-superficie border-t border-borde md:static md:mx-0 md:flex-row md:justify-end md:border-0 md:px-0
```

### Cards

```txt
Panel o card genérico
🅰 rounded-3xl bg-glass backdrop-blur-md border border-glass-borde shadow-glass p-4 md:p-5 min-w-0
🅱 rounded-[18px] bg-superficie-fuerte border border-borde p-4 md:p-5 min-w-0

Encabezado de card
flex items-center justify-between gap-2 mb-3
Título de card
🅰 text-[17px] font-semibold text-texto truncate
🅱 font-display italic text-xl text-texto truncate
Link de card
shrink-0 text-sm font-semibold text-texto underline underline-offset-4 hover:text-acento

Prenda · lista (fila)
🅰 flex items-center gap-3 rounded-3xl bg-glass backdrop-blur-md border border-glass-borde shadow-glass p-3 active:scale-[.99]
🅱 flex items-center gap-3 rounded-2xl bg-superficie-fuerte border border-borde p-3 active:bg-superficie-suave
  Miniatura: h-20 w-16 shrink-0 rounded-[10px] bg-gris object-cover
  Cuerpo: flex min-w-0 flex-1 flex-col gap-1
  Nombre 🅰: text-[15px] font-semibold leading-tight truncate
  Nombre 🅱: font-display text-base leading-tight line-clamp-2
  Código: text-[13px] text-texto-suave tabular-nums truncate
  Fila precio/estado: flex items-center justify-between gap-2
  Precio 🅰: text-base font-bold tabular-nums
  Precio 🅱: font-display italic text-lg tabular-nums

Prenda · grilla (vidriera)
🅰 group flex flex-col gap-2.5 rounded-3xl bg-glass backdrop-blur-md border border-glass-borde shadow-glass p-2.5
🅱 group flex flex-col gap-2.5
  Foto: relative aspect-[4/5] overflow-hidden rounded-2xl bg-gris
  Banda de estado 🅱: absolute inset-x-2.5 bottom-2.5 rounded-[10px] py-2 text-center text-[13px] font-semibold

ActionCard
🅰 flex items-center gap-3 rounded-3xl bg-glass backdrop-blur-md border border-glass-borde shadow-glass p-4 min-h-[72px] active:scale-[.98] active:bg-white/90
🅱 flex items-center gap-3 rounded-[18px] bg-superficie-fuerte border border-borde p-4 min-h-[72px] active:bg-superficie-suave
  Ícono 🅰: grid size-11 shrink-0 place-items-center rounded-full bg-rosa/70 text-texto
  Ícono 🅱: grid size-11 shrink-0 place-items-center rounded-full bg-rosa text-texto
  Texto: min-w-0 flex-1
  Título 🅰: font-display text-lg leading-tight truncate
  Título 🅱: font-display italic text-lg leading-tight truncate
  Descripción: text-[13px] text-texto-suave line-clamp-2
  Chevron 🅱: size-5 shrink-0 text-texto-suave

Toolbar o banda de acciones
🅰 sticky top-[56px] z-20 -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-2.5 bg-white/70 backdrop-blur-md border-b border-white/60 [scrollbar-width:none] md:top-[64px]
🅱 sticky top-[56px] z-20 -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-2.5 bg-superficie border-b border-borde [scrollbar-width:none] md:top-[64px]
```

### Badges

```txt
Base
inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap
Punto
size-1.5 rounded-full bg-current

En stock · Pagado · Disponible   → bg-ok-bg text-ok
Stock bajo · Reservada · vence hoy → bg-warn-bg text-warn
vencida                           → bg-warn text-white
Agotado                           → bg-bad-bg text-bad
Reservado                         → bg-arena text-texto
Para enviar · Consultar           → bg-rosa text-texto
Entregado                         → bg-neutro-bg text-neutro
Vendida (vidriera)                → bg-cacao text-crema
```

### Formularios

```txt
Campo (contenedor)
flex flex-col gap-1.5 min-w-0
Label
🅰 text-sm font-semibold text-texto
🅱 text-sm font-semibold text-texto   (encabezado de grupo: font-display italic text-[17px])
Ayuda
text-[13px] text-texto-suave
Error
flex items-center gap-1.5 text-[13px] font-medium text-bad

Input / Select / Date
🅰 min-h-11 w-full rounded-2xl border-[1.5px] border-borde-control bg-white/90 px-3.5 text-base text-texto placeholder:text-texto-suave hover:border-cacao focus-visible:outline-hidden focus-visible:border-cacao focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 focus-visible:ring-offset-superficie aria-[invalid=true]:border-bad aria-[invalid=true]:bg-bad-bg/40 disabled:bg-deshabilitado-bg disabled:border-transparent disabled:text-deshabilitado-texto [color-scheme:light] accent-cacao
🅱 min-h-11 w-full rounded-xl border-[1.5px] border-borde-control bg-superficie-fuerte px-3.5 text-base text-texto placeholder:text-texto-suave hover:border-cacao focus-visible:outline-hidden focus-visible:border-cacao focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 focus-visible:ring-offset-superficie aria-[invalid=true]:border-bad aria-[invalid=true]:bg-bad-bg/40 disabled:bg-deshabilitado-bg disabled:border-transparent disabled:text-deshabilitado-texto [color-scheme:light] accent-cacao

Textarea
(misma clase que el input) + min-h-24 py-2.5 resize-y

Checkbox (con label de 44 px)
Label: flex min-h-11 items-center gap-3 text-[15px] cursor-pointer
Input: size-5 shrink-0 rounded-[6px] border-[1.5px] border-borde-control accent-cacao focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2
```

### Chips, tabs y FAB

```txt
Chip de filtro (con aria-pressed)
🅰 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap bg-white/70 backdrop-blur-md border border-glass-borde text-texto aria-pressed:bg-cacao aria-pressed:text-crema aria-pressed:border-cacao focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2
🅱 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap bg-superficie-fuerte border-[1.5px] border-borde text-texto hover:border-cacao aria-pressed:bg-cacao aria-pressed:text-crema aria-pressed:border-cacao focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2
Chip quitable (filtro aplicado): inline-flex items-center gap-1 rounded-full bg-rosa pl-3 pr-1 text-[13px] font-semibold text-texto  ·  botón ×: grid size-8 place-items-center rounded-full hover:bg-white/60

Tabs segmentados
Contenedor 🅰: flex gap-1 rounded-2xl bg-white/50 backdrop-blur-md p-1
Contenedor 🅱: flex gap-1 rounded-xl bg-[#F1E6E1] p-1
Tab: min-h-10 flex-1 rounded-[10px] px-2 text-[13px] font-semibold text-texto-suave truncate aria-selected:bg-superficie-fuerte aria-selected:text-texto focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco
  🅰 activo: aria-selected:shadow-xs
  🅱 activo: aria-selected:ring-1 aria-selected:ring-borde

FAB
🅰 fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 inline-flex min-h-13 items-center gap-2 rounded-full bg-acento px-5 text-[15px] font-semibold text-texto-invertido shadow-levantar hover:bg-acento-hover active:scale-[.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 md:hidden
🅱 fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 inline-flex min-h-13 items-center gap-2 rounded-full bg-acento px-5 text-[15px] font-semibold text-texto-invertido shadow-fab hover:bg-acento-hover active:scale-[.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foco focus-visible:ring-offset-2 md:hidden
```

### KPI

```txt
Grilla: grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5
KPI 🅰: rounded-3xl bg-glass backdrop-blur-md border border-glass-borde shadow-glass p-4 min-w-0
KPI 🅱: rounded-[18px] bg-superficie-fuerte border border-borde p-4 min-w-0
  Etiqueta: text-[13px] text-texto-suave truncate
  Valor 🅰: mt-1.5 text-2xl md:text-3xl font-bold tabular-nums truncate
  Valor 🅱: mt-1.5 font-display text-[28px] md:text-[34px] leading-none tabular-nums truncate
  Valor de alerta: + text-acento
  Nota: mt-1 text-xs text-texto-suave truncate
```

### Kanban

```txt
Tablero: grid grid-cols-1 gap-4 md:grid-cols-4 md:items-start
Columna 🅰: flex min-w-0 flex-col gap-2.5 rounded-3xl p-3 backdrop-blur-sm data-[col=reservado]:bg-col-reservado/80 data-[col=pagado]:bg-col-pagado/80 data-[col=enviar]:bg-col-enviar/80 data-[col=entregado]:bg-col-entregado/80 data-[over=true]:ring-2 data-[over=true]:ring-inset data-[over=true]:ring-cacao/30
Columna 🅱: flex min-w-0 flex-col gap-2.5 rounded-[18px] p-3 data-[col=reservado]:bg-col-reservado data-[col=pagado]:bg-col-pagado data-[col=enviar]:bg-col-enviar data-[col=entregado]:bg-col-entregado data-[over=true]:ring-2 data-[over=true]:ring-inset data-[over=true]:ring-cacao/30
Encabezado de columna: flex items-center justify-between px-1 py-0.5 text-[15px] font-semibold text-texto
Tarjeta 🅰: flex flex-col gap-2 rounded-2xl bg-white/90 border border-white/70 p-3.5 cursor-grab transition-[transform,box-shadow] duration-150 data-[dragging=true]:shadow-levantar data-[dragging=true]:rotate-1 data-[dragging=true]:scale-[1.02] data-[dragging=true]:ring-2 data-[dragging=true]:ring-frutilla/40 data-[dragging=true]:cursor-grabbing
Tarjeta 🅱: flex flex-col gap-2 rounded-[14px] bg-superficie-fuerte border border-borde p-3.5 cursor-grab transition-[transform,box-shadow] duration-150 data-[dragging=true]:shadow-levantar data-[dragging=true]:rotate-1 data-[dragging=true]:scale-[1.02] data-[dragging=true]:ring-2 data-[dragging=true]:ring-frutilla/40 data-[dragging=true]:cursor-grabbing
  ID: text-xs text-texto-suave tabular-nums
  Canal: rounded-full bg-superficie-suave px-2.5 py-1 text-xs font-semibold
  Clienta: text-[15px] font-semibold truncate
  Ítems: text-sm line-clamp-2
  Pie: flex items-center justify-between gap-2 text-[13px] text-texto-suave
  Total: text-[15px] font-bold text-texto tabular-nums shrink-0
```

### Skeleton y spinner

```txt
Skeleton sobre crema: rounded-xl bg-skeleton motion-safe:animate-pulse motion-reduce:animate-none
Skeleton dentro de card: rounded-xl bg-[#F3E9E4] motion-safe:animate-pulse motion-reduce:animate-none
  Línea de texto: h-3.5 w-3/4 rounded-full
  Miniatura de prenda: h-20 w-16 rounded-[10px]
  KPI: h-[104px] rounded-3xl (🅱 rounded-[18px])
Spinner: inline-block size-5 rounded-full border-2 border-borde border-t-acento animate-spin
Spinner dentro del botón primario: inline-block size-4 rounded-full border-2 border-crema/30 border-t-crema animate-spin
```

### Títulos de página

```txt
h1 🅰: font-display text-[26px] md:text-[34px] leading-tight text-texto
h1 🅱: font-display italic text-[26px] md:text-[34px] leading-tight text-texto
Subtítulo: mt-1 text-sm text-texto-suave
Kicker: text-xs font-semibold uppercase tracking-[.14em] text-texto-suave
Precio destacado 🅱: font-display italic text-2xl tabular-nums
```

---

## 13. Orden de aplicación

### Paso 0 · Base global (una sola vez)
1. `app/fonts.ts` y `app/layout.tsx` (punto 11.2).
2. `globals.css`: tokens comunes más el bloque de **una** variante (1.2 + 1.3 o 1.4).
3. Buscar y reemplazar colores viejos: `#6d28d9` y `violet-*` → `primario`; `#dc2626` y `red-600` → `peligro`; grises de texto → `texto-suave`.
4. `lib/alerta.ts` (SweetAlert2) y reemplazar los `Swal.fire` sueltos por `alerta.fire` y `confirmarBorrado`.

### Paso 1 · Piloto `/ventas`
Usa casi todo: navbar, toolbar con chips, tabs segmentados en el celu, Kanban con arrastre, badges de pedido (incluidos vence hoy y vencida), FAB, BottomNav, bottom-sheet de nueva venta y Swal de confirmación.

Verificar:
- [ ] Todos los controles miden al menos 44 px: chips, tabs, tarjetas, ítems de la BottomNav e íconos del navbar.
- [ ] Ningún texto suave ni frutilla queda sobre la columna rosa "Para enviar".
- [ ] El badge **vencida** se lee (blanco sobre ámbar) y **vence hoy** se distingue de **Reservado**.
- [ ] Nombres de clienta y de prenda largos: `min-w-0` + `truncate` / `line-clamp-2`, sin romper la columna en 360 px.
- [ ] Mientras se arrastra, la tarjeta se levanta y la columna destino se marca; con `prefers-reduced-motion` no hay rotación.
- [ ] El foco con teclado se ve en chips, tarjetas y botones del Swal.
- [ ] El FAB no tapa la última tarjeta: agregar `pb-28` al contenedor de la página en el celu.
- [ ] Bottom-sheet: en iPhone se respeta el safe-area y el footer queda visible con el teclado abierto.
- [ ] Los errores del formulario de nueva venta llevan borde, fondo, ícono y texto `bad`, además de `aria-invalid`.

### Paso 2 · Panel o inicio
KPI cards, gráficos de Recharts y listas.
- [ ] Series en el orden del punto 8.
- [ ] Cacao y frutilla con separador blanco en barras apiladas.
- [ ] Valores largos (`$ 1.245.000`) que no desborden: `truncate` y `tabular-nums`.

### Paso 3 · Inventario de prendas
Card de prenda (lista y grilla) y badges de stock.
- [ ] Códigos alineados.
- [ ] Badges de 12 px legibles.
- [ ] Miniaturas con `bg-gris` mientras cargan.
- [ ] Skeletons con la misma forma que la card.

### Paso 4 · Formularios (alta y edición de prendas y cositas)
- [ ] Inputs de 16 px (sin zoom en iOS) y borde `borde-control`.
- [ ] Estados de error con mensaje asociado (`aria-describedby`).
- [ ] Date picker con `accent-cacao`.
- [ ] Footer de página pegajoso que no tape la BottomNav.

### Paso 5 · Clientas y reportes
- [ ] Tablas en Work Sans `tabular-nums` con scroll horizontal (`overflow-x-auto`) en el celu.
- [ ] Encabezados de tabla en 12 px suave.

### Paso 6 · Vidriera pública
Badges Disponible, Reservada, Vendida y Consultar, banda sobre la foto (🅱) y precios.
- [ ] 🅱 Precios en Fraunces itálica.
- [ ] Frutilla solo como acento sobre crema o blanco, nunca sobre rosa.

### Chequeo final en cada página
- [ ] 360 px de ancho sin scroll horizontal.
- [ ] Zoom al 200 % sin cortar textos.
- [ ] Contraste revisado con la tabla 1.1: si aparece un par que no está, se mide antes de usarlo.
- [ ] 🅰 Si el blur se pone lento en celulares de gama baja, cambiar `backdrop-blur-md` por `backdrop-blur-sm` en las listas largas. El blur queda solo en navbar, BottomNav y modales.
