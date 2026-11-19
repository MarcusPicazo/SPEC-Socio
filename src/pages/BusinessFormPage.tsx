import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input, inputClassName } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { createBusiness, getBusiness, updateBusiness } from '../lib/businesses'
import { formatDateTime, SUBSCRIPTION_STATUS_LABELS } from '../lib/format'
import {
  businessFormSchema,
  DAYS_OF_WEEK,
  emptyBusinessFormValues,
  toBusinessInput,
  US_TIMEZONES,
  type BusinessFormValues,
} from '../lib/validation/business'
import type { Business } from '../types'

function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {}
  for (const issue of error.issues) {
    map[issue.path.join('.')] = issue.message
  }
  return map
}

export function BusinessFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()

  const [values, setValues] = useState<BusinessFormValues>(emptyBusinessFormValues())
  const [systemInfo, setSystemInfo] = useState<Business | null>(null)
  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    getBusiness(id)
      .then((business) => {
        if (!active) return
        setSystemInfo(business)
        setValues({
          name: business.name,
          trade: business.trade,
          city: business.city,
          state: business.state,
          timezone: business.timezone,
          owner_name: business.owner_name,
          owner_whatsapp: business.owner_whatsapp,
          twilio_number: business.twilio_number ?? '',
          emergency_transfer: business.emergency_transfer,
          services:
            business.services.length > 0
              ? business.services
              : [{ name: '', price_min: 0, price_max: 0 }],
          hours: business.hours,
        })
      })
      .catch(() => {
        if (active) setLoadError('No se pudo cargar el negocio.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  function updateService(index: number, patch: Partial<BusinessFormValues['services'][number]>) {
    setValues((prev) => ({
      ...prev,
      services: prev.services.map((service, i) => (i === index ? { ...service, ...patch } : service)),
    }))
  }

  function addService() {
    setValues((prev) => ({
      ...prev,
      services: [...prev.services, { name: '', price_min: 0, price_max: 0 }],
    }))
  }

  function removeService(index: number) {
    setValues((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }))
  }

  function setDayOpen(dayKey: string, open: boolean) {
    setValues((prev) => ({
      ...prev,
      hours: {
        ...prev.hours,
        [dayKey]: open ? { open: '08:00', close: '17:00' } : null,
      },
    }))
  }

  function setDayTime(dayKey: string, field: 'open' | 'close', time: string) {
    setValues((prev) => {
      const current = prev.hours[dayKey]
      if (!current) return prev
      return { ...prev, hours: { ...prev.hours, [dayKey]: { ...current, [field]: time } } }
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = businessFormSchema.safeParse(values)
    if (!result.success) {
      setErrors(flattenZodErrors(result.error))
      setSaveError('Revisa los campos marcados.')
      return
    }
    setErrors({})
    setSaveError(null)
    setSaving(true)
    try {
      const input = toBusinessInput(result.data)
      const business =
        isEditing && id ? await updateBusiness(id, input) : await createBusiness(input)
      navigate(`/admin/negocios/${business.id}`)
    } catch {
      setSaveError('No se pudo guardar el negocio. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gris-texto">Cargando…</div>
  if (loadError) return <div className="p-6 text-sm text-error">{loadError}</div>

  const hasHoursError = Object.keys(errors).some((key) => key.startsWith('hours'))

  return (
    <div className="mx-auto max-w-2xl p-6 min-[900px]:p-8">
      <h1 className="text-[28px] font-medium tracking-[-0.03em] text-tinta">
        {isEditing ? 'Editar negocio' : 'Nuevo negocio'}
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card title="Datos generales">
          <div className="space-y-3">
            <Input
              label="Nombre del negocio"
              name="name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              error={errors.name}
            />
            <Input
              label="Giro (ej. techado, jardinería)"
              name="trade"
              value={values.trade}
              onChange={(e) => setValues((v) => ({ ...v, trade: e.target.value }))}
              error={errors.trade}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Ciudad"
                name="city"
                value={values.city}
                onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
                error={errors.city}
              />
              <Input
                label="Estado"
                name="state"
                placeholder="TX"
                value={values.state}
                onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))}
                error={errors.state}
              />
            </div>
            <Select
              label="Zona horaria"
              name="timezone"
              value={values.timezone}
              onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}
              error={errors.timezone}
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card title="Dueño">
          <div className="space-y-3">
            <Input
              label="Nombre del dueño"
              name="owner_name"
              value={values.owner_name}
              onChange={(e) => setValues((v) => ({ ...v, owner_name: e.target.value }))}
              error={errors.owner_name}
            />
            <Input
              label="WhatsApp del dueño (formato internacional)"
              name="owner_whatsapp"
              placeholder="+17135550123"
              value={values.owner_whatsapp}
              onChange={(e) => setValues((v) => ({ ...v, owner_whatsapp: e.target.value }))}
              error={errors.owner_whatsapp}
            />
          </div>
        </Card>

        <Card title="Teléfono y emergencias">
          <div className="space-y-3">
            <Input
              label="Número de Twilio asignado (opcional por ahora)"
              name="twilio_number"
              placeholder="+17135550199"
              value={values.twilio_number}
              onChange={(e) => setValues((v) => ({ ...v, twilio_number: e.target.value }))}
              error={errors.twilio_number}
            />
            <label className="flex items-center gap-2 text-sm text-tinta">
              <input
                type="checkbox"
                checked={values.emergency_transfer}
                onChange={(e) => setValues((v) => ({ ...v, emergency_transfer: e.target.checked }))}
              />
              Transferir emergencias al celular del dueño
            </label>
          </div>
        </Card>

        <Card title="Servicios y rangos de precio">
          <div className="space-y-2">
            {values.services.map((service, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    value={service.name}
                    onChange={(e) => updateService(index, { name: e.target.value })}
                    placeholder="Nombre del servicio"
                    className={inputClassName(errors[`services.${index}.name`])}
                  />
                  {errors[`services.${index}.name`] && (
                    <p className="mt-1 text-[13px] text-error">{errors[`services.${index}.name`]}</p>
                  )}
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min={0}
                    value={service.price_min}
                    onChange={(e) => updateService(index, { price_min: Number(e.target.value) })}
                    placeholder="Mínimo"
                    className={inputClassName(errors[`services.${index}.price_min`])}
                  />
                  {errors[`services.${index}.price_min`] && (
                    <p className="mt-1 text-[13px] text-error">
                      {errors[`services.${index}.price_min`]}
                    </p>
                  )}
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min={0}
                    value={service.price_max}
                    onChange={(e) => updateService(index, { price_max: Number(e.target.value) })}
                    placeholder="Máximo"
                    className={inputClassName(errors[`services.${index}.price_max`])}
                  />
                  {errors[`services.${index}.price_max`] && (
                    <p className="mt-1 text-[13px] text-error">
                      {errors[`services.${index}.price_max`]}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeService(index)}
                  disabled={values.services.length === 1}
                  className="h-10"
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
          {errors.services && <p className="mt-2 text-sm text-error">{errors.services}</p>}
          <Button type="button" variant="ghost" onClick={addService} className="mt-3">
            + Agregar servicio
          </Button>
        </Card>

        <Card title="Horario">
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const dayHours = values.hours[day.key]
              const open = dayHours !== null && dayHours !== undefined
              return (
                <div key={day.key} className="flex items-center gap-3 text-sm text-tinta">
                  <label className="flex w-32 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={open}
                      onChange={(e) => setDayOpen(day.key, e.target.checked)}
                    />
                    {day.label}
                  </label>
                  {open && dayHours && (
                    <>
                      <input
                        type="time"
                        value={dayHours.open}
                        onChange={(e) => setDayTime(day.key, 'open', e.target.value)}
                        className={inputClassName(undefined, 'h-9 w-auto')}
                      />
                      <span className="text-gris-texto">a</span>
                      <input
                        type="time"
                        value={dayHours.close}
                        onChange={(e) => setDayTime(day.key, 'close', e.target.value)}
                        className={inputClassName(undefined, 'h-9 w-auto')}
                      />
                    </>
                  )}
                  {!open && <span className="text-gris-texto">Cerrado</span>}
                </div>
              )
            })}
          </div>
          {hasHoursError && (
            <p className="mt-2 text-sm text-error">Revisa el formato de los horarios (HH:MM).</p>
          )}
        </Card>

        {isEditing && systemInfo && (
          <Card title="Estado del sistema (no editable aquí)">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-gris-texto">Suscripción</dt>
              <dd className="text-tinta">{SUBSCRIPTION_STATUS_LABELS[systemInfo.subscription_status]}</dd>
              <dt className="text-gris-texto">Fin de prueba</dt>
              <dd className="text-tinta">{formatDateTime(systemInfo.trial_ends_at)}</dd>
              <dt className="text-gris-texto">Asistente de Vapi</dt>
              <dd className="text-tinta">{systemInfo.vapi_assistant_id ?? 'Sin activar'}</dd>
            </dl>
          </Card>
        )}

        {saveError && <p className="text-sm text-error">{saveError}</p>}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
