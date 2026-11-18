import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

// BRAND-PANEL.md §5 — avisos tipo toast: abajo a la derecha, fondo tinta,
// texto papel, punto de 6px del color del estado. Se cierran solos en 5s;
// los de error no se cierran solos. Reemplaza los avisos de resultado que
// hoy quedan como texto suelto bajo un botón (ver Partes 4/5) — los
// errores de validación de un campo se quedan en línea, como pide §5 para
// inputs, esos no pasan por aquí.
export type ToastVariant = 'exito' | 'alerta' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DOT_CLASSES: Record<ToastVariant, string> = {
  exito: 'bg-exito',
  alerta: 'bg-alerta',
  error: 'bg-error',
  info: 'bg-info',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, variant }])
      if (variant !== 'error') {
        setTimeout(() => dismiss(id), 5000)
      }
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className="flex items-center gap-2 bg-tinta px-4 py-3 text-sm text-papel"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[toast.variant]}`}
              aria-hidden="true"
            />
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="ml-2 font-mono text-xs uppercase tracking-[0.08em] text-papel/70 hover:text-papel"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>.')
  return ctx
}
