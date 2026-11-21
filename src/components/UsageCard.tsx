import { useState } from 'react'
import { Badge, type BadgeVariant } from './ui/Badge'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { useToast } from './ui/Toast'
import { formatDate, formatDateTime, formatMoney, USAGE_EVENT_LABELS, USAGE_KIND_LABELS } from '../lib/format'
import { endTrialAsOperator, letTrialContinue } from '../lib/usage'
import { needsTrialDecision, summarizeUsage, trialDaysLeft, type UsageLevel } from '../lib/usage-summary'
import type { Business, Event, UsagePeriod } from '../types'

const OVERAGE_PRICE_PER_MINUTE_USD = 0.25

const LEVEL_BADGE: Record<UsageLevel, { variant: BadgeVariant; label: string }> = {
  normal: { variant: 'exito', label: 'Normal' },
  alerta: { variant: 'alerta', label: '80 % o más' },
  tope: { variant: 'error', label: 'Tope alcanzado' },
}

function eventDetail(event: Event): string {
  const p = event.payload
  if (event.type === 'billing.end_trial_attempt') return `${String(p.source ?? '')} → ${String(p.outcome ?? '')}`
  const parts: string[] = []
  if (typeof p.used_minutes === 'number') parts.push(`${p.used_minutes} min`)
  if (p.whatsapp_sent === false) parts.push('WhatsApp NO enviado')
  if (typeof p.error === 'string') parts.push(p.error)
  return parts.join(' · ')
}

export function UsageCard({
  business,
  latestPeriod,
  events,
  onBusinessChange,
}: {
  business: Business
  latestPeriod: UsagePeriod | null
  events: Event[]
  onBusinessChange: (patch: Partial<Business>) => void
}) {
  const { showToast } = useToast()
  const [deciding, setDeciding] = useState(false)
  const summary = summarizeUsage(business, latestPeriod)
  const badge = LEVEL_BADGE[summary.level]
  const daysLeft = trialDaysLeft(business.trial_ends_at)

  async function handleEndTrial() {
    if (!window.confirm(`¿Terminar la prueba de ${business.name} y cobrar $199 USD hoy?`)) return
    setDeciding(true)
    try {
      const result = await endTrialAsOperator(business.id)
      onBusinessChange({
        subscription_status: 'active',
        trial_cap_status: 'operator_ended_trial',
        billing_period_start: result.billing_period_start,
        billing_period_end: result.next_charge_at,
      })
      showToast(
        result.whatsapp_sent
          ? 'Cobrado. El dueño ya recibió la confirmación por WhatsApp.'
          : 'Cobrado, pero no se pudo avisar al dueño por WhatsApp (ventana de 24 h cerrada). Avísale tú.',
        result.whatsapp_sent ? 'exito' : 'alerta',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo terminar la prueba.', 'error')
    } finally {
      setDeciding(false)
    }
  }

  async function handleContinue() {
    setDeciding(true)
    try {
      await letTrialContinue(business.id)
      onBusinessChange({ trial_cap_status: 'operator_continue' })
      showToast('Listo: la prueba sigue hasta el día 15, sin cortar la línea.', 'exito')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo guardar la decisión.', 'error')
    } finally {
      setDeciding(false)
    }
  }

  return (
    <Card title="Minutos de llamada">
      <div className="flex items-baseline justify-between">
        <p className="text-[32px] font-medium leading-none text-tinta">
          {summary.usedMinutes}
          <span className="text-base text-gris-texto"> / {summary.includedMinutes} min</span>
        </p>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-gris-texto">Ciclo</dt>
        <dd className="text-tinta">
          {USAGE_KIND_LABELS[summary.kind]}
          {summary.kind === 'paid' &&
            ` · ${formatDate(business.billing_period_start)} – ${formatDate(business.billing_period_end)}`}
        </dd>
        {summary.kind === 'trial' && (
          <>
            <dt className="text-gris-texto">Días de prueba</dt>
            <dd className="text-tinta">
              {daysLeft === null
                ? 'Empiezan al pagar el link (14 días)'
                : `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} · hasta ${formatDate(business.trial_ends_at)}`}
            </dd>
          </>
        )}
        {summary.overageMinutes > 0 && summary.kind === 'paid' && (
          <>
            <dt className="text-gris-texto">Minutos extra</dt>
            <dd className="text-tinta">
              {summary.overageMinutes} · {formatMoney(summary.overageMinutes * OVERAGE_PRICE_PER_MINUTE_USD)} (aún no se
              cobran)
            </dd>
          </>
        )}
      </dl>

      {needsTrialDecision(business) && (
        <div className="mt-4 border border-alerta bg-alerta-bg p-3 text-sm text-tinta">
          <p className="font-medium">⚠️ Llegó al tope de la prueba. Decide tú.</p>
          <p className="mt-1 text-gris-texto">
            El dueño ya tiene el botón "Empezar mi plan hoy". La línea sigue funcionando.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleEndTrial} disabled={deciding}>
              Terminar prueba y cobrar hoy
            </Button>
            <Button variant="secondary" onClick={handleContinue} disabled={deciding}>
              Dejar seguir hasta el día 15
            </Button>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-linea pt-3 text-xs text-gris-texto">
          {events.map((event) => (
            <li key={event.id}>
              {formatDateTime(event.created_at)} · {USAGE_EVENT_LABELS[event.type] ?? event.type}
              {eventDetail(event) && ` · ${eventDetail(event)}`}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
