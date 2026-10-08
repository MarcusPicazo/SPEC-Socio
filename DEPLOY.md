# DEPLOY.md — pasos exactos, en orden

Esto asume que ya tienes las cuentas de PROMPTS.md Día 0 (Meta, Supabase, Vercel,
Twilio, Vapi, Anthropic, Deepgram, Resend, Stripe) y el proyecto de Supabase creado.

## 1. Migraciones

```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

## 2. Secretos en Supabase Vault (para pg_cron)

Una sola vez, en el SQL Editor del dashboard:

```sql
select vault.create_secret('https://<tu-project-ref>.supabase.co', 'project_url');
select vault.create_secret('<tu-anon-key>', 'anon_key');
select vault.create_secret('<un-secreto-largo-que-tú-inventes>', 'cron_secret');
```

El mismo valor de `cron_secret` va también como secreto de función en el paso 3
(`CRON_SECRET`) — lo verifican `followups`, `weekly-report` y `billing-reminders`.

Verifica que los tres cron jobs quedaron programados:

```sql
select jobname, schedule from cron.job;
-- followups-hourly, weekly-report-hourly, billing-reminders-hourly, cada uno '0 * * * *'
```

## 3. Secretos de las Edge Functions

```bash
npx supabase secrets set \
  TWILIO_ACCOUNT_SID=... \
  TWILIO_AUTH_TOKEN=... \
  VAPI_API_KEY=... \
  VAPI_SERVER_SECRET=... \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_BUSINESS_ACCOUNT_ID=... \
  WHATSAPP_VERIFY_TOKEN=... \
  WHATSAPP_APP_SECRET=... \
  ANTHROPIC_API_KEY=... \
  DEEPGRAM_API_KEY=... \
  RESEND_API_KEY=... \
  RESEND_FROM_EMAIL=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  STRIPE_PRICE_ID=... \
  CRON_SECRET=... \
  APP_BASE_URL=https://<tu-dominio-de-vercel> \
  QUOTE_PDF_SHARED_SECRET=...
```

Ver `.env.example` para qué es cada una y cuáles son opcionales. `SUPABASE_URL`,
`SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase solo, no las
configures a mano.

Antes de crear el producto de Stripe, corre el script de setup y copia el
`STRIPE_PRICE_ID` que imprime:

```bash
STRIPE_SECRET_KEY=sk_... deno run --allow-net --allow-env scripts/stripe-setup.ts
```

## 4. Desplegar las Edge Functions

```bash
npx supabase functions deploy voice-webhook
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy provision-business
npx supabase functions deploy create-checkout-link
npx supabase functions deploy stripe-webhook
npx supabase functions deploy quote-accept
npx supabase functions deploy followups
npx supabase functions deploy weekly-report
npx supabase functions deploy billing-reminders
```

`supabase/config.toml` ya trae `verify_jwt = false` para las que lo necesitan — no
hace falta pasar flags extra. Los prompts viven como módulos de TypeScript en
`supabase/functions/_shared/prompts/*.ts` (no archivos `.md` sueltos), así que
`deploy` los empaqueta igual que cualquier otro import — no dependen de Docker ni de
`static_files`.

Verifica localmente antes de desplegar (requiere Docker):

```bash
npx supabase functions serve
```

## 5. Variables de entorno en Vercel

En el dashboard de Vercel (Project Settings → Environment Variables), para la
función `/api/quote-pdf`:

```
SUPABASE_URL=https://<tu-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
APP_BASE_URL=https://<tu-dominio-de-vercel>
QUOTE_PDF_SHARED_SECRET=...   (mismo valor que el paso 3)
```

Y para el frontend (Vite, build-time):

```
VITE_SUPABASE_URL=https://<tu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Despliega con un push a la rama conectada, o `vercel --prod`.

## 6. Webhook de Meta (WhatsApp Cloud API)

En el dashboard de Meta for Developers, tu app → WhatsApp → Configuration:

- **Callback URL:** `https://<tu-project-ref>.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token:** el mismo valor que pusiste en `WHATSAPP_VERIFY_TOKEN`
- Suscríbete al campo **`messages`**.

## 7. Plantillas de WhatsApp a registrar

En WhatsApp Manager → Message Templates, categoría **Utility**, idioma `es_MX`:

| Nombre | Variables | Botones |
|---|---|---|
| `nueva_llamada` | {{1}} nombre, {{2}} resumen, {{3}} teléfono, {{4}} dirección, {{5}} horario preferido | Confirmar cita / Lo llamo yo |
| `cotizacion_aceptada` | {{1}} nombre del cliente, {{2}} monto | — |
| `seguimiento_enviado` | {{1}} nombre del cliente, {{2}} número de cotización, {{3}} monto | — |
| `reporte_semanal` | {{1}} negocio, {{2}} llamadas contestadas, {{3}} urgentes, {{4}} cotizaciones enviadas, {{5}} aceptadas, {{6}} monto aceptado | — |
| `link_de_pago` | {{1}} nombre del dueño, {{2}} link del checkout | — |
| `pago_pendiente` | {{1}} nombre del dueño, {{2}} "vencida"/"cancelada", {{3}} link del portal de facturación | — |

El texto exacto de cada una está en los mensajes de días anteriores de esta
conversación y en `_shared/whatsapp-templates.ts` (los comentarios documentan el
orden de las variables). La aprobación de Meta puede tardar hasta 24 horas —
hazlo antes de la primera llamada de prueba real.

## 8. Webhook de Stripe

Dashboard de Stripe → Developers → Webhooks → Add endpoint:

- **URL:** `https://<tu-project-ref>.supabase.co/functions/v1/stripe-webhook`
- **Eventos:** `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- Copia el **Signing secret** a `STRIPE_WEBHOOK_SECRET` (paso 3) y vuelve a
  desplegar `stripe-webhook` si ya lo habías hecho antes de tener este valor.

## 9. Llaves de proveedores dentro de Vapi

Dashboard de Vapi → Settings → Provider Keys: conecta tu llave de **Anthropic** y
de **Deepgram** ahí — el asistente las referencia por nombre de proveedor, pero
Vapi necesita sus propias credenciales para usarlas, independientemente de las que
configuraste en Supabase.

## 10. Negocio demo y primera llamada de prueba

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_OWNER_WHATSAPP=+1... \
  deno run --allow-net --allow-env scripts/seed-demo-business.ts
```

1. Entra a `/admin`, abre "Martinez Roofing", asigna el número de Twilio si el
   script no lo tenía, y toca **Activar línea**.
2. Escríbele "Hola" al número de WhatsApp del producto desde el celular que
   pusiste en `DEMO_OWNER_WHATSAPP` — eso abre la ventana de 24 horas.
3. Llama al número de Twilio del negocio y sigue `TESTING.md` para las 20
   llamadas de prueba.
4. Genera un link de pago de prueba desde `/admin` con una tarjeta de prueba de
   Stripe, y confirma que `subscription_status` se actualiza en `businesses`.

## Orden recomendado si algo falla

Si una Edge Function no arranca → revisa `static_files` (paso 4). Si un webhook
externo da 401 → revisa `verify_jwt` en `config.toml` y que el secreto en el
paso 3 coincide exactamente con el que tiene el proveedor. Si el resumen o la
cotización nunca llegan → revisa la tabla `events` en Supabase antes que nada,
todo se registra ahí.
