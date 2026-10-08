// Idempotent seed for the SPEC §4.1 demo business ("negocio demo... para que en una
// venta el prospecto llame en vivo y vea llegar el WhatsApp"). Safe to run again — it
// updates the existing "Martinez Roofing" row instead of creating a duplicate.
//
// Never invents real contact info: DEMO_OWNER_WHATSAPP is required (no fallback), and
// DEMO_TWILIO_NUMBER is optional — leave it unset and assign the number later from
// /admin once you've bought it in Twilio, same as any other business.
//
// Run with:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_OWNER_WHATSAPP=+1... \
//     deno run --allow-net --allow-env scripts/seed-demo-business.ts

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { BusinessHours, BusinessService } from '../src/types.ts'

const BUSINESS_NAME = 'Martinez Roofing'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ownerWhatsapp = Deno.env.get('DEMO_OWNER_WHATSAPP')
const twilioNumber = Deno.env.get('DEMO_TWILIO_NUMBER') || null

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  Deno.exit(1)
}
if (!ownerWhatsapp) {
  console.error(
    'Falta DEMO_OWNER_WHATSAPP (formato +1...) — el número de WhatsApp donde quieres\n' +
      'recibir los avisos de este negocio demo. No se inventa un valor.',
  )
  Deno.exit(1)
}

// Houston-area roofing price ranges — realistic 2026 market rates for reference, not
// Martinez Roofing's actual pricing (it doesn't exist). Editable from /admin afterward.
const services: BusinessService[] = [
  { name: 'Roof inspection', price_min: 0, price_max: 150 },
  { name: 'Roof repair / leak patch', price_min: 300, price_max: 1200 },
  { name: 'Full roof replacement (asphalt shingle)', price_min: 8000, price_max: 16000 },
  { name: 'Gutter installation / repair', price_min: 500, price_max: 2500 },
  { name: 'Storm damage emergency tarp', price_min: 200, price_max: 600 },
]

const weekday = { open: '07:00', close: '18:00' }
const hours: BusinessHours = {
  monday: weekday,
  tuesday: weekday,
  wednesday: weekday,
  thursday: weekday,
  friday: weekday,
  saturday: { open: '08:00', close: '14:00' },
  sunday: null,
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

async function main() {
  const { data: existing, error: findError } = await admin
    .from('businesses')
    .select('id')
    .eq('name', BUSINESS_NAME)
    .maybeSingle()
  if (findError) throw findError

  const row = {
    name: BUSINESS_NAME,
    trade: 'roofing',
    city: 'Houston',
    state: 'TX',
    timezone: 'America/Chicago',
    owner_name: 'Carlos Martinez',
    owner_whatsapp: ownerWhatsapp,
    twilio_number: twilioNumber,
    emergency_transfer: true,
    services,
    hours,
  }

  if (existing) {
    const { error } = await admin.from('businesses').update(row).eq('id', existing.id)
    if (error) throw error
    console.log(`Negocio demo actualizado: ${existing.id} (${BUSINESS_NAME})`)
  } else {
    const { data: created, error } = await admin.from('businesses').insert(row).select('id').single()
    if (error) throw error
    console.log(`Negocio demo creado: ${created.id} (${BUSINESS_NAME})`)
  }

  console.log(
    `\nSiguientes pasos:\n` +
      (twilioNumber
        ? `- Abre /admin → ${BUSINESS_NAME} → "Activar línea" para crear/actualizar el asistente de Vapi.\n`
        : `- Asigna un número de Twilio desde /admin → Editar, luego "Activar línea".\n`) +
      `- Sigue TESTING.md para el guion de 20 llamadas de prueba.`,
  )
}

await main()
