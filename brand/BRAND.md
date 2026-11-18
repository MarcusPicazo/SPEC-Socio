# Socio — Identidad de marca v1

> Guía para construir la página y cualquier pieza de Socio. Si trabajas con Claude Code, ponle este archivo y dile: "sigue BRAND.md al pie de la letra".

**Qué es Socio:** una recepcionista bilingüe con IA para negocios latinos de servicios en EE. UU. Contesta las llamadas que el dueño no alcanza a tomar, en inglés o en español, y le manda el resumen por WhatsApp.

**Cómo se siente la marca:** sobria, precisa y cálida. Hay mucho aire, la geometría es exacta y el movimiento siempre comunica algo. Seria como una herramienta para empresas y cercana como un socio de confianza.

---

## 1. El logo: "Marcador"

Es una matriz de puntos de 3 × 5, como un teclado de teléfono o una pantalla LED, con una **S** trazada en 11 puntos. El último punto, abajo a la izquierda, va en **terracota**: es la llamada entrante y el sello de la marca.

```
● ● ●
● · ·
● ● ●
· · ●
◉ ● ●      ◉ = terracota (siempre el último punto del trazo)
```

**Construcción** (en unidades del SVG): paso entre centros de **18**, radio de **7.5**. El símbolo mide 51 × 87.
**Orden del trazo** al animarlo: arriba a la derecha → arriba a la izquierda → baja por la izquierda → cruza por el centro → baja por la derecha → abajo a la izquierda (el punto terracota).

### Versiones

| Archivo | Cuándo usarlo |
|---|---|
| `svg/socio-logo.svg` | Logo principal sobre fondos claros |
| `svg/socio-logo-blanco.svg` | Sobre tinta o sobre fotos oscuras |
| `svg/socio-logo-negro.svg` | Impresión a una sola tinta (el punto terracota también va en negro) |
| `svg/socio-logo-sobre-papel.svg` / `-sobre-tinta.svg` | Con fondo y margen ya incluidos, para redes y presentaciones |
| `svg/socio-simbolo*.svg` | Solo el símbolo: avatar, sello o esquina de una pieza |
| `svg/socio-simbolo-matriz*.svg` | Símbolo con los 4 puntos apagados. Solo para tamaños grandes o piezas decorativas |
| `svg/socio-wordmark.svg` | Solo el nombre (casi nunca se necesita) |
| `favicon/*`, `svg/socio-icono-*.svg` | Favicon e íconos de app: cuadro tinta con puntos en papel |

Todo el texto del logo está **convertido a trazos**: no depende de que la fuente esté cargada.

### Reglas

- **Margen de respeto:** deja libre alrededor del logo al menos la altura de una "S" del nombre.
- **Tamaño mínimo:** el logo horizontal, 20 px de alto. El símbolo solo, 24 px. A 16 px, únicamente como favicon (dentro del cuadro tinta).
- **No hagas esto:** mover el punto terracota a otra posición, poner más de un punto terracota, rotar o inclinar el logo, ponerle sombras, contornos o degradados, cambiar la tipografía del nombre, o pintar el símbolo entero de terracota.

---

## 2. Color

| Nombre | Hex | Uso |
|---|---|---|
| **Papel** | `#F3F1EC` | Fondo principal. Nunca uses blanco puro de fondo |
| **Tinta** | `#151514` | Texto, logo, botones principales y secciones oscuras |
| **Arena** | `#BDB4A6` | Planos de apoyo, partes de diagramas, divisores marcados |
| **Terracota** | `#C4472A` | El punto del logo, indicadores en vivo y detalles gráficos. **No para texto chico** |
| **Terracota texto** | `#A83A20` | Cuando el acento tenga que ser texto o un botón con texto (contraste de 5.6:1 sobre papel) |
| **Gris texto** | `#6B655C` | Etiquetas y texto secundario (contraste de 5.1:1 sobre papel) |
| **Línea** | `#DCD6CC` | Líneas de 1 px de la cuadrícula y bordes |
| **Apagado oscuro** | `#3A3835` | Puntos apagados y líneas cuando el fondo es tinta |

Contrastes: tinta sobre papel da 16.2:1; tinta sobre arena, 8.9:1; terracota sobre papel, 4.3:1, así que sirve para gráficos y texto de 24 px o más, pero no para texto chico.

**Proporción aproximada:** 70 % papel, 25 % tinta, 4 % arena y 1 % terracota. El terracota funciona porque casi no aparece.

```css
:root {
  --papel: #F3F1EC;
  --tinta: #151514;
  --arena: #BDB4A6;
  --terracota: #C4472A;
  --terracota-texto: #A83A20;
  --gris-texto: #6B655C;
  --linea: #DCD6CC;
  --apagado-oscuro: #3A3835;
}
```

---

## 3. Tipografía

- **Geist**, en 500 para títulos y 400 para texto. En títulos grandes usa `letter-spacing: -0.045em` y `line-height: 1`. El texto normal va con su tracking natural y `line-height: 1.45`.
- **Geist Mono**, en 400 o 500, para etiquetas, menú, botones y datos. Siempre en **MAYÚSCULAS**, con `letter-spacing: 0.08em` y entre 12 y 13 px.

Cómo instalarlas: `npm i geist` (paquete oficial de Vercel), o usa los `.woff2` de la carpeta `fonts/` (licencia OFL incluida).

**Escala sugerida para la web:** hero de 72 a 96 px, títulos de sección de 48 a 56 px, subtítulos de 24 px, texto de 18 a 20 px y etiquetas de 12 a 13 px.

---

## 4. Movimiento

**La animación del logo en el header** viene en `react/SocioLogo.tsx`:

1. Pasan **8 segundos** con el logo completo.
2. Los puntos y las letras se apagan en **orden aleatorio**.
3. Hay **1 segundo** con todo apagado.
4. La S se vuelve a **marcar punto por punto** en el orden del trazo, a 75 ms entre punto y punto. El terracota se enciende al final.
5. El nombre se **escribe letra por letra**, a 70 ms entre letra y letra.

**Principios:**
- Los encendidos y apagados son por pasos, sin desvanecidos. Así se siente como una pantalla LED.
- Los diagramas se arman ligados al scroll.
- Si el usuario tiene activada la reducción de movimiento (`prefers-reduced-motion`), todo se queda quieto.
- La animación se pausa cuando la pestaña está oculta.

---

## 5. Elementos del sistema (para la web)

- **El diagrama Prisma:** un rombo en cuatro partes con el centro en terracota, que se arma con el scroll. Cada parte es un paso del producto: **Llamada → Agente bilingüe → Resumen → WhatsApp**. Las partes van en tinta, arena, tinta y solo línea punteada.
- **Cuadrícula de líneas de 1 px** (`--linea`) detrás del hero, con celdas que muestran fotos reales de techadores, plomeros y oficinas de servicio.
- **Botones:** rectangulares, sin esquinas redondeadas. Fondo tinta, texto papel en Geist Mono en mayúsculas, con flecha: `AGENDA UNA DEMO →`.
- **Franja de anuncio** en tinta arriba del menú, en Geist Mono.
- Nada de degradados, emojis, sombras suaves ni tarjetas redondeadas genéricas.

---

## 6. Cómo meterlo al proyecto

```
public/brand/        ← todo svg/ y png/
public/              ← favicon.ico, favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png
src/components/SocioLogo.tsx
src/fonts/           ← los .woff2 (o usa el paquete npm geist)
```

Pega esto en el `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#151514">
```

Y el logo en el header:

```tsx
import { SocioLogo } from "@/components/SocioLogo";

<SocioLogo height={28} />                  {/* header claro, se anima solo */}
<SocioLogo height={28} tone="dark" />      {/* sobre fondo tinta */}
<SocioLogo height={64} wordmark={false} matrix loop />  {/* cargador */}
```
