import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function RequireOperator({ children }: { children: ReactNode }) {
  const { loading, user, isOperator } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-6 text-sm text-gris-texto">Cargando…</div>
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  if (!isOperator) {
    return (
      <div className="p-6">
        <h1 className="text-[18px] font-medium text-error">Sin acceso</h1>
        <p className="mt-2 text-sm text-gris-texto">
          Esta cuenta ({user.email}) no tiene permiso de operador. Pide que te agreguen a la
          tabla{' '}
          <code className="border border-linea bg-superficie px-1 font-mono text-[13px]">
            operators
          </code>
          .
        </p>
      </div>
    )
  }

  return <>{children}</>
}
