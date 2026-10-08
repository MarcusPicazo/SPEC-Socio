import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
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

  if (loading) return <div className="p-6 text-gray-500">Cargando…</div>
  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>

  const hasHoursError = Object.keys(errors).some((key) => key.startsWith('hours'))

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-gray-900">
        {isEditing ? 'Editar negocio' : 'Nuevo negocio'}
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Section title="Datos generales">
          <Field label="Nombre del negocio" error={errors.name}>
            <input
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              className={inputClass(errors.name)}
            />
          </Field>
          <Field label="Giro (ej. techado, jardinería)" error={errors.trade}>
            <input
              value={values.trade}
              onChange={(e) => setValues((v) => ({ ...v, trade: e.target.value }))}
              className={inputClass(errors.trade)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ciudad" error={errors.city}>
              <input
                value={values.city}
                onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
                className={inputClass(errors.city)}
              />
            </Field>
            <Field label="Estado" error={errors.state}>
              <input
                value={values.state}
                onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))}
                placeholder="TX"
                className={inputClass(errors.state)}
              />
            </Field>
          </div>
          <Field label="Zona horaria" error={errors.timezone}>
            <select
              value={values.timezone}
              onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}
              className={inputClass(errors.timezone)}
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Dueño">
          <Field label="Nombre del dueño" error={errors.owner_name}>
            <input
              value={values.owner_name}
              onChange={(e) => setValues((v) => ({ ...v, owner_name: e.target.value }))}
              className={inputClass(errors.owner_name)}
            />
          </Field>
          <Field label="WhatsApp del dueño (formato internacional)" error={errors.owner_whatsapp}>
            <input
              value={values.owner_whatsapp}
              onChange={(e) => setValues((v) => ({ ...v, owner_whatsapp: e.target.value }))}
              placeholder="+17135550123"
              className={inputClass(errors.owner_whatsapp)}
            />
          </Field>
        </Section>

        <Section title="Teléfono y emergencias">
          <Field label="Número de Twilio asignado (opcional por ahora)" error={errors.twilio_number}>
            <input
              value={values.twilio_number}
              onChange={(e) => setValues((v) => ({ ...v, twilio_number: e.target.value }))}
              placeholder="+17135550199"
              className={inputClass(errors.twilio_number)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={values.emergency_transfer}
              onChange={(e) => setValues((v) => ({ ...v, emergency_transfer: e.target.checked }))}
            />
            Transferir emergencias al celular del dueño
          </label>
        </Section>

        <Section title="Servicios y rangos de precio">
          <div className="space-y-2">
            {values.services.map((service, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    value={service.name}
                    onChange={(e) => updateService(index, { name: e.target.value })}
                    placeholder="Nombre del servicio"
                    className={inputClass(errors[`services.${index}.name`])}
                  />
                  {errors[`services.${index}.name`] && (
                    <p className="mt-1 text-xs text-red-600">{errors[`services.${index}.name`]}</p>
                  )}
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min={0}
                    value={service.price_min}
                    onChange={(e) => updateService(index, { price_min: Number(e.target.value) })}
                    placeholder="Mínimo"
                    className={inputClass(errors[`services.${index}.price_min`])}
                  />
                  {errors[`services.${index}.price_min`] && (
                    <p className="mt-1 text-xs text-red-600">
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
                    className={inputClass(errors[`services.${index}.price_max`])}
                  />
                  {errors[`services.${index}.price_max`] && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors[`services.${index}.price_max`]}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeService(index)}
                  disabled={values.services.length === 1}
                  className="rounded border border-gray-300 px-2 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          {errors.services && <p className="mt-2 text-sm text-red-600">{errors.services}</p>}
          <button
            type="button"
            onClick={addService}
            className="mt-3 text-sm font-medium text-gray-700 hover:underline"
          >
            + Agregar servicio
          </button>
        </Section>

        <Section title="Horario">
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const dayHours = values.hours[day.key]
              const open = dayHours !== null && dayHours !== undefined
              return (
                <div key={day.key} className="flex items-center gap-3 text-sm">
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
                        className="rounded border border-gray-300 px-2 py-1"
                      />
                      <span className="text-gray-400">a</span>
                      <input
                        type="time"
                        value={dayHours.close}
                        onChange={(e) => setDayTime(day.key, 'close', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1"
                      />
                    </>
                  )}
                  {!open && <span className="text-gray-400">Cerrado</span>}
                </div>
              )
            })}
          </div>
          {hasHoursError && (
            <p className="mt-2 text-sm text-red-600">Revisa el formato de los horarios (HH:MM).</p>
          )}
        </Section>

        {isEditing && systemInfo && (
          <Section title="Estado del sistema (no editable aquí)">
            <dl className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <dt className="text-gray-400">Suscripción</dt>
              <dd>{SUBSCRIPTION_STATUS_LABELS[systemInfo.subscription_status]}</dd>
              <dt className="text-gray-400">Fin de prueba</dt>
              <dd>{formatDateTime(systemInfo.trial_ends_at)}</dd>
              <dt className="text-gray-400">Asistente de Vapi</dt>
              <dd>{systemInfo.vapi_assistant_id ?? 'Sin activar'}</dd>
            </dl>
          </Section>
        )}

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | undefined
  children: ReactNode
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  )
}

function inputClass(error?: string): string {
  return `w-full rounded border px-3 py-2 text-sm focus:outline-none ${
    error ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-gray-500'
  }`
}
