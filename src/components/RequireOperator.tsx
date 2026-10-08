import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function RequireOperator({ children }: { children: ReactNode }) {
  const { loading, user, isOperator } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando…</div>
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  if (!isOperator) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-red-700">Sin acceso</h1>
        <p className="mt-2 text-gray-600">
          Esta cuenta ({user.email}) no tiene permiso de operador. Pide que te agreguen a la
          tabla <code className="rounded bg-gray-100 px-1">operators</code>.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
