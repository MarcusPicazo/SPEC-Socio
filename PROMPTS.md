# PROMPTS.md — Prompts para Claude Code, en orden

Pon `SPEC.md`, `CLAUDE.md` y este archivo en la raíz del repo. Copia un prompt a la vez y
no pases al siguiente hasta verificar que el anterior funciona.

---

## Día 0 — Cuentas (esto lo haces tú, no Claude Code)

Empieza hoy con Meta, porque su verificación tarda días.

- [ ] **Meta Business** verificado y una app con **WhatsApp Cloud API**. Mientras se aprueba,
      usa el número de prueba que Meta te da.
- [ ] **Supabase**: proyecto nuevo.
- [ ] **Vercel**: cuenta conectada a GitHub.
- [ ] **Twilio**: cuenta actualizada (no de prueba) y un número local de Houston para el demo.
- [ ] **Vapi**: cuenta y llave de API.
- [ ] **Anthropic**: llave de API.
- [ ] **Deepgram** (u OpenAI para Whisper): llave de API.
- [ ] **Resend**: dominio propio verificado (por ejemplo `socio-ai.com` o el nombre que elijas).
- [ ] **Stripe**: cuenta. Para cobrar en dólares conviene una LLC en EE. UU. (Stripe Atlas o
      similar) y una cuenta bancaria en dólares (Mercury o similar).

---

## Día 1 — Proyecto base y base de datos

```
Lee SPEC.md y CLAUDE.md completos.

Crea el proyecto base:
- Vite + React + TypeScript estricto + Tailwind + React Router.
- Carpeta supabase/ con migrations/ y functions/_shared/.
- Carpeta prompts/ vacía.
- .env.example con todas las variables que va a necesitar el proyecto según SPEC §5.1
  (frontend y secretos de Edge Functions por separado, con un comentario de para qué sirve cada una).

Luego escribe las migraciones de SPEC §6.1 (businesses, customers, calls, quotes, messages,
events) con:
- RLS activado en todas.
- Rol operator para el panel interno (tabla operators con user_id).
- Función RPC security definer get_public_quote(token text) que devuelva solo los
  campos públicos de una cotización y los datos públicos del negocio.

Antes de escribir código, dame el plan. Al terminar, dime cómo aplico las migraciones y
cómo verifico que el RLS funciona.
```

## Día 2 — Panel interno `/admin`

```
Crea el panel /admin:
- Login con Supabase Auth (email y contraseña), solo para operators.
- Lista de negocios con: nombre, ciudad, estado de suscripción, llamadas de los últimos 7 días.
- Formulario de alta y edición de negocio con todos los campos de businesses (SPEC §6.1).
  Los servicios se capturan como lista: nombre del servicio + rango de precio (mínimo y máximo).
  El horario, por día de la semana.
- Vista de detalle de un negocio con sus últimas llamadas y cotizaciones (solo lectura por ahora).

Textos de la interfaz en español. Diseño simple y limpio; es una herramienta interna.
```

## Día 3 — Agente de voz en Vapi

```
Consulta primero la documentación actual de Vapi (creación de asistentes por API, importación
de números de Twilio, analysis plan / structured data y mensajes de servidor al terminar la llamada).

Luego:
1. Escribe prompts/receptionist.md siguiendo SPEC §7. Es una plantilla con variables
   del negocio (nombre, giro, ciudad, servicios con rangos, horario, zona de servicio).
2. Crea la Edge Function provision-business que, dado un business_id:
   - importa o asigna el número de Twilio del negocio en Vapi,
   - crea (o actualiza) el asistente de Vapi con el prompt ya rellenado, voz en inglés,
     detección de español, el esquema de extracción de SPEC §6.2 y la URL del webhook
     de fin de llamada apuntando a voice-webhook,
   - configura la transferencia al celular del dueño solo para emergencias,
   - guarda vapi_assistant_id en businesses.
3. Agrega en /admin un botón "Activar línea" que llame a esa función.

Dime cómo hago una llamada de prueba y qué debo escuchar.
```

## Día 4 — Webhook de fin de llamada

```
Crea la Edge Function voice-webhook:
- Verifica el secreto de Vapi. Rechaza todo lo que no venga de Vapi.
- Idempotente por provider_call_id.
- Busca el negocio por el número llamado.
- Guarda la llamada en calls con transcript, duración, URL de grabación y extracted.
- Crea o actualiza el customer por número de teléfono.
- Si is_spam es true, marca la llamada como ignored y no hace nada más.
- Si no es spam, genera summary_es con Claude Haiku usando prompts/call-summary.md:
  2 o 3 líneas en español, lo urgente primero. Valida con zod.
- Registra todo en events.

Agrega pruebas para la lógica de clasificación y de formato. Dime cómo verifico con
una llamada real y qué filas debo ver en Supabase.
```

## Día 5 — Resumen al dueño por WhatsApp (momento 1)

```
Consulta la documentación actual de WhatsApp Cloud API (plantillas, botones de respuesta
rápida, ventana de 24 horas y verificación de webhooks).

1. Dame el texto exacto de las plantillas de categoría UTILITY que debo registrar en Meta,
   en español:
   - nueva_llamada: nombre, resumen, teléfono, dirección, horario preferido, con botones
     "Confirmar cita" y "Lo llamo yo".
   - cotizacion_aceptada, seguimiento_enviado y reporte_semanal.
2. Crea _shared/whatsapp.ts con funciones para enviar plantillas, texto libre, documentos y
   listas interactivas. Si la ventana de 24 horas está abierta, usa texto libre; si no,
   usa plantilla. Registra cada envío en messages.
3. Conecta voice-webhook para que mande nueva_llamada al dueño.

Criterio de terminado: llamo al número demo, cuelgo y en menos de 60 segundos me llega el
WhatsApp con el resumen correcto.
```

## Día 6 — Botones del dueño y emergencias

```
Crea la Edge Function whatsapp-webhook:
- Verificación del webhook (GET) y de la firma X-Hub-Signature-256 (POST).
- Idempotente por provider_message_id.
- Identifica al negocio por el número de WhatsApp del remitente. Si no es un dueño
  registrado, responde amablemente que este número es solo para clientes de Socio.
- Botón "Confirmar cita": marca la llamada como confirmed y responde
  "Listo ✅ Anotado para {día}". (El aviso al cliente final queda para v2.)
- Botón "Lo llamo yo": marca owner_will_call y responde con el teléfono del cliente
  como enlace para marcar.
- Mensajes de texto libres que no entienda: responde con un menú corto de lo que puede hacer.

Revisa también que la transferencia de emergencias del Día 3 funciona y registra el evento.
```

## Día 7 — Cotización por nota de voz

```
Extiende whatsapp-webhook para notas de voz:
1. Descarga el audio desde la API de medios de Meta, guárdalo en Storage
   (bucket privado quotes-audio) y transcríbelo en español.
2. Con Claude Sonnet y prompts/quote-extraction.md, extrae el JSON de SPEC §6.3. Valida
   con zod. Nunca inventes precios ni cantidades: si falta algo, va en needs_clarification.
3. Relaciona customer_hint con los clientes de los últimos 30 días del negocio. Si hay
   más de uno posible, manda una lista interactiva para elegir. Si no hay ninguno, pregunta
   el nombre y el email del cliente.
4. Si needs_clarification no está vacío, pregunta al dueño en español, una cosa a la vez.
5. Crea la cotización en quotes con estado draft y numeración Q-0001 por negocio.
6. Responde con una vista previa en español: partidas, total y garantía.

Si el dueño manda otra nota de voz que dice "corrige..." o "cambia...", se aplica sobre el
borrador actual en lugar de crear uno nuevo.
```

## Día 8 — PDF y página pública

```
1. Crea la función de Vercel /api/quote-pdf (Node, @react-pdf/renderer) que genere el PDF
   de una cotización en inglés: datos del negocio, cliente, partidas, total, garantía,
   validez de 30 días y un enlace a la página pública. Guárdalo en Storage (bucket quotes-pdf)
   y actualiza pdf_path. Protege la función con un secreto compartido.
2. Crea la página pública /q/:token (React), en inglés y pensada primero para celular:
   muestra la cotización usando get_public_quote, botón para descargar el PDF y botón Accept.
   Al abrirla por primera vez se marca viewed_at.
3. Crea la Edge Function quote-accept: valida el token, marca accepted y avisa al dueño
   con la plantilla cotizacion_aceptada.

Después de generar el borrador del Día 7, el dueño recibe el PDF por WhatsApp con los
botones "Enviar" y "Corregir".
```

## Día 9 — Envío al cliente (momento 2)

```
Botón "Enviar" en WhatsApp:
- Si falta el email del cliente, pídeselo al dueño primero.
- Envía el email con Resend desde el dominio del producto, en inglés, con nombre del negocio
  como remitente visible, un texto corto y el enlace a /q/:token. Reply-to: el email del
  dueño si lo tenemos.
- Marca la cotización como sent y registra todo en messages.
- Confirma al dueño: "Enviada a Sarah ✉️ Te aviso cuando la abra o la acepte."

Criterio de terminado: nota de voz → PDF → Enviar → email recibido → Accept → WhatsApp de
"¡Aceptó!" al dueño. Todo en menos de 2 minutos sin tocar el admin.
```

## Día 10 — Seguimiento y reporte semanal (momento 3)

```
1. Crea la Edge Function followups y prográmala con pg_cron cada hora:
   cotizaciones sent sin aceptar después de 3 días y con followup_count = 0 → manda un
   recordatorio amable por email al cliente, suma followup_count y avisa al dueño con
   la plantilla seguimiento_enviado. Respeta la zona horaria del negocio: solo envía entre
   9 a.m. y 6 p.m. hora local.
2. Crea la Edge Function weekly-report y prográmala los lunes a las 8 a.m. hora local de
   cada negocio: llamadas contestadas, llamadas urgentes, cotizaciones enviadas, aceptadas
   y monto aceptado, con la plantilla reporte_semanal.
```

## Día 11 — Cobro

```
Consulta la documentación actual de Stripe (Checkout de suscripciones y webhooks).

- Crea el producto "Socio Base" a $199 USD al mes con 14 días de prueba.
- En /admin, botón "Generar link de pago" por negocio (Stripe Checkout). El link se lo
  mandamos al dueño por WhatsApp.
- Edge Function stripe-webhook (firma verificada, idempotente) que actualiza
  subscription_status y trial_ends_at.
- Si la suscripción está canceled o past_due por más de 7 días, el asistente sigue
  contestando, pero el dueño recibe un aviso para pagar. No cortamos el servicio sin avisar.
```

## Día 12 — Demo y pruebas

```
1. Crea un script de seed para el negocio demo "Martinez Roofing" (Houston, TX) con
   servicios de techado y rangos de precio realistas.
2. Escribe TESTING.md con un guion de 20 llamadas de prueba: distintos acentos, ruido de
   fondo, gente que no da su nombre, que habla español, spam, emergencias y llamadas que
   cuelgan a la mitad. Incluye qué debe pasar en cada una.
3. Revisa todo el proyecto contra los criterios de SPEC §9 y dime qué falta o qué falla.
```

---

## Después del MVP

No construyas nada de v2 (SPEC §4.2) hasta tener **5 negocios pagando**. Lo que pidan ellos
decide qué sigue.
