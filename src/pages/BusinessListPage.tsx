import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listBusinesses } from '../lib/businesses'
import { getCallCountsLast7Days } from '../lib/calls'
import { SUBSCRIPTION_STATUS_LABELS } from '../lib/format'
import type { Business } from '../types'

export function BusinessListPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [callCounts, setCallCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listBusinesses(), getCallCountsLast7Days()])
      .then(([businessRows, counts]) => {
        if (!active) return
        setBusinesses(businessRows)
        setCallCounts(counts)
        setError(null)
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar los negocios.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Negocios</h1>
        <Link
          to="/admin/negocios/nuevo"
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Nuevo negocio
        </Link>
      </div>

      {loading && <p className="mt-6 text-gray-500">Cargando…</p>}
      {error && <p className="mt-6 text-red-600">{error}</p>}

      {!loading && !error && businesses.length === 0 && (
        <p className="mt-6 text-gray-500">Todavía no hay negocios dados de alta.</p>
      )}

      {!loading && !error && businesses.length > 0 && (
        <div className="mt-6 overflow-hidden rounded border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Ciudad</th>
                <th className="px-4 py-2 font-medium">Suscripción</th>
                <th className="px-4 py-2 font-medium">Llamadas (7 días)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {businesses.map((business) => (
                <tr key={business.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/negocios/${business.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {business.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {business.city}, {business.state}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {SUBSCRIPTION_STATUS_LABELS[business.subscription_status]}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{callCounts[business.id] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
