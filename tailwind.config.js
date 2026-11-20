/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // BRAND-PANEL.md §3 — tokens de la identidad del panel.
        papel: '#F3F1EC',
        superficie: '#FBFAF7',
        tinta: '#151514',
        'tinta-hover': '#2A2926',
        arena: '#BDB4A6',
        linea: '#DCD6CC',
        'gris-texto': '#6B655C',
        'apagado-oscuro': '#3A3835',
        terracota: '#C4472A',
        'terracota-texto': '#A83A20',
        exito: '#2E6B47',
        'exito-bg': '#E3EDE5',
        alerta: '#8A5A0B',
        'alerta-bg': '#F3E9D2',
        error: '#A1261B',
        'error-bg': '#F5E1DD',
        info: '#2F5A8A',
        'info-bg': '#E1E8F1',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        badge: '2px',
      },
      spacing: {
        sidebar: '240px',
      },
      transitionDuration: {
        DEFAULT: '120ms',
      },
    },
  },
  plugins: [],
}
