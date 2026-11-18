# Socio — Identidad visual para el panel (SPEC-Socio)

> Para Claude Code en el repo `SPEC-Socio`. Explica cómo se ve el panel interno (`/admin`) y cualquier pantalla de la app. Es la misma marca que el sitio público (`socio-web`), ajustada a una herramienta de trabajo: más densa, más clara y sin animaciones de adorno.
>
> **Esto solo toca lo visual.** No cambia datos, rutas, Edge Functions ni lógica. Si algo de aquí choca con SPEC.md o CLAUDE.md del repo, manda SPEC.md, y hay que avisarle a Marcus.

---

## 1. La marca en una frase

Sobria, precisa y cálida: fondo hueso, tinta casi negra, mucho aire y geometría exacta. **El terracota es un acento chiquito, nunca un color de relleno.**

## 2. Logo

- **Componente:** `brand/react/SocioLogo.tsx` (va en este paquete). Cópialo tal cual a `src/components/brand/SocioLogo.tsx`. **No lo redibujes.**
- **Qué es:** una matriz de puntos de 3 × 5 que forma una "S", con el último punto en terracota, más el nombre "Socio" en Geist.
- **En el panel**, úsalo **estático**: `<SocioLogo height={22} animated={false} />` en la barra lateral o superior. La animación es solo para el sitio público y para el cargador.
- **Cargador** (pantallas que esperan datos más de ~400 ms): `<SocioLogo height={40} wordmark={false} matrix loop />`.
- **Favicons:** copia `brand/favicon/*` a `public/` y referencia `favicon.ico`, `favicon.svg` y `apple-touch-icon.png` en `index.html`, con `<meta name="theme-color" content="#151514">`.

## 3. Color

### Base

| Token | Hex | Uso |
|---|---|---|
| `--papel` | `#F3F1EC` | Fondo de la app |
| `--superficie` | `#FBFAF7` | Tarjetas, tablas, modales, inputs |
| `--tinta` | `#151514` | Texto, íconos, botón principal, barra lateral |
| `--arena` | `#BDB4A6` | Fondos de apoyo, filas seleccionadas, gráficas neutras |
| `--linea` | `#DCD6CC` | Bordes de 1 px y separadores |
| `--gris-texto` | `#6B655C` | Texto secundario, etiquetas, placeholders (5.1:1 sobre papel) |
| `--apagado-oscuro` | `#3A3835` | Líneas y texto secundario sobre tinta |

### Acento: terracota (regla estricta)

| Token | Hex | Uso |
|---|---|---|
| `--terracota` | `#C4472A` | **Solo detalles pequeños:** el punto del logo, puntos de estado "en vivo", el indicador de la pestaña activa (barra de 2 px), el contorno de foco |
| `--terracota-texto` | `#A83A20` | Texto con acento, solo si hace falta (5.6:1 sobre papel) |

**El terracota nunca va** en botones, fondos de sección, encabezados de tabla ni bandas grandes. Si dudas, usa tinta.

### Estados (solo panel)

Cada estado tiene un color de texto o ícono y un fondo suave para etiquetas y avisos. Todos pasan contraste AA con texto tinta encima del fondo suave, y con su propio color sobre papel.

| Estado | Texto / ícono | Fondo suave | Cuándo |
|---|---|---|---|
| Éxito | `#2E6B47` | `#E3EDE5` | Cotización aceptada, mensaje enviado, conexión OK |
| Alerta | `#8A5A0B` | `#F3E9D2` | Pendiente de aprobar, cerca del límite, plantilla en revisión |
| Error | `#A1261B` | `#F5E1DD` | Falló el envío, webhook con error, llamada sin procesar |
| Info | `#2F5A8A` | `#E1E8F1` | Avisos neutros, ayudas |

El **error** es un rojo más oscuro y más frío que el terracota, a propósito, para no confundir un error con la marca.

**Urgencia de llamadas:** la etiqueta "Urgente" va con el estilo de **Error**. "Normal" va en gris. Una emergencia transferida va como **Error** con el ícono de teléfono.

```css
:root {
  --papel: #F3F1EC;
  --superficie: #FBFAF7;
  --tinta: #151514;
  --arena: #BDB4A6;
  --linea: #DCD6CC;
  --gris-texto: #6B655C;
  --apagado-oscuro: #3A3835;
  --terracota: #C4472A;
  --terracota-texto: #A83A20;
  --exito: #2E6B47;   --exito-bg: #E3EDE5;
  --alerta: #8A5A0B;  --alerta-bg: #F3E9D2;
  --error: #A1261B;   --error-bg: #F5E1DD;
  --info: #2F5A8A;    --info-bg: #E1E8F1;
}
```

Expón estos tokens en la configuración de Tailwind que ya tenga el repo (`theme.extend.colors` en v3 o `@theme` en v4) con los mismos nombres: `bg-papel`, `text-tinta`, `border-linea`, `bg-error-bg`, etc. **No uses los colores por defecto de Tailwind** (`gray-*`, `red-*`, `blue-*`…) en ningún componente.

## 4. Tipografía

- **Geist** (texto y títulos) y **Geist Mono** (etiquetas, datos, botones). Instálalas con `npm i geist` o usa los `.woff2` de `brand/fonts/` con `@font-face` (incluye la licencia OFL).
- **Escala del panel** (más compacta que la del sitio):

| Uso | Estilo |
|---|---|
| Título de página | Geist 500, 28 px, tracking −0.03em |
| Título de sección o tarjeta | Geist 500, 18 px |
| Texto base | Geist 400, 14 px, line-height 1.5 |
| Texto de tabla | Geist 400, 14 px; números con `font-variant-numeric: tabular-nums` |
| Etiquetas, encabezados de tabla, botones | Geist Mono 500, 12 px, MAYÚSCULAS, tracking 0.08em |
| Datos técnicos (IDs, teléfonos, horas, montos) | Geist Mono 400, 13 px |

## 5. Componentes

**Reglas generales:** esquinas rectas (radio 0; máximo 2 px en burbujas de chat y etiquetas). Bordes de 1 px `--linea`. **Sin sombras** (salvo una sombra muy leve en menús desplegables y modales para separarlos del fondo). Sin degradados ni emojis.

- **Botón principal:** fondo tinta, texto papel, Geist Mono en mayúsculas, flecha `→` opcional. Hover: fondo `#2A2926`. Alto de 40 px (mínimo 36 px en tablas densas).
- **Botón secundario:** contorno de 1 px tinta, fondo transparente, texto tinta. Hover: fondo tinta y texto papel.
- **Botón destructivo:** contorno de 1 px `--error` y texto `--error`. Siempre pide confirmación.
- **Botón fantasma** (acciones en filas): solo texto mono gris, que se pone tinta en hover.
- **Inputs y selects:** fondo superficie, borde 1 px `--linea`, 40 px de alto, label visible arriba en mono gris de 12 px. Foco: contorno terracota de 2 px. Error: borde `--error` y mensaje debajo en `--error` de 13 px.
- **Tablas:** fondo superficie, encabezado en mono gris de 12 px sobre papel, filas de 48 px separadas por 1 px `--linea`. Hover: fondo `#F7F5F0`. Fila seleccionada: fondo arena al 30 %. Números a la derecha con tabular-nums.
- **Etiquetas de estado (badges):** fondo suave del estado, texto del estado, mono de 11 px en mayúsculas, radio de 2 px, con un punto de 6 px a la izquierda.
- **Tarjetas de métricas:** borde 1 px, número grande en Geist 500 de 32 px, etiqueta mono gris arriba. Sin íconos de colores.
- **Barra lateral:** fondo tinta, links papel al 70 %; el link activo va en papel al 100 % con una barra terracota de 2 px a la izquierda. El logo arriba en `tone="dark"`.
- **Vista de llamada o chat:** reutiliza el estilo de burbuja del sitio. Socio en superficie con borde de 1 px, el dueño en arena, radio de 2 px, hora en mono gris de 11 px.
- **Avisos tipo toast:** abajo a la derecha, fondo tinta, texto papel, con un punto de 6 px del color del estado. Se cierran solos en 5 s; los de error no se cierran solos.
- **Estados vacíos:** el símbolo del logo en `matrix` estático y gris, una frase corta y un botón. Sin ilustraciones.
- **Íconos:** de línea, con trazo de 1.5 px, en tinta o gris. Si el repo ya usa `lucide-react`, sigue con ese; si no, pregunta antes de agregar una librería.

## 6. Espaciado y layout

- Escala de 4 px: 4, 8, 12, 16, 24, 32, 48.
- Contenido con ancho máximo de 1280 px y padding de 24 px (32 px en escritorio).
- Barra lateral fija de 240 px en escritorio. En menos de 900 px se vuelve un menú que se abre con un botón.
- El panel debe funcionar en el celular de Marcus: tablas con scroll horizontal dentro de su caja y formularios de una columna.

## 7. Movimiento

- Solo **funcional**: el punto que late en estados "en vivo" y el cargador del logo.
- Transiciones de 120 ms en hover y foco. Sin rebotes ni entradas animadas de secciones.
- Con `prefers-reduced-motion`, nada se mueve.

## 8. Accesibilidad

Contraste AA en todo el texto. Foco visible (terracota de 2 px). `<button>` y `<a>` reales. `aria-label` en botones que solo tienen ícono. Labels en todos los inputs. El color nunca es la única señal: cada estado lleva también texto.

## 9. Idioma y tono

El panel es para el operador (Marcus), así que todo va en **español**. Frases cortas y verbos claros ("Dar de alta negocio", "Reenviar resumen"). Las fechas en formato `18 nov 2026, 10:42` y las horas en la zona del negocio.

## 10. Prohibido

Degradados. Sombras grandes. Radios grandes. Emojis. Colores por defecto de Tailwind. Terracota como relleno. Redibujar o recolorear el logo. Fotos de stock.
