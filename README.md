# Socio

Oficina bilingüe con IA para negocios latinos de servicios en EE. UU. (techadores,
jardinería, limpieza, plomería, aire acondicionado, pintura, talleres). El dueño
maneja todo por WhatsApp, en español; sus clientes reciben todo en inglés, de forma
profesional.

Ver [`SPEC.md`](./SPEC.md) para la especificación completa.

## Los tres momentos que el producto debe lograr

1. **Nunca más una llamada perdida.** Un cliente llama, el dueño no contesta, un
   agente de voz (Vapi) atiende y en menos de 60 segundos el dueño recibe por
   WhatsApp un resumen en español con botones para confirmar o llamar él mismo.
2. **Cotiza con un audio.** El dueño manda una nota de voz en español describiendo
   el trabajo y el precio; el sistema transcribe, extrae las partidas, genera un PDF
   en inglés y el dueño aprueba antes de que algo le llegue al cliente.
3. **El seguimiento se hace solo.** Recordatorio automático si el cliente no
   responde, y aviso al dueño en cuanto acepta la cotización.

## Stack

- **Frontend:** Vite + React + TypeScript (estricto) + Tailwind + React Router,
  desplegado en Vercel (`/admin` y la página pública `/q/:token`).
- **Backend:** Supabase — Postgres con RLS, Auth, Edge Functions (Deno), Storage,
  pg_cron.
- **Telefonía:** Twilio (números) + Vapi (agente de voz, STT/LLM/TTS).
- **Mensajería:** WhatsApp Cloud API (Meta) — único canal del dueño.
- **LLM:** Claude (Anthropic) — Haiku para resúmenes/clasificación, Sonnet para
  extraer cotizaciones.
- **Transcripción:** Deepgram (notas de voz del dueño).
- **Email:** Resend (cliente final).
- **Cobros:** Stripe (suscripción, 14 días de prueba).
- **Función de Vercel (Node):** `/api/quote-pdf`, el único lugar donde se genera el
  PDF (`@react-pdf/renderer` no corre bien en Deno).

Detalle completo de decisiones en [`SPEC.md` §5](./SPEC.md#5-arquitectura) y en
[`CLAUDE.md`](./CLAUDE.md).

## Estructura del repo

```
src/                      Frontend (admin + página pública /q/:token)
api/                       Función de Vercel /api/quote-pdf
supabase/
  migrations/              Esquema + RLS + funciones SQL, en orden
  functions/                Edge Functions (Deno)
    _shared/                 Lógica pura y clientes compartidos, con tests
    _shared/prompts/          Prompts de los LLM, como módulos TypeScript editables
    voice-webhook/            Fin de llamada de Vapi -> guarda, resume, avisa
    whatsapp-webhook/         Mensajes del dueño -> botones, notas de voz, cotizaciones
    provision-business/       Crea/actualiza el asistente de Vapi de un negocio
    create-checkout-link/     Genera el link de pago de Stripe
    stripe-webhook/           Actualiza el estado de la suscripción
    quote-accept/             Botón Accept de la página pública
    followups/                Recordatorio a los 3 días (cron)
    weekly-report/            Reporte semanal al dueño (cron)
    billing-reminders/        Aviso de pago atrasado (cron)
scripts/                   Scripts de un solo uso (setup de Stripe, seed del negocio demo)
```

## Documentación

| Archivo | Para qué |
|---|---|
| [`SPEC.md`](./SPEC.md) | Qué se construye y por qué — fuente de verdad |
| [`CLAUDE.md`](./CLAUDE.md) | Reglas del proyecto para trabajar con Claude Code |
| [`PROMPTS.md`](./PROMPTS.md) | Plan día por día usado para construir el MVP |
| [`DEPLOY.md`](./DEPLOY.md) | Pasos exactos para desplegar, en orden |
| [`TESTING.md`](./TESTING.md) | Guion de 20 llamadas de prueba y qué debe pasar en cada una |

## Desarrollo local

```bash
npm install
npm run dev          # frontend en localhost:5173
npm run typecheck    # frontend
npm run typecheck:api
npm run lint
npm run build
```

Las Edge Functions corren en Deno, no en Node — sus pruebas se corren aparte:

```bash
cd supabase/functions
deno task test
```

## Desplegar

Ver [`DEPLOY.md`](./DEPLOY.md) para la lista completa (migraciones, secretos, Vault
para los cron jobs, variables de Vercel, webhooks de Meta y Stripe, plantillas de
WhatsApp a registrar, llaves de proveedores en Vapi).

## Estado

MVP completo según el plan de 12 días de [`PROMPTS.md`](./PROMPTS.md): alta de
negocios, agente de voz, cotizaciones por nota de voz, cobro con Stripe,
seguimientos y reporte semanal automáticos. Antes del primer cliente real, sigue el
guion de pruebas de [`TESTING.md`](./TESTING.md) con el negocio demo
("Martinez Roofing") que crea `scripts/seed-demo-business.ts`.
