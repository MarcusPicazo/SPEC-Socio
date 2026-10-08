import { z } from 'zod'
import type { BusinessHours, BusinessService } from '../../types'

export const DAYS_OF_WEEK: { key: string; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
]

export const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const E164_REGEX = /^\+[1-9]\d{6,14}$/
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const dayHoursSchema = z.union([
  z.object({
    open: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
    close: z.string().regex(TIME_REGEX, 'Formato HH:MM'),
  }),
  z.null(),
])

const serviceSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre del servicio es obligatorio'),
    price_min: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative('No puede ser negativo'),
    price_max: z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative('No puede ser negativo'),
  })
  .refine((service) => service.price_max >= service.price_min, {
    message: 'El máximo debe ser mayor o igual al mínimo',
    path: ['price_max'],
  })

export const businessFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  trade: z.string().trim().min(1, 'El giro es obligatorio'),
  city: z.string().trim().min(1, 'La ciudad es obligatoria'),
  state: z.string().trim().min(1, 'El estado es obligatorio'),
  timezone: z.string().trim().min(1, 'La zona horaria es obligatoria'),
  owner_name: z.string().trim().min(1, 'El nombre del dueño es obligatorio'),
  owner_whatsapp: z
    .string()
    .trim()
    .regex(E164_REGEX, 'Formato internacional, ej. +17135550123'),
  twilio_number: z
    .string()
    .trim()
    .regex(E164_REGEX, 'Formato internacional, ej. +17135550123')
    .optional()
    .or(z.literal('')),
  emergency_transfer: z.boolean(),
  services: z.array(serviceSchema).min(1, 'Agrega al menos un servicio'),
  hours: z.record(dayHoursSchema),
})

export type BusinessFormValues = z.infer<typeof businessFormSchema>

export function emptyBusinessFormValues(): BusinessFormValues {
  return {
    name: '',
    trade: '',
    city: '',
    state: '',
    timezone: 'America/Chicago',
    owner_name: '',
    owner_whatsapp: '',
    twilio_number: '',
    emergency_transfer: true,
    services: [{ name: '', price_min: 0, price_max: 0 }],
    hours: Object.fromEntries(DAYS_OF_WEEK.map((d) => [d.key, null])) as BusinessHours,
  }
}

export interface BusinessInput {
  name: string
  trade: string
  city: string
  state: string
  timezone: string
  owner_name: string
  owner_whatsapp: string
  twilio_number: string | null
  emergency_transfer: boolean
  services: BusinessService[]
  hours: BusinessHours
}

export function toBusinessInput(values: BusinessFormValues): BusinessInput {
  return {
    name: values.name,
    trade: values.trade,
    city: values.city,
    state: values.state,
    timezone: values.timezone,
    owner_name: values.owner_name,
    owner_whatsapp: values.owner_whatsapp,
    twilio_number: values.twilio_number ? values.twilio_number : null,
    emergency_transfer: values.emergency_transfer,
    services: values.services,
    hours: values.hours,
  }
}
