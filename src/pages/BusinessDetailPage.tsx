import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBusiness } from '../lib/businesses'
import { listRecentCallsForBusiness, type CallWithCustomer } from '../lib/calls'
import {
  CALL_STATUS_LABELS,
  formatDateTime,
  formatMoney,
  QUOTE_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '../lib/format'
import { DAYS_OF_WEEK } from '../lib/validation/business'
import { listRecentQuotesForBusiness, type QuoteWithCustomer } from '../lib/quotes'
import type { Business } from '../types'

export function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [business, setBusiness] = useState<Business | null>(null)
  const [calls, setCalls] = useState<CallWithCustomer[]>([])
  const [quotes, setQuotes] = useState<QuoteWithCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    Promise.all([
      getBusiness(id),
      listRecentCallsForBusiness(id),
      listRecentQuotesForBusiness(id),
    ])
      .then(([businessRow, callRows, quoteRows]) => {
        if (!active) return
        setBusiness(businessRow)
        setCalls(callRows)
        setQuotes(quoteRows)
        setError(null)
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el negocio.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  if (loading) return <div className="p-6 text-gray-500">Cargando…</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!business) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{business.name}</h1>
          <p className="text-sm text-gray-500">
            {business.trade} · {business.city}, {business.state} · {business.timezone}
          </p>
        </div>
        <Link
          to={`/admin/negocios/${business.id}/editar`}
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Editar
        </Link>
      </div>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Resumen
        </h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-400">Dueño</dt>
          <dd className="text-gray-700">{business.owner_name}</dd>
          <dt className="text-gray-400">WhatsApp del dueño</dt>
          <dd className="text-gray-700">{business.owner_whatsapp}</dd>
          <dt className="text-gray-400">Número de Twilio</dt>
          <dd className="text-gray-700">{business.twilio_number ?? 'Sin asignar'}</dd>
          <dt className="text-gray-400">Suscripción</dt>
          <dd className="text-gray-700">{SUBSCRIPTION_STATUS_LABELS[business.subscription_status]}</dd>
          <dt className="text-gray-400">Transferencia de emergencias</dt>
          <dd className="text-gray-700">{business.emergency_transfer ? 'Sí' : 'No'}</dd>
        </dl>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Servicios
        </h2>
        {business.services.length === 0 ? (
          <p className="text-sm text-gray-500">Sin servicios configurados.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {business.services.map((service, i) => (
              <li key={i}>
                {service.name}: {formatMoney(service.price_min)} – {formatMoney(service.price_max)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Horario
        </h2>
        <ul className="space-y-1 text-sm text-gray-700">
          {DAYS_OF_WEEK.map((day) => {
            const dayHours = business.hours[day.key]
            return (
              <li key={day.key} className="flex justify-between">
                <span>{day.label}</span>
                <span className="text-gray-500">
                  {dayHours ? `${dayHours.open} – ${dayHours.close}` : 'Cerrado'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Últimas llamadas
        </h2>
        {calls.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay llamadas.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-gray-400">
              <tr>
                <th className="py-1 font-medium">Fecha</th>
                <th className="py-1 font-medium">Cliente</th>
                <th className="py-1 font-medium">Resumen</th>
                <th className="py-1 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((call) => (
                <tr key={call.id}>
                  <td className="py-2 text-gray-600">{formatDateTime(call.created_at)}</td>
                  <td className="py-2 text-gray-700">
                    {call.customer?.name ?? call.from_number ?? 'Desconocido'}
                  </td>
                  <td className="py-2 text-gray-600">{call.summary_es ?? '—'}</td>
                  <td className="py-2 text-gray-600">{CALL_STATUS_LABELS[call.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Últimas cotizaciones
        </h2>
        {quotes.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay cotizaciones.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-gray-400">
              <tr>
                <th className="py-1 font-medium">Número</th>
                <th className="py-1 font-medium">Cliente</th>
                <th className="py-1 font-medium">Estado</th>
                <th className="py-1 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td className="py-2 text-gray-600">{quote.number}</td>
                  <td className="py-2 text-gray-700">{quote.customer?.name ?? '—'}</td>
                  <td className="py-2 text-gray-600">{QUOTE_STATUS_LABELS[quote.status]}</td>
                  <td className="py-2 text-gray-600">{formatMoney(quote.total, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
