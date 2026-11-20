import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, buttonClassName } from '../components/ui/Button'
import {
  CallStatusBadge,
  QuoteStatusBadge,
  SubscriptionStatusBadge,
  UrgencyBadge,
} from '../components/ui/Badge'
import { CallBubble } from '../components/ui/CallBubble'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, TableBody, TableHead, Td, Th, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { generateCheckoutLink, getBusiness, provisionBusiness } from '../lib/businesses'
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
  const { showToast } = useToast()
  const [business, setBusiness] = useState<Business | null>(null)
  const [calls, setCalls] = useState<CallWithCustomer[]>([])
  const [quotes, setQuotes] = useState<QuoteWithCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [checkoutLinkUrl, setCheckoutLinkUrl] = useState<string | null>(null)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)

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

  if (loading) return <div className="p-6 text-sm text-gris-texto">Cargando…</div>
  if (error) return <div className="p-6 text-sm text-error">{error}</div>
  if (!business) return null

  async function handleActivateLine(businessId: string) {
    setProvisioning(true)
    try {
      const result = await provisionBusiness(businessId)
      setBusiness((current) =>
        current ? { ...current, vapi_assistant_id: result.vapi_assistant_id } : current,
      )
      showToast('Línea activada.', 'exito')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo activar la línea.', 'error')
    } finally {
      setProvisioning(false)
    }
  }

  async function handleGenerateCheckoutLink(businessId: string) {
    setGeneratingLink(true)
    setCheckoutLinkUrl(null)
    try {
      const result = await generateCheckoutLink(businessId)
      setCheckoutLinkUrl(result.url)
      showToast(
        result.whatsapp_sent ? 'Link generado y enviado por WhatsApp.' : 'Link generado — cópialo a mano.',
        result.whatsapp_sent ? 'exito' : 'alerta',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo generar el link de pago.', 'error')
    } finally {
      setGeneratingLink(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 min-[900px]:p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-medium tracking-[-0.03em] text-tinta">{business.name}</h1>
          <p className="text-sm text-gris-texto">
            {business.trade} · {business.city}, {business.state} · {business.timezone}
          </p>
        </div>
        <Link to={`/admin/negocios/${business.id}/editar`} className={buttonClassName({ variant: 'secondary' })}>
          Editar
        </Link>
      </div>

      <Card title="Resumen">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gris-texto">Dueño</dt>
          <dd className="text-tinta">{business.owner_name}</dd>
          <dt className="text-gris-texto">WhatsApp del dueño</dt>
          <dd className="text-tinta">{business.owner_whatsapp}</dd>
          <dt className="text-gris-texto">Número de Twilio</dt>
          <dd className="text-tinta">{business.twilio_number ?? 'Sin asignar'}</dd>
          <dt className="text-gris-texto">Suscripción</dt>
          <dd>
            <SubscriptionStatusBadge
              status={business.subscription_status}
              label={SUBSCRIPTION_STATUS_LABELS[business.subscription_status]}
            />
          </dd>
          <dt className="text-gris-texto">Transferencia de emergencias</dt>
          <dd className="text-tinta">{business.emergency_transfer ? 'Sí' : 'No'}</dd>
        </dl>
      </Card>

      <Card title="Línea de voz (Vapi)">
        <p className="text-sm text-gris-texto">
          {business.vapi_assistant_id
            ? `Activada · asistente ${business.vapi_assistant_id}`
            : 'Todavía no se ha activado.'}
        </p>
        <Button
          variant="primary"
          className="mt-3"
          onClick={() => handleActivateLine(business.id)}
          disabled={provisioning || !business.twilio_number}
        >
          {provisioning ? 'Activando…' : business.vapi_assistant_id ? 'Reactivar línea' : 'Activar línea'}
        </Button>
        {!business.twilio_number && (
          <p className="mt-2 text-xs text-gris-texto">Asigna primero un número de Twilio desde Editar.</p>
        )}
      </Card>

      <Card title="Suscripción">
        <p className="text-sm text-gris-texto">
          {SUBSCRIPTION_STATUS_LABELS[business.subscription_status]}
          {business.subscription_status === 'trialing' && business.trial_ends_at
            ? ` · prueba hasta ${formatDateTime(business.trial_ends_at)}`
            : ''}
        </p>
        <Button
          variant="primary"
          className="mt-3"
          onClick={() => handleGenerateCheckoutLink(business.id)}
          disabled={generatingLink || business.subscription_status === 'active'}
        >
          {generatingLink ? 'Generando…' : 'Generar link de pago'}
        </Button>
        {checkoutLinkUrl && (
          <p className="mt-2 text-sm text-gris-texto">
            <a href={checkoutLinkUrl} target="_blank" rel="noreferrer" className="text-terracota-texto underline">
              {checkoutLinkUrl}
            </a>
          </p>
        )}
      </Card>

      <Card title="Servicios">
        {business.services.length === 0 ? (
          <EmptyState message="Sin servicios configurados." />
        ) : (
          <ul className="space-y-1 text-sm text-tinta">
            {business.services.map((service, i) => (
              <li key={i}>
                {service.name}: {formatMoney(service.price_min)} – {formatMoney(service.price_max)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Horario">
        <ul className="space-y-1 text-sm text-tinta">
          {DAYS_OF_WEEK.map((day) => {
            const dayHours = business.hours[day.key]
            return (
              <li key={day.key} className="flex justify-between">
                <span>{day.label}</span>
                <span className="text-gris-texto">
                  {dayHours ? `${dayHours.open} – ${dayHours.close}` : 'Cerrado'}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card title="Últimas llamadas">
        {calls.length === 0 ? (
          <EmptyState message="Todavía no hay llamadas." />
        ) : (
          <Table>
            <TableHead>
              <Th>Fecha</Th>
              <Th>Cliente</Th>
              <Th>Urgencia</Th>
              <Th>Estado</Th>
            </TableHead>
            <TableBody>
              {calls.map((call) => {
                const expanded = expandedCallId === call.id
                return (
                  <Fragment key={call.id}>
                    <Tr
                      selected={expanded}
                      onClick={() => setExpandedCallId(expanded ? null : call.id)}
                    >
                      <Td>{formatDateTime(call.created_at)}</Td>
                      <Td>{call.customer?.name ?? call.from_number ?? 'Desconocido'}</Td>
                      <Td>
                        <UrgencyBadge urgency={call.extracted?.urgency ?? null} />
                      </Td>
                      <Td>
                        <CallStatusBadge status={call.status} label={CALL_STATUS_LABELS[call.status]} />
                      </Td>
                    </Tr>
                    {expanded && (
                      <tr className="border-t border-linea bg-papel">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="space-y-3">
                            <CallBubble speaker="socio">{call.summary_es ?? 'Sin resumen.'}</CallBubble>
                            {call.transcript && (
                              <p className="whitespace-pre-wrap text-sm text-gris-texto">{call.transcript}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card title="Últimas cotizaciones">
        {quotes.length === 0 ? (
          <EmptyState message="Todavía no hay cotizaciones." />
        ) : (
          <Table>
            <TableHead>
              <Th>Número</Th>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th align="right">Total</Th>
            </TableHead>
            <TableBody>
              {quotes.map((quote) => (
                <Tr key={quote.id}>
                  <Td>{quote.number}</Td>
                  <Td>{quote.customer?.name ?? '—'}</Td>
                  <Td>
                    <QuoteStatusBadge status={quote.status} label={QUOTE_STATUS_LABELS[quote.status]} />
                  </Td>
                  <Td numeric>{formatMoney(quote.total, quote.currency)}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
