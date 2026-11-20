// BRAND-PANEL.md §5 — tarjetas de métricas: borde 1px, número grande en
// Geist 500 de 32px, etiqueta mono gris arriba, sin íconos de colores.
// Listo para usarse, pero ninguna pantalla muestra métricas sueltas hoy —
// no se usa todavía, para no inventar un dashboard que nadie pidió.
export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-linea bg-superficie p-4">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-gris-texto">{label}</p>
      <p className="mt-2 text-[32px] font-medium leading-none text-tinta">{value}</p>
    </div>
  )
}
