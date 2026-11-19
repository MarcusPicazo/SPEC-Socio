import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonClassName } from '../components/ui/Button'
import { SubscriptionStatusBadge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, TableBody, TableHead, Td, Th, Tr } from '../components/ui/Table'
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
    <div className="p-6 min-[900px]:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-medium tracking-[-0.03em] text-tinta">Negocios</h1>
        <Link to="/admin/negocios/nuevo" className={buttonClassName({ variant: 'primary' })}>
          + Nuevo negocio
        </Link>
      </div>

      {loading && <p className="mt-6 text-sm text-gris-texto">Cargando…</p>}
      {error && <p className="mt-6 text-sm text-error">{error}</p>}

      {!loading && !error && businesses.length === 0 && (
        <div className="mt-6">
          <EmptyState message="Todavía no hay negocios dados de alta." />
        </div>
      )}

      {!loading && !error && businesses.length > 0 && (
        <div className="mt-6">
          <Table>
            <TableHead>
              <Th>Nombre</Th>
              <Th>Ciudad</Th>
              <Th>Suscripción</Th>
              <Th align="right">Llamadas (7 días)</Th>
            </TableHead>
            <TableBody>
              {businesses.map((business) => (
                <Tr key={business.id}>
                  <Td>
                    <Link to={`/admin/negocios/${business.id}`} className="text-tinta hover:underline">
                      {business.name}
                    </Link>
                  </Td>
                  <Td>
                    {business.city}, {business.state}
                  </Td>
                  <Td>
                    <SubscriptionStatusBadge
                      status={business.subscription_status}
                      label={SUBSCRIPTION_STATUS_LABELS[business.subscription_status]}
                    />
                  </Td>
                  <Td numeric>{callCounts[business.id] ?? 0}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
