# TESTING.md — 20 llamadas de prueba (SPEC §9)

Guion para probar el negocio demo ("Martinez Roofing", ver `scripts/seed-demo-business.ts`)
contra los criterios de terminado de SPEC §9. Cada llamada se hace al número de Twilio del
negocio demo, después de "Activar línea" desde `/admin`.

## Antes de empezar

- Ten el celular del dueño (el que configuraste como `owner_whatsapp`) a la mano y con el
  cronómetro listo — el criterio es **menos de 60 segundos** desde que cuelgas hasta que
  llega el WhatsApp.
- Abre Supabase Studio en dos pestañas: la tabla `calls` y la tabla `events`, ordenadas por
  `created_at` descendente, para ver cada fila aparecer en vivo.
- Anota el número de teléfono desde el que llamas en cada caso — varias pruebas dependen de
  reconocerlo.
- Nadie puede fingir un acento o ruido de fondo perfectamente por escrito; la columna
  "Cómo simularlo" da una forma concreta de generar la condición real con un teléfono
  normal, no una aproximación de lo que "debería" sonar.

## Las 20 llamadas

### 1. Caso base — emergencia en inglés, con todos los datos
**Cómo simularlo:** habla en inglés claro. Di que tienes una gotera activa, que está
entrando agua a una recámara, da nombre, teléfono, dirección y que prefieres el jueves en
la mañana.
**Qué debe pasar:**
- El asistente se presenta como virtual y avisa que la llamada puede grabarse (saludo exacto de SPEC §7).
- Ofrece transferir al celular del dueño (emergencia real: inundación).
- `calls.extracted`: `urgency: "emergency"`, `language: "en"`, `is_spam: false`, `caller_name`, `callback_number`, `address` y `preferred_time` llenos.
- WhatsApp al dueño en <60s con resumen en español y botones *Confirmar cita* / *Lo llamo yo*.
- Evento `call.emergency_transferred` en `events` si la transferencia se intentó.

### 2. Solicitud no urgente, sin emergencia
**Cómo simularlo:** en inglés, pide una inspección de techo "whenever is convenient", sin prisa.
**Qué debe pasar:**
- `urgency: "flexible"`, no se ofrece transferencia.
- WhatsApp llega igual, sin botones de emergencia (ni aplica aquí, solo para llamadas con transferencia real).

### 3. Español, con acento mexicano
**Cómo simularlo:** llama y habla en español desde el saludo.
**Qué debe pasar:**
- El asistente cambia a español de inmediato (nunca pregunta dos veces el idioma).
- `extracted.language: "es"`, `is_spam: false`.
- El resumen por WhatsApp sigue siendo en español (ya lo es siempre para el dueño).

### 4. Acento regional marcado (sureño/tejano)
**Cómo simularlo:** pide a alguien con acento muy marcado (o exagera vocales/cadencia) que
llame y describa una reparación de canaleta.
**Qué debe pasar:**
- La transcripción puede tener errores menores, pero `service_type`/`description` deben
  reflejar canaleta, no datos inventados de otro servicio.
- Si algún campo queda ambiguo, debe quedar `null`, nunca un valor adivinado.

### 5. Ruido de fondo fuerte
**Cómo simularlo:** llama desde el coche con la ventana abajo, o pon un ventilador/radio
cerca del micrófono.
**Qué debe pasar:**
- La llamada no se corta ni falla; `calls.transcript` puede ser imperfecto pero debe existir.
- Si no se entendió bien algún dato, ese campo queda `null` — nunca inventado.
- Igual llega el WhatsApp (con los datos que sí se entendieron).

### 6. Quien llama no quiere dar su nombre
**Cómo simularlo:** cuando pregunte tu nombre, responde "prefiero no decirlo" o cambia de tema.
**Qué debe pasar:**
- `caller_name: null` — el asistente sigue adelante sin insistir agresivamente.
- El resto de los datos (teléfono, dirección, necesidad) se recopila igual si se dan.
- El WhatsApp debe mostrar algo razonable para "sin nombre" (revisa que no diga "null" ni "undefined" literal).

### 7. Cuelga a la mitad de dar sus datos
**Cómo simularlo:** después de decir tu nombre y antes de dar el teléfono, cuelga de golpe.
**Qué debe pasar:**
- Vapi manda igual su `end-of-call-report`; `voice-webhook` no debe tronar.
- Se guarda una fila en `calls` con los campos que alcanzó a dar y el resto en `null`.
- Debe llegar WhatsApp igual (con lo poco que se alcanzó a capturar) — nunca quedarse calles sin avisar por un corte abrupto.

### 8. Spam / robollamada obvia
**Cómo simularlo:** simula una llamada grabada pidiendo "press 1 to lower your credit card interest rate" o similar pitch de telemarketing.
**Qué debe pasar:**
- `is_spam: true`.
- `calls.status: "ignored"`.
- **No debe llegar ningún WhatsApp al dueño.**
- Revisa el evento `call.ignored_spam` en `events`.

### 9. Silencio total / "butt dial"
**Cómo simularlo:** marca y no digas nada, deja la línea en silencio unos segundos y cuelga.
**Qué debe pasar:**
- No debe tronar la función con un payload casi vacío.
- Lo esperable es `is_spam: true` o una extracción casi toda en `null` — en cualquier caso, sin WhatsApp si quedó marcado como spam.
- Debe quedar una fila en `calls` de todas formas (nunca se pierde el registro, aunque esté vacío).

### 10. Emergencia real — inundación activa
**Cómo simularlo:** en inglés, di que se está inundando la cocina ahora mismo por una tubería rota.
**Qué debe pasar:**
- Ofrece transferir al celular del dueño.
- `urgency: "emergency"`.
- Si el dueño no contesta la transferencia, igual debe llegar el resumen por WhatsApp (la transferencia no reemplaza el resumen).

### 11. Olor a gas — NUNCA transferencia, siempre 911
**Cómo simularlo:** di que hueles gas en la cocina.
**Qué debe pasar:**
- El asistente debe decir claramente que colguemos y llamemos al 911 — **no** debe ofrecer transferir la llamada al dueño (SPEC §7: gas/riesgo de vida es siempre 911, no transferencia).
- Esta es la prueba más importante de seguridad del guion — si transfiere en vez de mandar a 911, es un defecto crítico que hay que corregir en `prompts/receptionist.md` antes de lanzar.

### 12. Pregunta de precio — nunca una cifra exacta
**Cómo simularlo:** pregunta "how much would a full roof replacement cost?".
**Qué debe pasar:**
- El asistente da el **rango** configurado ($8,000–$16,000), nunca un número exacto, y aclara que el dueño confirma el precio final.
- No debe prometer una fecha/hora exacta de visita tampoco.

### 13. Pregunta de horario y zona de servicio
**Cómo simularlo:** pregunta "what are your hours?" y "do you cover Katy?".
**Qué debe pasar:**
- Responde con el horario configurado y "Houston, TX and the surrounding area" — datos reales del negocio, no inventados.

### 14. Español, acento marcado, tono urgente (daño por tormenta)
**Cómo simularlo:** en español, con acento marcado y tono apurado, describe daño de una tormenta reciente.
**Qué debe pasar:**
- Cambia a español, `language: "es"`.
- `urgency: "emergency"` o `"soon"` según lo que digas, `is_spam: false`.
- Prueba combinada: idioma + acento + urgencia a la vez.

### 15. Habla muy rápido / murmura
**Cómo simularlo:** habla atropelladamente o bajando la voz a propósito.
**Qué debe pasar:**
- Es aceptable que algunos campos queden `null` por no entenderse bien.
- No debe inventar un dato para "rellenar" lo que no se entendió.
- La llamada no debe durar fuera del rango de 1–3 minutos solo por pedir que repita todo.

### 16. Número equivocado / confundido
**Cómo simularlo:** pregunta "is this Domino's Pizza?" y cuelga confundido cuando te digan que no.
**Qué debe pasar:**
- No es spam real, pero tampoco es un lead — `is_spam` probablemente `false`, con `service_type`/`description` vacíos o reflejando la confusión.
- Es aceptable que llegue un WhatsApp de bajo valor; lo importante es que no truene nada y que no se invente una necesidad que nunca se mencionó.

### 17. Spam internacional con voz robótica
**Cómo simularlo:** simula una voz sintetizada ofreciendo seguro de auto o una "oferta especial".
**Qué debe pasar:**
- `is_spam: true`, sin WhatsApp al dueño — igual que la prueba 8, pero confirma que distintos tipos de spam (no solo telemarketing típico) se detectan igual.

### 18. Horario de callback muy específico
**Cómo simularlo:** di "call me back after 5pm today, I'll be at work until then".
**Qué debe pasar:**
- `preferred_time` debe capturar la instrucción (no solo "later" genérico, sino la referencia a la hora si el modelo la retiene).

### 19. Segunda llamada del mismo número (cliente recurrente)
**Cómo simularlo:** repite la prueba 1 o 2 minutos después, desde el mismo teléfono que usaste en alguna prueba anterior con nombre.
**Qué debe pasar:**
- En `customers`, debe **actualizarse** el mismo registro (mismo `phone`), no crear un cliente duplicado.
- Si la primera llamada no dio nombre y esta sí, el nombre debe completarse sin borrar otros datos ya guardados.

### 20. Corte en los primeros segundos
**Cómo simularlo:** marca y cuelga antes de que el asistente termine el saludo.
**Qué debe pasar:**
- No debe tronar `voice-webhook` con un `end-of-call-report` casi vacío.
- Debe quedar alguna fila en `calls` (aunque casi todo en `null`) y no debe mandarse un WhatsApp con contenido sin sentido tipo "Cliente sin nombre — undefined".

## Después de las 20 llamadas

Estas tres cosas de SPEC §9 **no** se prueban llamando una vez — son pruebas aparte:

1. **Idempotencia del webhook.** Repite el mismo `end-of-call-report` que Vapi mandó para
   la llamada 1 (cópialo del log de Vapi, o del payload guardado en el evento
   `call.webhook_received`) con `curl` directo a `voice-webhook`, usando el mismo
   `provider_call_id`. Debe responder `{"ok":true,"duplicate":true}` y **no** debe
   aparecer una segunda fila en `calls` ni un segundo WhatsApp.
2. **Los tres momentos, diez veces seguidas.** Repite el ciclo completo de cada momento
   (llamada → resumen; nota de voz → cotización; seguimiento/aceptación) diez veces reales,
   en días distintos si se puede, y anota cualquier falla — un fallo ocasional en un
   servicio externo (Vapi, WhatsApp, Resend) cuenta como falla del criterio aunque el
   código esté bien, porque el criterio es sobre la experiencia real, no solo sobre la lógica.
3. **Latencia percibida del agente (<1s).** Esto se ajusta dentro de Vapi
   (`VAPI_ASSISTANT_MODEL`/`VAPI_VOICE_PROVIDER`/`VAPI_VOICE_ID` en `.env`), no en nuestro
   código — usa el panel de Vapi (Call Logs → latency breakdown) para ver en qué parte del
   pipeline (STT/LLM/TTS) se va el tiempo si se siente lento, y ajusta esas variables.

## Registro de resultados

| # | Escenario | Resultado | Notas |
|---|---|---|---|
| 1 | Emergencia en inglés, datos completos | ☐ Pasa ☐ Falla | |
| 2 | Solicitud flexible | ☐ Pasa ☐ Falla | |
| 3 | Español, acento mexicano | ☐ Pasa ☐ Falla | |
| 4 | Acento regional marcado | ☐ Pasa ☐ Falla | |
| 5 | Ruido de fondo | ☐ Pasa ☐ Falla | |
| 6 | No da su nombre | ☐ Pasa ☐ Falla | |
| 7 | Cuelga a la mitad | ☐ Pasa ☐ Falla | |
| 8 | Spam / robollamada | ☐ Pasa ☐ Falla | |
| 9 | Silencio total | ☐ Pasa ☐ Falla | |
| 10 | Emergencia — inundación | ☐ Pasa ☐ Falla | |
| 11 | Olor a gas → 911 | ☐ Pasa ☐ Falla | |
| 12 | Pregunta de precio | ☐ Pasa ☐ Falla | |
| 13 | Horario / zona de servicio | ☐ Pasa ☐ Falla | |
| 14 | Español + acento + urgencia | ☐ Pasa ☐ Falla | |
| 15 | Habla rápido / murmura | ☐ Pasa ☐ Falla | |
| 16 | Número equivocado | ☐ Pasa ☐ Falla | |
| 17 | Spam con voz robótica | ☐ Pasa ☐ Falla | |
| 18 | Horario de callback específico | ☐ Pasa ☐ Falla | |
| 19 | Cliente recurrente | ☐ Pasa ☐ Falla | |
| 20 | Corte en los primeros segundos | ☐ Pasa ☐ Falla | |
