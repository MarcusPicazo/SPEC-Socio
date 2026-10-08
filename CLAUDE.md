# CLAUDE.md — Reglas del proyecto

Lee `SPEC.md` antes de cualquier tarea. Es la fuente de verdad de qué construimos y por qué.

## Stack (no cambiar sin preguntar)

- Vite + React + TypeScript (modo estricto) + Tailwind, desplegado en Vercel
- Funciones de Vercel (Node) solo para generar PDF (`/api/quote-pdf`)
- Supabase: Postgres, Auth, RLS, Edge Functions (Deno), Storage, pg_cron
- Twilio (números de teléfono) + Vapi (agente de voz)
- WhatsApp Cloud API de Meta
- Claude vía API de Anthropic: `claude-haiku-4-5-20251001` para resúmenes y clasificación,
  `claude-sonnet-5-5` para cotizaciones
- Deepgram o Whisper para transcribir notas de voz
- Resend para email
- Stripe para cobros
- zod para validar todo lo que entra de afuera

No instales librerías nuevas sin explicarme para qué y pedir confirmación.

## Antes de integrar cualquier servicio externo

Las APIs cambian. Antes de escribir código contra Vapi, Twilio, WhatsApp Cloud API, Resend,
Stripe, Deepgram o Anthropic, **consulta su documentación actual** (WebFetch) en lugar de
confiar en lo que recuerdas. Dime qué versión o página de documentación usaste.

## Reglas de oro

1. **Nada se envía al cliente final sin la aprobación del dueño.** Ni emails, ni SMS, ni
   cotizaciones.
2. **Nunca se inventa un precio, una cantidad ni un dato del cliente.** Si falta algo, se
   le pregunta al dueño.
3. **Todo webhook se verifica y es idempotente:**
   - Meta: firma `X-Hub-Signature-256`
   - Twilio: firma `X-Twilio-Signature`
   - Stripe: firma del evento
   - Vapi: el secreto configurado en el servidor
   - Se guarda el ID del proveedor (`provider_call_id`, `provider_message_id`) con
     restricción `unique`. Un webhook repetido no duplica nada.
4. **Los secretos nunca van al frontend.** La service role de Supabase y las llaves de Meta,
   Vapi, Twilio, Anthropic, Deepgram, Resend y Stripe viven solo en los secretos de las Edge
   Functions o de Vercel. El frontend solo usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. **Multi-cliente:** toda tabla de negocio lleva `business_id` y RLS. La página pública
   `/q/:token` solo lee mediante una función RPC `security definer`.

## Idiomas

- Código, nombres de variables y commits técnicos: inglés.
- Todo lo que lee el **dueño**: español de México neutro, corto, claro y con emojis
  moderados. Él lee en el celular, en la calle.
- Todo lo que lee el **cliente final**: inglés de EE. UU., profesional.
- Los prompts del LLM viven en archivos dentro de `prompts/` (por ejemplo
  `prompts/receptionist.md`, `prompts/call-summary.md`, `prompts/quote-extraction.md`),
  no escritos dentro del código.
- Toda respuesta estructurada del LLM se valida con zod. Si no pasa la validación, se
  reintenta una vez; si vuelve a fallar, se registra el error y se le avisa al dueño en
  lenguaje simple.

## Cómo trabajamos

- Una tarea a la vez. Haz solo lo que te pido en el prompt actual; no adelantes funcionalidades.
- Antes de escribir código en tareas grandes, dame un plan corto (qué archivos creas o cambias).
- Al terminar, dime **exactamente cómo verifico que funciona**: qué número llamar, qué
  mandar por WhatsApp, qué debería ver y en qué tabla de Supabase revisar.
- Si algo de la SPEC es ambiguo, pregunta en vez de inventar.
- Componentes y funciones pequeños, con una sola responsabilidad. Lógica pura (totales de
  cotización, formato de teléfono, plantillas de mensajes) en `src/lib/` o
  `supabase/functions/_shared/`, con pruebas.
- Tipos compartidos en `src/types.ts` y `supabase/functions/_shared/types.ts`. Nada de `any`.
- Registra en `messages` y `events` toda llamada a servicios externos, con su resultado.
  Si algo falla, quiero poder ver por qué sin abrir la consola.

## Costos

- No llames al LLM dentro de ciclos ni por cada mensaje sin necesidad.
- Usa Haiku para todo lo que no sea extraer cotizaciones.
- Cualquier cambio que aumente el costo por llamada o por mensaje debes decírmelo antes.

## Supabase

- Todo cambio de base de datos va como migración SQL en `supabase/migrations/`, con RLS incluido.
- Cuando necesites que yo ejecute algo en el dashboard de Supabase, dame el SQL o los pasos
  completos y dime dónde pegarlo.
- Mantén un `.env.example` con los nombres de todas las variables, sin valores.

## Git

- Al terminar cada tarea que funcione, propón un mensaje de commit corto en español.
- `.gitignore` debe incluir `node_modules`, `dist`, `.env*` (excepto `.env.example`) y
  `supabase/.temp`.
