# SPEC — Socio (nombre provisional)

## 1. Qué es

Una **oficina bilingüe con IA** para negocios latinos de servicios en EE. UU.: techadores,
jardinería, limpieza, plomería, aire acondicionado, pintura, talleres.

**La promesa:** el dueño maneja todo su negocio **en español, por WhatsApp**, y sus clientes
reciben todo **en inglés**, de forma profesional.

- Para el dueño, la única interfaz es WhatsApp. No instala nada ni abre ninguna app nueva.
- Para su cliente, es un negocio que siempre contesta, cotiza rápido y da seguimiento.

**Objetivo de negocio del MVP:** 10 negocios en prueba gratis en los primeros 30 días y
al menos 5 pagando al terminar la prueba.

## 2. Los tres momentos que el producto DEBE lograr (prioridad absoluta)

1. **"Nunca más una llamada perdida."** Un cliente llama en inglés al número del negocio.
   El dueño no contesta, así que la llamada se desvía a nuestro número y la IA contesta.
   La IA se presenta como asistente virtual, toma los datos y cuelga. **En menos de 60
   segundos** el dueño recibe por WhatsApp un resumen en español con dos botones:
   *Confirmar cita* y *Lo llamo yo*.

   > 📞 **Nueva llamada — Sarah Miller**
   > Gotera en el techo, entra agua en la recámara. Urgente.
   > Tel: (713) 555-0142 · 4512 Oak St, Houston
   > Prefiere: jueves en la mañana

2. **"Cotiza con un audio."** El dueño manda una nota de voz en español:
   *"Cotízale a Sarah 2,000 pies de techo con material, 9,500 dólares, garantía de 5 años."*
   **En menos de 60 segundos** recibe una vista previa en español, el PDF de la cotización
   en inglés y dos botones: *Enviar* y *Corregir*. Al tocar *Enviar*, el cliente recibe un
   email en inglés con un link a la cotización y un botón *Accept*.

3. **"El seguimiento se hace solo."** Si el cliente no acepta en 3 días, el sistema le manda
   un recordatorio. Cuando acepta, el dueño recibe:
   *"🎉 Sarah Miller aceptó tu cotización de $9,500."*

**Regla de oro:** nada se le envía al cliente final sin que el dueño lo haya aprobado.

Si una funcionalidad no ayuda a estos tres momentos, no es prioridad.

## 3. Usuarios

| Usuario | Idioma | Canal | Notas |
|---|---|---|---|
| **Dueño** (owner) | Español | WhatsApp | Trabaja en la calle, usa notas de voz, no lee textos largos |
| **Cliente final** (customer) | Inglés (a veces español) | Teléfono, email (SMS en v2) | Espera trato profesional en inglés |
| **Operador interno** (nosotros) | Español | Panel `/admin` | Da de alta negocios, ve llamadas y errores |

## 4. Alcance

### 4.1 Obligatorio (v1)

- **Alta de negocio** desde `/admin`: nombre, giro, ciudad y estado, zona horaria, horario,
  servicios con rangos de precio de referencia, nombre y WhatsApp del dueño, número de
  Twilio asignado.
- **Recepcionista de IA (solo llamadas entrantes)**, en inglés y en español según hable
  quien llama. Al inicio dice que es un asistente virtual y que la llamada puede grabarse.
- **Extracción estructurada** al terminar cada llamada (§6.2).
- **Detección de spam y robollamadas:** esas llamadas no se notifican al dueño.
- **Emergencias:** si el cliente reporta algo urgente (inundación, sin luz, sin aire con
  calor extremo), se le ofrece transferir la llamada al celular del dueño. Ante un olor
  a gas o un riesgo para la vida, se le dice que llame al 911.
- **Resumen al dueño por WhatsApp**, con plantilla aprobada y botones.
- **Cotización por nota de voz:** transcripción, extracción de partidas, PDF en inglés,
  vista previa en español, aprobación del dueño y envío por email.
- **Página pública de cotización** (`/q/:token`) en inglés, con botón *Accept*.
- **Seguimiento automático** a los 3 días, por email, una sola vez.
- **Reporte semanal** al dueño por WhatsApp: llamadas contestadas, cotizaciones enviadas
  y aceptadas, y monto aceptado. Es la palanca para que el cliente no cancele.
- **Cobro:** Stripe con suscripción y 14 días de prueba.
- **Negocio demo** ("Martinez Roofing", Houston) con un número real, para que en una venta
  el prospecto llame en vivo y vea llegar el WhatsApp.

### 4.2 Versión 2

- SMS al cliente final (requiere registro A2P 10DLC, §8).
- Solicitud de reseña en Google cuando el dueño marca el trabajo como terminado.
- Integración con Google Calendar.
- Facturas (invoices) y pago con Stripe desde la página de la cotización.
- Panel web de solo lectura para el dueño.
- Contestar formularios del sitio web y mensajes de Facebook.

### 4.3 Fuera de alcance

Llamadas salientes hechas por la IA, marketing masivo, CRM complejo, apps nativas,
contabilidad.

## 5. Arquitectura

```
                         ┌──────────────────────────── LLAMADA ────────────────────────────┐
 Cliente (inglés) ──► Número del negocio ──(desvío si no contesta)──► Número Twilio
                                                                          │
                                                                          ▼
                                                                Vapi (agente de voz)
                                                                 STT + LLM + TTS
                                                                          │ webhook al colgar
                                                                          ▼
                                                    Supabase Edge Function `voice-webhook`
                                                     guarda llamada · Claude resume en español
                                                                          │
                                                                          ▼
                                                     WhatsApp Cloud API ──► Dueño (español)

                         ┌──────────────────────────── COTIZACIÓN ─────────────────────────┐
 Dueño: nota de voz ──► WhatsApp Cloud API ──► Edge Function `whatsapp-webhook`
                                                  │ descarga audio · transcribe · Claude
                                                  │ extrae partidas → cotización (borrador)
                                                  ▼
                                      Vercel `/api/quote-pdf` (PDF en inglés)
                                                  │
                         Dueño recibe PDF + botones [Enviar] [Corregir]
                                                  │ Enviar
                                                  ▼
                              Resend (email) ──► Cliente ──► Página `/q/:token` ──► [Accept]
                                                                                       │
                                                       Edge Function `quote-accept` ◄──┘
                                                                  │
                                                                  ▼
                                                    WhatsApp al dueño: "¡Aceptó!"

 pg_cron (Supabase) ──► `followups` (recordatorios a los 3 días) y `weekly-report` (lunes)
```

### 5.1 Piezas y elecciones

| Pieza | Elección | Por qué |
|---|---|---|
| Telefonía | **Twilio**: un número local de EE. UU. por negocio | Estándar, se importa directo a Vapi |
| Agente de voz | **Vapi** (alternativa: Retell) | Resuelve latencia, interrupciones y telefonía. **No construimos audio en tiempo real nosotros.** |
| Backend y datos | **Supabase**: Postgres, RLS, Edge Functions, Storage, pg_cron | Tu stack; multi-cliente con RLS |
| WhatsApp | **WhatsApp Cloud API de Meta**, un solo número del producto que escribe a todos los dueños | Directo, sin intermediario |
| Transcripción de notas de voz | Deepgram o Whisper | Español con acento mexicano y centroamericano |
| LLM (resúmenes y clasificación) | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Rápido y barato |
| LLM (cotizaciones) | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | Más preciso con números y partidas |
| LLM del agente de voz | Se elige dentro de Vapi, priorizando la latencia | Se prueba con llamadas reales |
| PDF | Función de Vercel (Node) con `@react-pdf/renderer` | En Deno es incómodo generar PDF |
| Email | **Resend**, con dominio propio | Simple, buena entregabilidad |
| Frontend | Vite + React + TypeScript + Tailwind en Vercel | `/admin` y `/q/:token` |
| Pagos | **Stripe**: suscripción y prueba de 14 días | |

### 5.2 Cómo se conecta un negocio (onboarding, 15 minutos)

1. Lo damos de alta en `/admin`. El sistema compra o asigna un número de Twilio y crea el
   asistente de Vapi con los datos del negocio (nombre, servicios, horario, zona).
2. El dueño configura en su celular el **desvío condicional** (si no contesta o está
   ocupado) hacia nuestro número. Los códigos dependen de la compañía (AT&T, T-Mobile,
   Verizon), así que hay que tener una guía por compañía. Opcional: poner nuestro número
   en su perfil de Google.
3. El dueño le escribe "Hola" al WhatsApp de Socio. Eso abre la ventana de 24 horas y
   confirma su número.
4. Hacemos una llamada de prueba juntos y él ve llegar su primer resumen.

### 5.3 Multi-cliente

- Toda tabla de negocio lleva `business_id`.
- Las Edge Functions usan la service role (solo en el servidor). El frontend nunca la toca.
- `/admin` solo para usuarios con rol `operator`.
- La página `/q/:token` lee una sola cotización mediante una función RPC
  `security definer` que recibe el token y devuelve solo los campos públicos.

## 6. Datos

### 6.1 Tablas

```sql
businesses (
  id uuid pk, name text, trade text, city text, state text, timezone text,
  owner_name text, owner_whatsapp text unique,       -- E.164
  twilio_number text unique, vapi_assistant_id text,
  hours jsonb, services jsonb,                       -- servicios y rangos de precio
  emergency_transfer boolean default true,
  subscription_status text,                          -- trialing | active | past_due | canceled
  stripe_customer_id text, trial_ends_at timestamptz, created_at timestamptz
)

customers (
  id uuid pk, business_id uuid fk, name text, phone text, email text,
  address text, language text, created_at timestamptz
)

calls (
  id uuid pk, business_id uuid fk, customer_id uuid fk null,
  provider_call_id text unique,                      -- idempotencia del webhook
  from_number text, started_at timestamptz, duration_sec int,
  recording_url text, transcript text,
  extracted jsonb,                                   -- §6.2
  summary_es text, is_spam boolean,
  status text,                                       -- new | confirmed | owner_will_call | ignored
  created_at timestamptz
)

quotes (
  id uuid pk, business_id uuid fk, customer_id uuid fk, call_id uuid fk null,
  number text,                                       -- Q-0001 por negocio
  status text,                                       -- draft | sent | viewed | accepted | declined | expired
  items jsonb,                                       -- [{description_en, qty, unit, unit_price, total}]
  subtotal numeric, tax numeric, total numeric, currency text default 'USD',
  notes_en text, warranty_en text, valid_until date,
  public_token text unique, pdf_path text,
  source_audio_path text, transcript_es text,
  sent_at timestamptz, viewed_at timestamptz, accepted_at timestamptz,
  followup_count int default 0, created_at timestamptz
)

messages (                                           -- bitácora de todo lo que entra y sale
  id uuid pk, business_id uuid fk, direction text, channel text,  -- whatsapp | email | sms
  to_addr text, from_addr text, template text, body text,
  provider_message_id text unique, status text, created_at timestamptz
)

events (id uuid pk, business_id uuid fk, type text, payload jsonb, created_at timestamptz)
```

### 6.2 Lo que se extrae de cada llamada

```json
{
  "caller_name": "Sarah Miller",
  "callback_number": "+17135550142",
  "address": "4512 Oak St, Houston, TX",
  "service_type": "roof_leak",
  "description": "Water coming into the bedroom ceiling after last night's storm",
  "urgency": "emergency | soon | flexible",
  "preferred_time": "Thursday morning",
  "language": "en | es",
  "is_spam": false,
  "summary_es": "Gotera en el techo, entra agua en la recámara. Urgente."
}
```

### 6.3 Lo que se extrae de una nota de voz de cotización

```json
{
  "customer_hint": "Sarah",
  "items": [
    { "description_es": "Techo de 2,000 pies con material",
      "description_en": "Roof replacement, 2,000 sq ft, materials included",
      "qty": 1, "unit": "job", "unit_price": 9500 }
  ],
  "warranty_en": "5-year workmanship warranty",
  "notes_en": null,
  "needs_clarification": []
}
```

- Si `customer_hint` coincide con más de un cliente reciente, se le pregunta al dueño con
  una lista interactiva de WhatsApp.
- Si falta un precio o una cantidad, se pregunta. **Nunca se inventa un número.**
- Unidades de EE. UU. (sq ft, linear ft) y dólares. El impuesto solo se agrega si el dueño
  lo menciona.

## 7. Comportamiento del agente de voz

- **Saludo:** *"Thanks for calling {Business}. This is {Business}'s virtual assistant, and
  this call may be recorded. How can I help you today?"*
- Si la persona habla español, cambia a español.
- Toma: nombre, teléfono para regresar la llamada, dirección, qué necesita, urgencia y
  horario preferido.
- **Nunca** promete precios exactos ni horarios exactos. Puede dar los rangos de precio que
  el dueño configuró y dice que el dueño confirmará pronto.
- Las preguntas frecuentes (zona de servicio, horario, garantías) las contesta con los
  datos configurados del negocio.
- Ante una emergencia, ofrece transferir al celular del dueño. Ante gas o riesgo de vida,
  dice que llame al 911.
- Las llamadas deben durar entre 1 y 3 minutos.

## 8. Costos y cumplimiento

### 8.1 Costo por cliente al mes (estimado)

| Concepto | Supuesto | Costo |
|---|---|---|
| Voz (Vapi o Retell, todo incluido) | 300 min (120 llamadas × 2.5 min) a $0.09–$0.15/min | $27–$45 |
| Número de Twilio | 1 número local | unos $1–$2 |
| WhatsApp | Gratis dentro de la ventana de 24 h; plantillas de utilidad fuera de ella | menos de $3 |
| LLM (resúmenes y cotizaciones) | | menos de $5 |
| Email | | casi $0 |
| **Total** | | **≈ $30–$55** |

Con un precio de **$199 al mes**, el margen bruto queda entre 72% y 85%. Hay que vigilar
a los clientes con muchísimas llamadas: el plan base puede tener un límite de minutos.

### 8.2 Reglas que no se negocian

- **Grabación:** algunos estados (California, Florida y otros) exigen el consentimiento de
  todas las partes para grabar. Por eso el aviso va siempre al inicio de la llamada.
- **Sin llamadas salientes de IA en v1:** desde 2024 la FCC considera las voces de IA como
  "artificiales" bajo la ley TCPA, y requieren consentimiento previo.
- **SMS a clientes de EE. UU.:** requiere registro A2P 10DLC. Desde el 30 de junio de 2026,
  la campaña exige URL de aviso de privacidad y de términos. Por eso v1 usa email.
- **WhatsApp:** el bot es un asistente del negocio, que está permitido bajo la política de
  2026. Los avisos que salen fuera de la ventana de 24 horas usan plantillas de utilidad
  aprobadas por Meta.
- **Legal:** términos de servicio, aviso de privacidad y retención de grabaciones de 90 días.
  La empresa opera con una LLC en EE. UU., Stripe y una cuenta bancaria en dólares.

## 9. Criterios de terminado

- El resumen llega por WhatsApp en menos de 60 segundos después de colgar.
- El agente responde sin pausas incómodas (menos de 1 segundo percibido).
- La cotización por nota de voz llega en menos de 60 segundos.
- 20 llamadas de prueba, con distintos acentos y ruido de fondo, sin perder datos clave.
- El spam no genera notificaciones.
- Nada sale hacia el cliente final sin la aprobación del dueño.
- Si se reenvía el mismo webhook, no se duplica nada (idempotencia).
- Los tres momentos de §2 funcionan diez veces seguidas.

## 10. Plan por días

| Día | Entregable |
|---|---|
| 1 | Cuentas, repo, migraciones con RLS y la verificación de Meta Business iniciada |
| 2 | `/admin`: login y alta de negocios |
| 3 | Asistente de Vapi creado desde los datos del negocio; primera llamada real |
| 4 | `voice-webhook`: guarda la llamada, detecta spam y genera el resumen en español |
| 5 | Plantillas de WhatsApp y envío del resumen con botones (momento 1) |
| 6 | Botones *Confirmar cita* y *Lo llamo yo*; transferencia de emergencias |
| 7 | Nota de voz → transcripción → cotización en borrador |
| 8 | PDF en inglés, página `/q/:token` y botón *Accept* |
| 9 | Envío por email tras la aprobación; aviso de aceptación (momento 2) |
| 10 | Seguimiento a los 3 días y reporte semanal (momento 3) |
| 11 | Stripe: suscripción y prueba de 14 días |
| 12 | Negocio demo, 20 llamadas de prueba y correcciones |
