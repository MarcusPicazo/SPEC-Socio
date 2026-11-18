/**
 * SocioLogo — logo oficial de Socio (símbolo "Marcador" + wordmark).
 *
 * Animación del header: cada `intervalMs` los puntos y las letras se apagan
 * en orden aleatorio, y luego el símbolo se vuelve a "marcar" punto por punto
 * en el orden en que se traza la S (el último punto, terracota, es la llamada
 * entrante) y el nombre se escribe letra por letra.
 *
 * Sin dependencias. Respeta `prefers-reduced-motion` y se pausa con la
 * pestaña oculta. Todo el texto va en trazos: no necesita la fuente cargada.
 *
 * Uso:
 *   <SocioLogo height={28} />                     // header claro
 *   <SocioLogo height={28} tone="dark" />         // header oscuro
 *   <SocioLogo height={40} wordmark={false} />    // solo símbolo
 *   <SocioLogo height={64} wordmark={false} matrix loop />  // cargador
 */
import { useEffect, useState, type CSSProperties } from "react";

export const SOCIO_COLORS = {
  papel: "#F3F1EC",
  tinta: "#151514",
  arena: "#BDB4A6",
  terracota: "#C4472A",
  apagado: "#DCD6CC",
  apagadoOscuro: "#3A3835",
} as const;

const GEO = {"W": 3218.2, "H": 866.2, "MARK_W": 507.8, "R": 74.7, "WORD_X": 749.2, "WORD_Y": 78.1} as const;
// Puntos encendidos en el orden en que se traza la S. El último es terracota.
const DOTS: [number, number][] = [[433.1, 74.7], [253.9, 74.7], [74.7, 74.7], [74.7, 253.9], [74.7, 433.1], [253.9, 433.1], [433.1, 433.1], [433.1, 612.3], [433.1, 791.5], [253.9, 791.5], [74.7, 791.5]];
// Puntos que nunca se encienden (solo visibles con `matrix`).
const OFF_DOTS: [number, number][] = [[253.9, 253.9], [433.1, 253.9], [74.7, 612.3], [253.9, 612.3]];
// Letras de "Socio" en Geist Medium, convertidas a trazos (cada una ya trae su posición).
const LETTERS: { d: string }[] = [
  {"d": "M342.0 726Q257.0 726 194.5 695.0Q132.0 664 96.0 609.0Q60.0 554 54.0 481L165.0 474Q175.0 548 219.5 588.0Q264.0 628 344.0 628Q413.0 628 451.0 602.0Q489.0 576 489.0 526Q489.0 496 474.5 472.5Q460.0 449 419.5 429.5Q379.0 410 301.0 391Q216.0 371 165.0 345.5Q114.0 320 91.5 282.5Q69.0 245 69.0 190Q69.0 129 98.5 82.5Q128.0 36 183.0 10.0Q238.0 -16 315.0 -16Q396.0 -16 454.0 14.0Q512.0 44 545.0 96.0Q578.0 148 586.0 215L475.0 221Q467.0 160 426.5 121.0Q386.0 82 313.0 82Q251.0 82 215.5 110.5Q180.0 139 180.0 186Q180.0 217 194.5 237.0Q209.0 257 246.5 272.5Q284.0 288 353.0 304Q445.0 325 499.0 355.5Q553.0 386 576.5 427.0Q600.0 468 600.0 520Q600.0 583 567.5 629.5Q535.0 676 477.0 701.0Q419.0 726 342.0 726Z"},
  {"d": "M903.0 722Q827.0 722 770.0 687.5Q713.0 653 682.0 591.0Q651.0 529 651.0 444Q651.0 359 682.0 297.0Q713.0 235 770.0 200.5Q827.0 166 903.0 166Q979.0 166 1036.0 200.5Q1093.0 235 1124.0 297.0Q1155.0 359 1155.0 444Q1155.0 529 1124.0 591.0Q1093.0 653 1036.0 687.5Q979.0 722 903.0 722ZM903.0 630Q971.0 630 1008.0 581.0Q1045.0 532 1045.0 444Q1045.0 357 1008.0 307.5Q971.0 258 903.0 258Q836.0 258 798.5 307.5Q761.0 357 761.0 444Q761.0 532 798.5 581.0Q836.0 630 903.0 630Z"},
  {"d": "M1446.0 722Q1370.0 722 1313.0 687.5Q1256.0 653 1225.0 590.5Q1194.0 528 1194.0 444Q1194.0 360 1225.0 297.5Q1256.0 235 1313.0 200.5Q1370.0 166 1446.0 166Q1543.0 166 1607.0 216.5Q1671.0 267 1684.0 359L1573.0 365Q1565.0 313 1531.0 285.5Q1497.0 258 1446.0 258Q1379.0 258 1341.5 307.5Q1304.0 357 1304.0 444Q1304.0 532 1341.5 581.0Q1379.0 630 1446.0 630Q1497.0 630 1531.0 601.5Q1565.0 573 1573.0 515L1684.0 521Q1671.0 613 1607.5 667.5Q1544.0 722 1446.0 722Z"},
  {"d": "M1745.0 710V178H1851.0V710ZM1743.0 101V-5H1853.0V101Z"},
  {"d": "M2175.0 722Q2099.0 722 2042.0 687.5Q1985.0 653 1954.0 591.0Q1923.0 529 1923.0 444Q1923.0 359 1954.0 297.0Q1985.0 235 2042.0 200.5Q2099.0 166 2175.0 166Q2251.0 166 2308.0 200.5Q2365.0 235 2396.0 297.0Q2427.0 359 2427.0 444Q2427.0 529 2396.0 591.0Q2365.0 653 2308.0 687.5Q2251.0 722 2175.0 722ZM2175.0 630Q2243.0 630 2280.0 581.0Q2317.0 532 2317.0 444Q2317.0 357 2280.0 307.5Q2243.0 258 2175.0 258Q2108.0 258 2070.5 307.5Q2033.0 357 2033.0 444Q2033.0 532 2070.5 581.0Q2108.0 630 2175.0 630Z"},
];

// Orden fijo (sin Math.random) para que el render del servidor y del cliente coincidan.
const DOT_OFF_DELAY = [0.28, 0.05, 0.4, 0.17, 0.5, 0.1, 0.33, 0.22, 0.45, 0.02, 0.36];
const LETTER_OFF_DELAY = [0.12, 0.42, 0.07, 0.3, 0.2];
const DOT_ON_STEP = 0.075; // s entre punto y punto al marcar
const LETTER_ON_START = 0.9; // s: las letras empiezan cuando termina la S
const LETTER_ON_STEP = 0.07;
const OFF_HOLD_MS = 1000; // cuánto dura todo apagado antes de volver a marcar

type Props = {
  /** Alto en px. El ancho sale solo. */
  height?: number;
  /** "light" = logo en tinta para fondos claros; "dark" = logo en papel para fondos oscuros. */
  tone?: "light" | "dark";
  /** Muestra el nombre junto al símbolo. */
  wordmark?: boolean;
  /** Dibuja los 4 puntos apagados de la matriz 3×5. */
  matrix?: boolean;
  /** Activa la animación. */
  animated?: boolean;
  /** Arranca apagado y se arma al montar (intro). Úsalo solo en apps de cliente (Vite/SPA). */
  intro?: boolean;
  /** Modo cargador: se marca y apaga sin pausa larga. */
  loop?: boolean;
  /** Tiempo con el logo completo entre una animación y la siguiente. */
  intervalMs?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SocioLogo({
  height = 28,
  tone = "light",
  wordmark = true,
  matrix = false,
  animated = true,
  intro = false,
  loop = false,
  intervalMs = 8000,
  className,
  style,
  title = "Socio",
}: Props) {
  const [lit, setLit] = useState<boolean>(() => !(animated && intro && !prefersReducedMotion()));

  useEffect(() => {
    if (!animated || prefersReducedMotion()) {
      setLit(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const holdOn = loop ? 1600 : intervalMs;
    const holdOff = loop ? 500 : OFF_HOLD_MS;

    const turnOn = () => {
      if (cancelled) return;
      setLit(true);
      timer = setTimeout(turnOff, holdOn);
    };
    const turnOff = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(turnOff, 1000); // pestaña oculta: espera sin animar
        return;
      }
      setLit(false);
      timer = setTimeout(turnOn, holdOff);
    };

    if (intro) {
      timer = setTimeout(turnOn, 150);
    } else {
      timer = setTimeout(turnOff, holdOn);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [animated, intro, loop, intervalMs]);

  const ink = tone === "dark" ? SOCIO_COLORS.papel : SOCIO_COLORS.tinta;
  const offColor = tone === "dark" ? SOCIO_COLORS.apagadoOscuro : SOCIO_COLORS.apagado;
  const vbW = wordmark ? GEO.W : GEO.MARK_W;
  const width = (height * vbW) / GEO.H;

  const fade = (on: boolean, onDelay: number, offDelay: number): CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity 0s linear ${on ? onDelay : offDelay}s`,
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vbW} ${GEO.H}`}
      width={width}
      height={height}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: "block", overflow: "visible", ...style }}
    >
      <title>{title}</title>
      {matrix &&
        OFF_DOTS.map(([cx, cy], i) => (
          <circle key={`o${i}`} cx={cx} cy={cy} r={GEO.R} fill={offColor} />
        ))}
      {DOTS.map(([cx, cy], i) => {
        const last = i === DOTS.length - 1;
        return (
          <g key={`d${i}`}>
            {matrix && <circle cx={cx} cy={cy} r={GEO.R} fill={offColor} />}
            <circle
              cx={cx}
              cy={cy}
              r={GEO.R}
              fill={last ? SOCIO_COLORS.terracota : ink}
              style={fade(lit, i * DOT_ON_STEP, DOT_OFF_DELAY[i] ?? 0)}
            />
          </g>
        );
      })}
      {wordmark &&
        LETTERS.map((l, i) => (
          <path
            key={`l${i}`}
            d={l.d}
            fill={ink}
            transform={`translate(${GEO.WORD_X} ${GEO.WORD_Y})`}
            style={fade(lit, LETTER_ON_START + i * LETTER_ON_STEP, LETTER_OFF_DELAY[i] ?? 0)}
          />
        ))}
    </svg>
  );
}

export default SocioLogo;
