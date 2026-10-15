# Change: HU6 - Generar PDF de etiquetas para productos (diseño específico de código, precio y identificador)

## Contexto
- Productos tienen: `code` (HU2, formato AAA000), `name`, `price` (HU1 base de venta), `stock`
- Necesidad: Imprimir **etiquetas adhesivas** para pegar en productos físicos (ej: en estantes o góndola) con un diseño de marca **exactamente especificado**.
- Cada etiqueta debe contener **solo tres elementos**:
  1. **Código del producto** (HU2)
  2. **Precio de venta** (HU1, precio base del producto)
  3. **Identificador del negocio**: `@feria_conexx` (como se especifica en los diseños de referencia)
- **NO incluye** el nombre del negocio completo ni otros datos (stock, descripción, etc.) — solo estos tres elementos por etiqueta.
- Dimensiones de etiqueta: **22 mm de alto × 28 mm de ancho**
- Diseño de hoja A4 (210 mm × 297 mm, orientation **portrait**):
  - Etiquetas distribuidas en una **cuadrícula optimizada** que maximiza el uso del espacio:
    - Columnas = floor(210 mm / 28 mm) = **7**
    - Filas por columna = floor(297 mm / 22 mm) = **13**
    - Etiquetas por hoja A4 = 7 × 13 = **91**
  - Si el total de etiquetas solicitadas supera 91, se generan **hojas adicionales A4** siguiendo el mismo patrón (lleno columna por columna: llenar cada columna de arriba a abajo antes de pasar a la siguiente).
- El usuario debe poder:
  - Seleccionar uno o más productos (usando buscador por código/nombre, reutilizando lógica de HU3/HU8)
  - Para cada producto seleccionado: ingresar **cantidad de etiquetas a imprimir** (input number, mínimo 1)
  - Ejecutar acción: **"Generar PDF de etiquetas"**
  - Recibir un archivo PDF listo para imprimir en hojas autoadhesivas estándar (o papel común para corte manual)

## Requerimiento Detallado de Diseño (por etiqueta)
Cada etiqueta individual debe renderizarse **exactamente** así:

### Fondo general
- **Color de fondo de toda la etiqueta**: `#fcd2d3` (rosa muy claro)

### Primer rectángulo (superior) — **CONTIENE EL CÓDIGO DEL PRODUCTO**
- **Forma**: Rectángulo con bordes circulares (radio de esquinas: **2mm**)
- **Posición**: 
  - Distancia desde el borde superior de la etiqueta: **1 mm**
  - Altura: **6 mm**
  - Ancho: **22 mm** (ocupa todo el ancho interno de la etiqueta, centrado horizontalmente)
- **Color**: `#ffeff3` (rosa casi blanco)
- **Borde**: Ninguno (solo color de fondo)
- **Contenido**: 
  - Texto: `product.code` (valor exacto del campo `code`, ej: "AA001", "PROD000")
  - Fuente: **Legible sans-serif** (ej: Inter, Helvetica, Arial — no especificado, pero debe ser claro y profesional)
  - Tamaño de fuente: Ajustado para ser legible pero sin tocar los bordes (ej: 8-10pt)
  - Color: Negro (`#000000`) o color oscuro que contraste con `#ffeff3`
  - Alineación: **Centrado tanto horizontal como verticalmente** dentro del rectángulo

### Separación
- **Espacio vertical** entre el primer y segundo rectángulo: **1 mm**

### Segundo rectángulo (inferior) — **CONTIENE EL PRECIO**
- **Forma**: Rectángulo con bordes circulares (radio de esquinas: **2mm**)
- **Posición**:
  - Inicia **1 mm** después del final del primer rectángulo (es decir, comienza en `1mm + 6mm + 1mm = 8 mm` desde el borde superior)
  - Altura: **11 mm**
  - Ancho: **22 mm** (ocupa todo el ancho interno de la etiqueta, centrado horizontalmente)
- **Color**: `#ffeff3`
- **Borde**: Ninguno (solo color de fondo)
- **Contenido** (alineado a la izquierda, con pequeño margen interno):
  - En el **margen izquierdo interno** (aprox. 2 mm desde el borde izquierdo del rectángulo):
    - Símbolo **'$'** (signo de peso)
    - Fuente: **'Shrikhand'** (Google Font — **obligatorio para este símbolo**)
    - Tamaño de fuente: Suficiente para ser legible pero sin superar el alto del rectángulo (ej: 8pt)
    - Color: Negro (`#000000`) o color oscuro que contraste con `#ffeff3`
  - Inmediatamente a la derecha del '$' (con un pequeño espacio, ej: 0.5mm):
    - **Precio de venta formateado** (ej: "$ 1.234,56" para ARS, usando `toLocaleString` con `es-AR` y moneda `ARS`)
    - Fuente: **Legible sans-serif** (misma familia que el código, pero puede ser ligeramente más pequeño si el $ es grande)
    - Tamaño de fuente: Ajustado para alineación vertical con el '$'
    - Color: Negro (`#000000`)
  - **Alineación vertical**: Ambos elementos ('$' y precio) deben estar **centrados verticalmente** dentro del rectángulo de 11mm de altura.
  - **Alineación horizontal**: El bloque completo (`$` + precio) está **alinearado a la izquierda** con un pequeño margen interno (ej: 2mm) desde el borde izquierdo del rectángulo.

### Texto inferior (cerca del borde inferior) — **IDENTIFICADOR DEL NEGOCIO**
- **Ubicación**: 
  - Distancia desde el borde inferior de la etiqueta: **1 mm** (es decir, el texto está posicionado de manera que su borde inferior más bajo está a 1mm del borde inferior del borde inferior de la etiqueta)
  - Altura del texto: se ajusta para quedar dentro del espacio restante (≈2mm disponibles, pero el tamaño de fuente se define por legibilidad)
  - Ancho: centrado horizontalmente (ocupa casi todo el ancho, con pequeños márgenes laterales para evitar tocar bordes)
- **Contenido**: 
  - Texto exacto: **`@feria_conexx`**
  - Fuente: **'Shrikhand'** (Google Font — **obligatorio**)
  - Tamaño de fuente: Lo suficientemente grande para ser legible pero sin tocar los bordes superior o inferior (ej: 7-8pt)
  - Color: Negro (`#000000`) o color oscuro que contraste con `#fcd2d3`
  - Alineación: **Centrado horizontalmente**

## Requerimiento de Funcionalidad
Crear una funcionalidad de **"Generar PDF de etiquetas"** que:
1. **Permita al usuario seleccionar productos y cantidades**:
   - Desde una pantalla (Productos o Inventario): 
     - Abrir un modal al hacer clic en botón "Imprimir Etiquetas"
     - Modal contiene:
       - Buscador de productos (reutiliza lógica de `searchProducts` de HU3/HU8, modo modal o inline)
       - Para cada producto seleccionado en el buscador: 
         - Fila con: [Nombre del producto] + [Input qty: number, min=1, placeholder="Cant."] + [Btn eliminar (✕)]
       - Botón generar PDF: "Descargar Etiquetas PDF" (deshabilitado si no hay productos seleccionados)
       - Mensaje dinámico: "Se generarán [N] etiquetas en [P] hoja(s) A4" (actualizado en tiempo real)
   - Al seleccionar producto + ingresar qty: se agrega a lista de "etiquetas a imprimir"
   - Al eliminar producto de la lista: se retira de la cuenta total
2. **Genere un PDF con**:
   - Diseño de hoja A4 optimizado para maximizar cantidad de etiquetas (calcular dinámicamente filas/columnas según 22x28mm)
   - Cada etiqueta cumple **exactamente** el diseño de capas, colores, fuentes y dimensiones descrito arriba
   - Etiquetas distribuidas en orden de **selección del usuario** (si selecciona Producto A qty=2 luego Producto B qty=1 → orden: A, A, B)
   - Manejo de edge cases:
     - Cantidad 0 o negativa → validar y impedir generación (mostrar error: "La cantidad debe ser al menos 1")
     - Producto sin código o precio → impedir selección en buscador (mostrar tooltip: "Producto no tiene código/precio asignado")
     - Si el total de etiquetas excede una hoja: generar múltiples páginas A4 (continuar en hoja siguiente con mismo diseño)
   - **No incluye** stock, descripciones ni otros datos — solo los tres elementos especificados por etiqueta
3. **Tecnología recomendada**:
   - Usar **pdf-lib** (ligero, permite posicionamiento preciso en mm/puntos y embebido de fuentes TTF como Shrikhand)
   - Evitar dependencias pesadas (jspdf+autoTable es sobrekill para este caso de texto y formas simples)
   - Generar PDF en **Server Action** (no en cliente) para evitar exponer lógica sensible y asegurar consistencia

## Criterios de aceptación
### UI/UX
1. Botón "Imprimir Etiquetas" visible en header de:
   - Página **Productos** (`/productos`)
   - Página **Inventario** (`/inventario`)
2. Al hacer clic en el botón:
   - Se abre un modal con:
     - Buscador de productos (idéntico al usado en ventas/inventario de HU3/HU8)
     - Lista de productos seleccionados con inputs de cantidad (mínimo 1)
     - Botón "Descargar Etiquetas PDF" (habilitado solo si hay ≥1 producto seleccionado con qty ≥1)
   - Mensaje dinámico actualizado: "Se generarán [N] etiquetas en [P] hoja(s) A4"
3. PDF Generado:
   - Cada etiqueta cumple **exactamente** el diseño descrito (colores, posiciones, fuentes, dimensiones)
   - Fondo de cada etiqueta: `#fcd2d3`
   - Primer rectángulo (código): 
     - Color `#ffeff3`, radio 2mm, posición top=1mm, height=6mm
     - Contenido: `product.code` centrado, fuente sans-serif legible
   - Segundo rectángulo (precio):
     - Color `#ffeff3`, radio 2mm, position top=8mm, height=11mm
     - Contenido: 
       - '$' en Shrikhand font (izquierda, alineado verticalmente)
       - Precio formateado (sin $, ej: "1234.56") en sans-serif legible (misma familia que código)
       - Ambos elementos centrados verticalmente, bloque left-aligned con 2mm padding izquierdo
   - Texto inferior:
     - Texto exacto: `@feria_conexx`
     - Fuente: Shrikhand, color negro
     - Posicionado 1mm arriba del borde inferior, centrado horizontalmente
   - Distribución de etiquetas:
     - Llenado por **columnas** (llena cada columna de arriba a abajo antes de pasar a la siguiente)
     - Ejemplo: 92 etiquetas → hoja 1: 91 etiquetas (7 cols × 13 filas), hoja 2: 1 etiqueta (posición top-left de nueva hoja)
   - Si se solicitan N etiquetas, el PDF tiene exactamente ⌈N / 91⌉ páginas A4
4. Tests:
   - Unit: `label-print.test.ts` (verifica diseño de una etiqueta: colores exactas, posiciones en mm, fuentes usadas)
   - Integration: `label-action.test.ts` (llama a action, verifica que el blob sea un PDF válido con estructura esperada)
   - E2E: Simular selección de 2 productos (Producto A qty=2, Producto B qty=1) → verificar PDF descargado tiene 3 etiquetas con:
     - Etiqueta 1: código=A, precio=precio_A, @feria_conexx
     - Etiqueta 2: código=A, precio=precio_A, @feria_conexx
     - Etiqueta 3: código=B, precio=precio_B, @feria_conexx
     - Todas con diseño exacto según specs

## Archivos a modificar/crear
| Archivo | Acción |
|---------|--------|
| `src/actions/label-print.ts` | **Nuevo**: Server Action `generateProductLabels(selection: { productId: string, quantity: number }[] ) → Promise<Blob>` |
| `src/app/productos/page.tsx` | Agregar botón "Imprimir Etiquetas" en header + abrir selector modal |
| `src/app/inventario/page.tsx` | Idem en inventario |
| `src/components/ui/LabelSelector.tsx` | **Nuevo**: modal con:<br>- Buscador productos (reutiliza `searchProducts`)<br>- Lista seleccionados: [Producto] + [Input qty] + [Btn eliminar]<br>- Botón "Descargar Etiquetas PDF"<br>- Mensaje dinámico de totales |
| `src/lib/label-layout.ts` | **Nuevo**: funciones puras para:<br>- `calculateLabelsPerSheet(): number` (devuelve 91)<br>- `generateLabelPositions(totalLabels: number): Array<{x: number, y: number}>` (coordenadas en mm de la esquina superior izquierda de cada etiqueta, orden por columnas)<br>- `renderLabelContent(product: Product, businessName: string): LabelInstructions` (instrucciones para dibujar una etiqueta: código, precio, @feria_conexx con posiciones exactas, fuentes, colores) |
| `src/lib/utils/business-name.ts` (opcional) | Función para obtener `BUSINESS_NAME` desde `.env` (ej: `process.env.BUSINESS_NAME ?? "Mi Comercio"`) — **pero nota**: en este caso específico, el identificador es fijo `@feria_conexx`, así que quizá no se necesite. Se mantiene por si en futuro se quiere cambiar. |
| `package.json` | Agregar dependencia: `pdf-lib` (versión estable) |
| Tests: | `label-print.test.ts`, `label-action.test.ts`, e2e-label-print.flow.tsx |

## Notas técnicas críticas
- **¿Por qué pdf-lib?** 
  - Permite posicionamiento preciso en puntos (pt) y embebido de fuentes TTF (Shrikhand) sin depender de HTML/CSS.
  - Más ligero que jspdf+autoTable para este caso (solo texto y rectángulos simples).
  - Ejemplo de uso en código:
    ```ts
    import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
    import { readFile } from 'fs/promises'
    import { join } from 'path'

    // Convertir mm a puntos (1 mm = 2.83464567 pt)
    const mmToPt = (mm: number) => mm * 2.83464567

    const pdf = await PDFDocument.create()
    const page = pdf.addPage([mmToPt(210), mmToPt(297770)]) // A4 portrait (210x297 mm) → puntos
    const shrikhandFontBytes = await readFile(join(process.cwd(), 'src', 'lib', 'fonts', 'Shrikhand-Regular.ttf'))
    const shrikhandFont = await pdf.embedFont(shrikhandFontBytes)
    const sansFont = await pdf.embedFont(StandardFonts.Helvetica) // para código y precio

    // Dibujar una etiqueta en posición (x_mm, y_mm) desde esquina superior izquierda
    const drawLabel = async (x_mm: number, y_mm: number, product: Product) => {
      const x_pt = mmToPt(x_mm)
      const y_pt = mmToPt(y_mm)

      // Fondo etiqueta
      page.drawRectangle({
        x: x_pt,
        y: y_pt,
        width: mmToPt(28),
        height: mmToPt(22),
        color: rgb(0.988, 0.827, 0.827) // #fcd2d3
      })

      // Primer rectángulo (código)
      page.drawRectangle({
        x: x_pt + mmToPt(1),
        y: y_pt + mmToPt(1),
        width: mmToPt(28),
        height: mmToPt(6),
        color: rgb(1.0, 0.941, 0.949) // #ffeff3
      })
      // ... dibujar código centrado aquí ...

      // Segundo rectángulo (precio)
      page.drawRectangle({
        x: x_pt + mmToPt(1),
        y: y_pt + mmToPt(1 + 6 + 1), // top = 1+6+1 = 8mm
        width: mmToPt(28),
        height: mmToPt(11),
        color: rgb(1.0, 0.941, 0.949) // #ffeff3
      })
      // ... dibujar $ en Shrikhand y precio en sans-serif aquí ...

      // Texto inferior (@feria_conexx)
      // Posicionar de manera que su baseline esté a 1mm del fondo:
      // y_base_pt = mmToPt(22 - 1) = mmToPt(21) desde la parte superior de la etiqueta
      // pero en coordenadas de página: y_page_pt = y_pt + mmToPt(21)
      // ... dibujar texto centrado aquí ...
    }
    ```
- **Orden de llenado por columnas**: 
  - Como especificaste: "se deben apilar una arriba de la otra y luego horizontalmente". 
  - Esto se interpreta como **llenar cada columna completamente de arriba a abajo antes de pasar a la siguiente columna** (top-to-bottom, luego left-to-right).
  - Ejemplo para primeras 3 etiquetas en una hoja vacía:
    - Etiqueta 1: columna 0, fila 0 (top-left)
    - Etiqueta 2: columna 0, fila 1 (directamente debajo de la 1)
    - ...
    - Etiqueta 13: columna 0, fila 12 (última fila de columna 0)
    - Etiqueta 14: columna 1, fila 0 (top of segunda columna)
- **Nombre del negocio / identificador**:
  - En este caso específico, el identificador es **fijo**: `@feria_conexx` (no se toma de `.env` ni de config — es parte del diseño de marca solicitado).
  - Si en futuro quieren cambiarlo, sería un ajuste simples en `label-layout.ts`.
- **Fuente Shrikhand**: 
  - Descargar el archivo TTF desde Google Fonts: https://fonts.google.com/specimen/Shrikhand
  - Guardarlo en `src/lib/fonts/Shrikhand-Regular.ttf`
  - En el Server Action, leer el archivo como `Buffer` y embeberlo en el PDF:
    ```ts
    const shrikhandFontBytes = await readFile(
      join(process.cwd(), 'src', 'lib', 'fonts', 'Shrikhand-Regular.ttf')
    )
    const shrikhandFont = await pdf.embedFont(shrikhandFontBytes)
    ```
  - Luego usar `shrikhandFont` para dibujar el `$` y `@feria_conexx`.
- **Precio formateado**: 
  - Ejemplo para ARS: 
    ```ts
    const formattedPrice = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(Number(product.price)) // ej: "$ 1.234,56"
    ```
  - Asegurar que `product.price` se convierta a número (Prisma devuelve Decimal como string o objeto)
  - El formato dará algo como "$ 1.234,56" — el espacio después del $ es estándar en es-AR.
  - En el diseño, el '$' se dibuja en Shrikhand, y el número "1.234,56" se dibuja en sans-serif a su derecha.
- **Stock no involucrado**: 
  - No se verifica ni descuenta stock al imprimir etiquetas (es solo para identificación física).
  - Si en futuro se quiere vincular a control de impresión, se puede agregar campo `labelPrintCount` en Product (pero no ahora).
- **Seguridad**: 
  - No exponer IDs internos ni datos sensibles (solo code, name via búsqueda previa, price).
  - Validar que `selection` no esté vacío antes de generar.
  - Usar `try/catch` para manejar errores de generación de PDF y devolver mensaje amigable al usuario.

