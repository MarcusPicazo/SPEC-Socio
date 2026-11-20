import { SocioLogo } from '../brand/SocioLogo'
import { Button } from './Button'

// BRAND-PANEL.md §5 — estados vacíos: el símbolo del logo en matrix
// estático y gris, una frase corta y un botón. Sin ilustraciones.
//
// SocioLogo no tiene un modo "apagado" propio (sin redibujarlo, per
// BRAND-PANEL.md §2 — "No lo redibujes") — con animated={false} se
// renderiza encendido. El gris estático se logra por fuera, con un filtro
// de CSS (grayscale + opacidad), sin tocar el componente.
export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 border border-linea bg-superficie px-6 py-12 text-center">
      <div className="opacity-30 grayscale">
        <SocioLogo height={32} wordmark={false} matrix animated={false} />
      </div>
      <p className="text-sm text-gris-texto">{message}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" dense onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
