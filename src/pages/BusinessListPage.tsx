import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonClassName } from '../components/ui/Button'
import { Badge, SubscriptionStatusBadge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, TableBody, TableHead, Td, Th, Tr } from '../components/ui/Table'
import { listBusinesses } from '../lib/businesses'
import { getCallCountsLast7Days } from '../lib/calls'
import { SUBSCRIPTION_STATUS_LABELS } from '../lib/format'
import { listUsagePeriods } from '../lib/usage'
import { latestPeriodByBusiness, needsTrialDecision, summarizeUsage } from '../lib/usage-summary'
import type { Business, UsagePeriod } from '../types'

export function BusinessListPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [callCounts, setCallCounts] = useState<Record<string, number>>({})
  const [latestPeriods, setLatestPeriods] = useState<Record<string, UsagePeriod>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listBusinesses(), getCallCountsLast7Days(), listUsagePeriods()])
      .then(([businessRows, counts, periodRows]) => {
        if (!active) return
        setBusinesses(businessRows)
        setCallCounts(counts)
        setLatestPeriods(latestPeriodByBusiness(periodRows))
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

      {!loading && !error && businesses.some(needsTrialDecision) && (
        <div className="mt-6 border border-alerta bg-alerta-bg p-4 text-sm text-tinta">
          <p className="font-medium">⚠️ Necesitan tu decisión (llegaron al tope de 150 minutos de prueba):</p>
          <ul className="mt-2 list-disc pl-5">
            {businesses.filter(needsTrialDecision).map((business) => (
              <li key={business.id}>
                <Link to={`/admin/negocios/${business.id}`} className="underline">
                  {business.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              <Th>Minutos</Th>
              <Th align="right">Llamadas (7 días)</Th>
            </TableHead>
            <TableBody>
              {businesses.map((business) => {
                const usage = summarizeUsage(business, latestPeriods[business.id] ?? null)
                return (
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
                    <Td>
                      <span className="mr-2">
                        {usage.usedMinutes} / {usage.includedMinutes}
                      </span>
                      {needsTrialDecision(business) ? (
                        <Badge variant="error">Decidir</Badge>
                      ) : usage.level !== 'normal' ? (
                        <Badge variant={usage.level === 'tope' ? 'error' : 'alerta'}>{usage.percent} %</Badge>
                      ) : null}
                    </Td>
                    <Td numeric>{callCounts[business.id] ?? 0}</Td>
                  </Tr>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
