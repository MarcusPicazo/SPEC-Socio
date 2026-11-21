# ENCENDIDO.md — de "código listo" a "primera llamada real"

Meta: que alguien llame al número de **Martinez Roofing**, conteste la IA y en menos de
60 segundos te llegue el resumen por WhatsApp con los botones *Confirmar cita* y
*Lo llamo yo* (SPEC §2, momento 1).

Todo se hace **sin terminal**: sacas llaves en los paneles, las pegas en GitHub y en
Vercel, y aprietas botones de GitHub Actions.

> ⚠️ **Antes de empezar:** los workflows solo aparecen en la pestaña **Actions** cuando
> el PR que los trae ya está fusionado en `main`. Fusiona primero ese PR.

---

## 0. Estado del código (revisión del 2026-11-21)

| Revisión | Resultado |
|---|---|
| Pruebas de Edge Functions (`deno task test`, Deno 2.9.6) | ✅ **149 de 149 pasan** |
| `deno check` de las 10 Edge Functions | ✅ las 10 limpias |
| `npm run typecheck` y `typecheck:api` | ✅ sin errores |
| `npm run lint` | ✅ 0 errores · 6 avisos menores (`react-refresh`) |
| `npm run build` | ✅ compila |
| Workflows de GitHub (`actionlint`) | ✅ sin errores |
| `npm test` (vitest) | ✅ 9 de 9 pasan (ya solo corre las pruebas de `src/`) |
| Pruebas SQL (`scripts/test-sql.sh`, Postgres 16 local) | ✅ conteo de minutos: no cuenta doble, segundos exactos, ciclo de prueba y ciclo pagado |
| Código vs. documentación de Vapi, Meta, Supabase, Twilio y Stripe | ✅ revisado; lo que no coincidía ya está corregido (ver §8) |

---

## 1. Resumen en tres columnas

| # | Paso | ✅ En el código | 👆 Tú en un panel | 🤖 Automático |
|---|---|---|---|---|
| 1 | Sacar las llaves | — | §2: Supabase, Twilio, Anthropic, Vapi, Meta | — |
| 2 | Pegarlas en GitHub | Los workflows las leen | §3: una por una en *Secrets* | — |
| 3 | Pegar 2 variables en Vercel | El frontend ya está desplegado | §4 | Redeploy automático al hacer push |
| 4 | Tablas, secretos y funciones en Supabase | 17 migraciones, 10 funciones, `config.toml` | — | **Workflow "Desplegar Supabase"** (§5.1) |
| 5 | Vault para los cron jobs | Migraciones 13–15 | 3 líneas de SQL (§5.2) | — |
| 6 | Tu usuario de `/admin` | Tabla `operators` | Crear el usuario y 1 línea de SQL (§5.3) | — |
| 7 | Webhook de Meta | Verificación y firma | Pegar URL y token (§5.4) | — |
| 8 | Plantillas de WhatsApp | Variables limpias y en orden | Registrar `nueva_llamada` (§5.5) y después las demás (texto en §7) | — |
| 9 | Crear Martinez Roofing | Script idempotente | — | **Workflow "Sembrar negocio demo"** (§5.6) |
| 10 | Activar la línea | `provision-business` crea el asistente | Un clic en `/admin` (§5.7) | — |
| 11 | Abrir la ventana de 24 h | Registra el mensaje | Mandar "Hola" (§5.8) | — |
| 12 | **Primera llamada** | Todo el flujo | Llamar y revisar (§5.9) | — |

---

## 2. Cómo sacar cada llave (con cada clic)

Ve anotando cada valor en un bloc de notas **privado** (nunca en el chat ni en GitHub
como archivo). Al final todos terminan en GitHub → Secrets (§3).

### 2.1 Supabase (4 valores)

1. **`SUPABASE_PROJECT_REF`**: supabase.com → tu proyecto → **Project Settings**
   (engrane abajo a la izquierda) → **General** → **Project ID** → copiar. Son 20 letras y
   números, sin `https://`.
2. **`SUPABASE_DB_PASSWORD`**: la contraseña que pusiste al crear el proyecto. Si no la
   recuerdas: **Project Settings → Database → Reset database password** → copia la nueva.
3. **`SUPABASE_ACCESS_TOKEN`**: tu avatar (arriba a la derecha) → **Account preferences**
   → **Access Tokens** → **Generate new token** → nombre `github-socio` → copiar. Solo se
   muestra una vez. 🔎 Si te deja elegir permisos, dale acceso a este proyecto con
   lectura de *Project Settings*, *API Keys* y *API Key Secrets* (lo que pide la
   documentación de Supabase), y escritura de base de datos, Edge Functions y secretos.
4. **`SUPABASE_SERVICE_ROLE_KEY`** (para el workflow del negocio demo y para Vercel):
   **Project Settings → API Keys** → pestaña **Legacy API keys** → `service_role` →
   **Reveal** → copiar (empieza con `eyJ`). Esta llave salta todas las reglas de
   seguridad: nunca va al frontend.
5. Ya que estás ahí, copia también la **`anon`** (empieza con `eyJ`) o la
   **publishable** (`sb_publishable_...`). Va en Vercel (§4) y en Vault (§5.2).

### 2.2 Twilio (2 valores + el número)

1. console.twilio.com → crea la cuenta o entra.
2. **Pasa la cuenta a pago** (**Upgrade**, unos $20 de saldo). Confirmado en la
   documentación de Twilio: con cuenta de prueba **solo números verificados pueden llamar
   a tu número de Twilio**, y la prueba vence a los 30 días. Un prospecto no podría llamar.
3. **Phone Numbers → Manage → Buy a number** → United States → lada `713`, `832`, `281` o
   `346` (Houston) → marca **Voice** → **Search** → **Buy**. Anota el número: `+1713...`.
4. En la portada de la consola, **Account Info** → copia **Account SID** →
   `TWILIO_ACCOUNT_SID`, y **Auth Token** (clic en *Show*) → `TWILIO_AUTH_TOKEN`.

### 2.3 Anthropic (1 valor)

console.anthropic.com → **API Keys** → **Create Key** → nombre `socio-supabase` →
copiar (`sk-ant-...`) → `ANTHROPIC_API_KEY`. Revisa en **Billing** que haya saldo.

### 2.4 Vapi (3 valores)

1. dashboard.vapi.ai → crea la cuenta.
2. **`VAPI_API_KEY`**: menú izquierdo → **API Keys** (en *Organization*) → copia la
   **Private Key**. (La *Public Key* no sirve.)
3. **`VAPI_SERVER_SECRET`**: invéntalo tú: 40 letras y números al azar, sin comillas ni
   espacios.
4. **`VAPI_SERVER_CREDENTIAL_ID`** (nuevo, lo pide la documentación actual de Vapi):
   - Menú izquierdo → **Integrations** → **Server Configuration** → **Add Custom
     Credential**.
   - **Authentication Type:** *Bearer Token*.
   - **Credential Name:** `socio-voice-webhook`.
   - **Token:** pega el mismo `VAPI_SERVER_SECRET` del punto 3.
   - **Header Name:** deja `Authorization`. **Include Bearer Prefix:** encendido.
   - **Save** → copia el **ID** de la credencial (empieza con algo como `cred_...` o es
     un UUID).
5. Opcional: en **Integrations** puedes conectar tus propias llaves de Anthropic o de
   Deepgram. Según la documentación de Vapi no hace falta: sin ellas, Vapi usa su
   integración por defecto y te cobra en tus créditos de Vapi.

### 2.5 Meta / WhatsApp (4 valores + 1 inventado)

Para la primera llamada usa el **número de prueba gratis** de Meta.

1. developers.facebook.com → **My Apps** → **Create App** → caso de uso
   **Connect with customers through WhatsApp** → elige o crea tu portafolio comercial →
   **Create app**.
2. En la app: **WhatsApp → API Setup**:
   - **From:** deja el *Test number*.
   - **To:** **Manage phone number list** → agrega **tu celular** → confirma con el código
     que te llega. Ese número será el dueño de Martinez Roofing.
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   - **WhatsApp Business Account ID** → `WHATSAPP_BUSINESS_ACCOUNT_ID`.
   - **Temporary access token** → `WHATSAPP_ACCESS_TOKEN` (dura 24 h; el permanente está
     en §6).
3. **App settings → Basic** → **App secret** → **Show** → `WHATSAPP_APP_SECRET`.
4. **`WHATSAPP_VERIFY_TOKEN`**: invéntalo (ej. `socio-verifica-8k2x`).

### 2.6 Inventados por ti (2 valores)

- **`CRON_SECRET`**: otra cadena larga al azar. Va también en Vault (§5.2).
- **`QUOTE_PDF_SHARED_SECRET`**: otra cadena larga al azar (para el momento 2; va en
  GitHub y en Vercel con el mismo valor).

---

## 3. Cómo pegarlas en GitHub

GitHub no deja abrir *Settings* desde la app del celular. En el navegador del celular,
activa **"Ver como computadora"** (o usa una compu).

1. github.com/MarcusPicazo/SPEC-Socio → pestaña **Settings** (arriba a la derecha).
2. Menú izquierdo → **Secrets and variables** → **Actions**.
3. Pestaña **Secrets** → botón verde **New repository secret**.
4. **Name:** el nombre exacto de la tabla (en mayúsculas, con guion bajo). **Secret:** el
   valor, sin espacios antes o después y sin comillas.
5. **Add secret**. Repite con cada uno.

Si te equivocas: en la lista, el lápiz ✏️ del secreto → pega el valor nuevo →
**Update secret**. GitHub nunca vuelve a mostrar el valor; eso es normal.

### Obligatorios para la primera llamada

Si falta uno, el workflow "Desplegar Supabase" dice cuál y **no despliega nada**.

| Nombre | De dónde sale |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | §2.1.3 |
| `SUPABASE_PROJECT_REF` | §2.1.1 |
| `SUPABASE_DB_PASSWORD` | §2.1.2 |
| `TWILIO_ACCOUNT_SID` | §2.2.4 |
| `TWILIO_AUTH_TOKEN` | §2.2.4 |
| `VAPI_API_KEY` | §2.4.2 |
| `VAPI_SERVER_SECRET` | §2.4.3 |
| `VAPI_SERVER_CREDENTIAL_ID` | §2.4.4 |
| `WHATSAPP_ACCESS_TOKEN` | §2.5.2 |
| `WHATSAPP_PHONE_NUMBER_ID` | §2.5.2 |
| `WHATSAPP_APP_SECRET` | §2.5.3 |
| `WHATSAPP_VERIFY_TOKEN` | §2.5.4 |
| `ANTHROPIC_API_KEY` | §2.3 |
| `CRON_SECRET` | §2.6 |

### Para el workflow "Sembrar negocio demo"

| Nombre | De dónde sale |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | §2.1.4 |

### Después (momentos 2 y 3): se suben solos cuando existan

`WHATSAPP_BUSINESS_ACCOUNT_ID`, `DEEPGRAM_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `APP_BASE_URL`,
`QUOTE_PDF_SHARED_SECRET`. Cómo sacarlos: §6.

### Ajustes opcionales (solo si quieres cambiar el valor por defecto)

`VAPI_ASSISTANT_MODEL_PROVIDER`, `VAPI_ASSISTANT_MODEL`, `VAPI_VOICE_PROVIDER`,
`VAPI_VOICE_ID` (por defecto `Clara`), `WHATSAPP_API_VERSION` (por defecto `v27.0`),
`CALL_SUMMARY_MODEL`, `QUOTE_EXTRACTION_MODEL`, `STRIPE_API_VERSION`.

---

## 4. Cómo pegarlas en Vercel

vercel.com → tu proyecto → **Settings** → **Environment Variables**. Para cada una:
**Key** = nombre, **Value** = valor, marca **Production** y **Preview** → **Save**.

**Para la primera llamada (frontend, `/admin`):**

| Key | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://<SUPABASE_PROJECT_REF>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | la `anon` o *publishable* de §2.1.5 (esta sí es pública) |

**Para el PDF de cotizaciones (momento 2):**

| Key | Valor |
|---|---|
| `SUPABASE_URL` | `https://<SUPABASE_PROJECT_REF>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | §2.1.4 |
| `APP_BASE_URL` | tu dominio de Vercel, ej. `https://socio.vercel.app` |
| `QUOTE_PDF_SHARED_SECRET` | el mismo de §2.6 |

Después: **Deployments** → el último → menú **⋯** → **Redeploy**. Las variables `VITE_`
se leen al compilar; sin redeploy no se aplican.

**Cómo verificas:** abre `https://<tu-dominio>/admin`. Debe salir la pantalla de login.

---

## 5. Encender, en orden

### 5.1 Workflow "Desplegar Supabase" 🤖

GitHub → pestaña **Actions** → en la lista de la izquierda **Desplegar Supabase** →
botón **Run workflow** (derecha) → rama `main` → **Run workflow** verde.

Hace, en este orden, y se detiene en el primer error:
1. Revisa que estén los 14 secretos obligatorios. Si falta alguno, lo dice por nombre y
   **no toca nada**.
2. Corre las 149 pruebas y revisa los tipos de las 10 funciones. Si algo falla, no despliega.
3. Aplica las 17 migraciones (`supabase db push`).
4. Sube los secretos a Supabase (sin imprimirlos nunca).
5. Despliega las 10 Edge Functions con `verify_jwt` de `config.toml`.

También corre **solo** cada vez que fusionas a `main` un cambio dentro de `supabase/`.

**Cómo verificas:** el run sale en verde ✅ y su resumen dice "🚀 Listo". En Supabase →
**Edge Functions** aparecen las 10.

⚠️ Si ya habías pegado migraciones a mano en el SQL Editor, `db push` va a intentar
correrlas otra vez y puede fallar con "already exists". Pídele a Claude en la nube que
haga un `migration repair`. No borres nada a mano.

### 5.2 Vault (SQL, una sola vez) 👆

Supabase → **SQL Editor** → **New query** → pega, cambia los 3 valores → **Run**:
```sql
select vault.create_secret('https://<SUPABASE_PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<anon o publishable de §2.1.5>', 'anon_key');
select vault.create_secret('<el mismo CRON_SECRET de §2.6>', 'cron_secret');
```
Según la documentación de Supabase, las funciones con `verify_jwt` aceptan tanto la
`anon` (JWT) como la *publishable*. Revisa con
`select jobname, schedule from cron.job;` que salgan 3 cron jobs.

### 5.3 Tu usuario de `/admin` 👆

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user** → tu
   email y una contraseña → marca **Auto Confirm User** → **Create user**.
2. SQL Editor → pega (cambia el email) → **Run**. Debe decir *1 row affected*:
   ```sql
   insert into public.operators (user_id, name)
   select id, 'Marcus' from auth.users where email = 'tu-email@ejemplo.com';
   ```

### 5.4 Webhook de Meta 👆

developers.facebook.com → tu app → **WhatsApp → Configuration** → **Webhook** →
**Edit**:
- **Callback URL:** `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token:** el `WHATSAPP_VERIFY_TOKEN`
- **Verify and save** → en **Webhook fields**, `messages` → **Subscribe**.

### 5.5 Plantilla `nueva_llamada` 👆

business.facebook.com → **WhatsApp Manager** → **Message templates** → **Create
template** → **Utility** → nombre `nueva_llamada` → idioma **Spanish (MEX)** → texto y
botones de §7 → **Submit**. Puede tardar hasta 24 h en aprobarse. No bloquea la primera
llamada si mandaste "Hola" en las últimas 24 h (§5.8).

### 5.6 Workflow "Sembrar negocio demo" 🤖

**Actions** → **Sembrar negocio demo** → **Run workflow** → llena:
- **DEMO_OWNER_WHATSAPP:** tu celular, el mismo de §2.5.2, ej. `+17135550123` o
  `+5215512345678` (con `+`, sin espacios).
- **DEMO_TWILIO_NUMBER:** el de §2.2.3.

→ **Run workflow**. El número se oculta en el log. Crea Martinez Roofing con servicios,
precios de referencia y horario; si lo vuelves a correr, actualiza el mismo negocio.

⚠️ La transferencia de emergencias marca al WhatsApp del dueño: en las pruebas de
emergencia sonará tu celular.

### 5.7 Activar la línea 👆

`/admin` → Martinez Roofing → **Activar línea**. Debe llenarse `vapi_assistant_id`, y en
`events` aparecer `business.provisioned`. En Vapi → **Assistants** sale "Martinez Roofing —
Recepcionista", y en **Phone Numbers** tu número ligado a él.

Si falla, `events` → `business.provision_failed` → `payload.error` trae la respuesta
exacta de Vapi. Si dice que falta `VAPI_SERVER_CREDENTIAL_ID`, revisa §2.4.4.

### 5.8 Abrir la ventana de 24 horas 👆

Desde tu celular, manda "Hola" por WhatsApp al número de prueba de Meta. Debe contestar
"No entendí ese mensaje 🤔…". Si contesta "Este número es solo para los dueños…", tu
número no coincide con el del negocio (revisa `+` y lada).

### 5.9 Primera llamada ☎️

Desde otro teléfono, llama al número de Twilio y sigue la prueba 1 de `TESTING.md`.

**Qué debe pasar:**
1. Saludo: *"Thanks for calling Martinez Roofing. This is Martinez Roofing's virtual
   assistant, and this call may be recorded…"* con la voz **Clara**.
2. Menos de 60 s después de colgar: WhatsApp con 📞 *Nueva llamada — …* y los botones.
3. Supabase → `calls`: una fila con `transcript`, `extracted` y `summary_es`.
4. `events`: `call.webhook_received` y `call.processed` con `whatsapp_sent: true`.

**Si no llega el WhatsApp**, revisa `events` en este orden:
- No hay `call.webhook_received`: Vapi → **Logs → Webhooks** muestra el código de
  respuesta. Si es 401, el *Token* de la credencial (§2.4.4) no es igual a
  `VAPI_SERVER_SECRET`.
- `call.unmatched_business`: el asistente o el número no coinciden con el negocio.
- `call.processed` con `whatsapp_sent: false`: lee `whatsapp_error`. Lo más común es que
  venció el token temporal de Meta.

---

## 6. Después de la primera llamada (momentos 2 y 3)

| Qué | 👆 Tú en un panel | Dónde lo pegas |
|---|---|---|
| **Token permanente de Meta** | business.facebook.com → **Settings → Users → System users** → **Add** (Admin) → **Assign assets**: app y WABA con control total → **Generate token** con `whatsapp_business_messaging` y `whatsapp_business_management`, sin vencimiento | GitHub `WHATSAPP_ACCESS_TOKEN` → correr "Desplegar Supabase" |
| **Número real de WhatsApp** | WhatsApp Manager → **Phone numbers → Add phone number** (requiere la verificación del negocio en **Security Center**) | GitHub `WHATSAPP_PHONE_NUMBER_ID` |
| **Las otras 5 plantillas** | Igual que §5.5, texto en §7 | — |
| **Deepgram** | console.deepgram.com → **API Keys → Create a New API Key** | GitHub `DEEPGRAM_API_KEY` |
| **Resend** | resend.com → **Domains → Add Domain** → copia los DNS a tu dominio → **Verify** → **API Keys → Create API Key** | GitHub `RESEND_API_KEY`; `RESEND_FROM_EMAIL` = `quotes@tu-dominio` |
| **Stripe: llave** | dashboard.stripe.com (modo **Test**) → **Developers → API keys** → **Secret key** → Reveal | GitHub `STRIPE_SECRET_KEY` |
| **Stripe: precio** 🤖 | **Actions → Configurar Stripe → Run workflow**. Imprime solo el `STRIPE_PRICE_ID` (también en el resumen del run) | GitHub `STRIPE_PRICE_ID` |
| **Stripe: webhook** | **Developers → Webhooks → Add endpoint** → URL `https://<ref>.supabase.co/functions/v1/stripe-webhook` → eventos `customer.subscription.created`, `.updated`, `.deleted` → **Signing secret** | GitHub `STRIPE_WEBHOOK_SECRET` |
| **Dominio de la app** | El de Vercel | GitHub `APP_BASE_URL` y Vercel (§4) |
| **Subirlo todo** 🤖 | **Actions → Desplegar Supabase → Run workflow** | — |
| **Desvío del celular del dueño** | Desvío condicional al número de Twilio, según su compañía (SPEC §5.2) | — |

---

## 7. Texto exacto de las plantillas de WhatsApp

Categoría **Utility**, idioma **Spanish (MEX)** (`es_MX`). El orden de las variables
tiene que ser exactamente este (`_shared/whatsapp-templates.ts`). Meta pide un ejemplo
para cada variable; se ponen al registrar la plantilla.

**`nueva_llamada`**: botones de tipo **Quick reply**, en este orden: `Confirmar cita`,
`Lo llamo yo`
```
📞 Nueva llamada — {{1}}
{{2}}
Tel: {{3}} · {{4}}
Prefiere: {{5}}
```
Ejemplos: Sarah Miller · Gotera en el techo, entra agua en la recámara. Urgente. ·
+17135550142 · 4512 Oak St, Houston · jueves en la mañana

**`cotizacion_aceptada`**
```
🎉 {{1}} aceptó tu cotización de {{2}}.
```
Ejemplos: Sarah Miller · $9,500.00

**`seguimiento_enviado`**
```
📨 Le mandé un recordatorio a {{1}} sobre la cotización {{2}} ({{3}}).
```
Ejemplos: Sarah Miller · Q-0001 · $9,500.00

**`reporte_semanal`**
```
📊 Reporte semanal — {{1}}
Llamadas contestadas: {{2}}
Urgentes: {{3}}
Cotizaciones enviadas: {{4}}
Aceptadas: {{5}}
Monto aceptado: {{6}}
```
Ejemplos: Martinez Roofing · 12 · 3 · 5 · 2 · $14,200.00

**`link_de_pago`**
```
💳 Hola {{1}}, aquí está tu link para activar tu suscripción a Socio (14 días de prueba gratis): {{2}}
```
Ejemplos: Carlos · https://checkout.stripe.com/c/pay/cs_test_ejemplo

**`pago_pendiente`**
```
⚠️ Hola {{1}}, tu suscripción a Socio está {{2}} desde hace más de 7 días. Tu línea sigue funcionando normalmente — no hemos cortado el servicio. Actualiza tu pago aquí: {{3}}
```
Ejemplos: Carlos · vencida · https://billing.stripe.com/p/session/ejemplo

**`aviso_minutos`**: aviso al dueño al 80 % de sus minutos (prueba o mes) y al 100 % del
mes pagado. Sin botones.
```
⏳ Hola {{1}}, llevas {{2}} de {{3}} minutos {{4}}.
{{5}}
Cualquier duda, responde este mensaje.
```
Ejemplos: Carlos · 120 · 150 · de tu prueba · Tu línea sigue funcionando normal ✅

(En el aviso del 100 % del mes, `{{4}}` es `de este mes` y `{{5}}` es
`Tu línea sigue funcionando. Cada minuto extra cuesta $0.25 USD.`)

**`tope_prueba`**: la prueba llegó a 150 minutos. Un botón de tipo **Quick reply**:
`Empezar mi plan hoy`. Tocarlo cobra $199 USD ese mismo día (sin segunda confirmación).
También se usa para el único recordatorio de 24 h si el dueño no responde.
```
🚦 Hola {{1}}, ya usaste {{2}} de tus 150 minutos de prueba. Tu línea sigue funcionando.

Si quieres empezar tu plan, toca el botón. Se cobran $199 USD hoy y tu plan empieza ya, con 500 minutos al mes.
```
Ejemplos: Carlos · 150

> Si Meta rechaza `aviso_minutos` porque `{{5}}` es una línea completa, cámbiala por una
> frase fija (por ejemplo "Tu línea sigue funcionando.") y avísale a Claude para que el
> código mande 4 variables en vez de 5.

> Estos textos copian los mensajes libres que ya manda el código, para que el dueño lea
> lo mismo dentro y fuera de la ventana de 24 h. Si Meta te pide cambiar una palabra,
> no pasa nada mientras no cambie el **número ni el orden** de las variables.

---

## 8. Documentación consultada (2026-11-20) y qué se corrigió

| Servicio | Páginas | Resultado |
|---|---|---|
| **Vapi** | `docs.vapi.ai/api-reference/assistants/create`, `/server-url/server-authentication`, `/server-url/events`, `/api-reference/webhooks/server-message`, `/assistants/call-analysis`, `/api-reference/phone-numbers/create`, `/phone-numbers/import-twilio`, `/tools/transfer-call` y `/setup`, `/providers/model/anthropic`, `/providers/transcriber/deepgram`, `/providers/voice/vapi-voices` | ❌→✅ `server.secret` ya no existe: ahora `server.credentialId` (nuevo `VAPI_SERVER_CREDENTIAL_ID`). ❌→✅ La voz `Paige` fue retirada: default `Clara`. ✅ El lector del fin de llamada sigue el esquema documentado (`analysis`, `customer` y `phoneNumber` al nivel del mensaje). ✅ Importar el número de Twilio: campos correctos. ✅ `transferCall`: formato correcto; termina con `assistant-forwarded-call`, que no confirma que el dueño contestó (ya lo manejábamos así). ✅ `claude-haiku-4-5-20251001` y Deepgram `nova-3` + `multi` soportados. ⚠️ `analysisPlan.structuredDataPlan` está *deprecated*, pero "sigue funcionando" (§9) |
| **WhatsApp Cloud API** | `developers.facebook.com/documentation/business-messaging/whatsapp/`: `messages/send-messages`, `messages/interactive-reply-buttons-messages`, `templates/overview`, `templates/components`, `webhooks/reference/messages/button` e `/interactive`; `docs/whatsapp/cloud-api/support/error-codes` | ✅ Ventana de 24 h: se reinicia con cada mensaje del dueño, como asume el código. ✅ Botones de respuesta: máximo 3, título ≤ 20 caracteres. ✅ Variables posicionales `{{1}}…`. ❌→✅ Graph API `v27.0` (los ejemplos ya no usan v26). ❌→✅ Variables de plantilla limpiadas (error 132018) |
| **Supabase** | `supabase.com/docs/guides/functions/deploy`, `/functions/secrets`, `/functions/function-configuration`, `/deployment/managing-environments`, `/api/api-keys`, referencia de la CLI (`supabase.com/llms/cli.txt`) | ✅ `verify_jwt` en `config.toml`. ✅ GitHub Actions con `supabase/setup-cli@v1`. ✅ CLI v3: `supabase link <ref>`, `db push --remote --yes`, `secrets set --env-file`; `--project-ref` ya es obsoleto. ❌→✅ Si apagas las llaves legacy, las funciones usan `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS`. ✅ Los nombres de secretos no pueden empezar con `SUPABASE_` (no lo hacemos) |
| **Twilio** | `twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account` | ✅ Confirma que hay que pasar a pago: con cuenta de prueba solo llaman números verificados |
| **Stripe** (2026-11-21) | `docs.stripe.com/billing/subscriptions/trials/free-trials`, `/billing/subscriptions/trials/compare`, `/billing/subscriptions/trials`, `/billing/subscriptions/change-price`, `/billing/subscriptions/billing-mode/compare`, `/billing/subscriptions/usage-based-legacy/pricing-models` | ✅ Checkout ya pedía tarjeta (`payment_method_collection` es `always` por defecto); ahora está explícito, y si la prueba termina sin tarjeta, se cancela (`missing_payment_method: 'cancel'`). ✅ 14 días con `trial_period_days`: el primer cobro cae el día 15. ✅ `trial_end: 'now'` termina la prueba y Stripe cobra en ese momento; si la tarjeta falla, queda `past_due`. ✅ Las fechas del ciclo ahora vienen en `items.data[0].current_period_*`. ⏳ Minutos extra: Stripe no cobra el uso de la prueba; el cobro se hará con un precio medido por escalones (ver §9) |

---

## 9. Pendientes conocidos (no bloquean la primera llamada)

1. **🔎 La regla exacta de los saltos de línea no está en las páginas actuales de Meta.**
   Solo aparece el error genérico 132018 ("problema con los parámetros"). La limpieza se
   aplica igual, por seguridad. Se confirma con la primera llamada fuera de la ventana de
   24 h.
2. **🔎 Payload de los botones de plantilla.** La página del webhook de botones muestra
   `payload` con el texto del botón como ejemplo. El código manda un `payload` propio
   (`confirm:<id>`) al enviar la plantilla. Hay que confirmarlo con un toque real a
   *Confirmar cita* fuera de la ventana de 24 h.
3. **Datos estructurados de Vapi.** `analysisPlan` está *deprecated*; el reemplazo son los
   *structured outputs* (`artifactPlan.structuredOutputIds`). Migrar es una tarea
   aparte: hay que crear el *structured output* en Vapi y leer
   `artifact.structuredOutputs`.
4. **Cobro de minutos extra ($0.25 USD por minuto).** Hoy solo se cuentan y se le avisan
   al dueño; todavía no se cobran. La propuesta para la siguiente tarea: un segundo precio
   medido en la misma suscripción, por escalones (de 0 a 500 minutos a $0, del 501 en adelante a $0.25), y un evento de uso
   por llamada con el ID de la llamada para que no se cobre doble.
5. **Despliegue parcial.** Si una de las 10 funciones falla al desplegarse, las anteriores
   ya quedaron arriba. El workflow corre pruebas y `deno check` antes, para que eso sea
   muy raro.
6. **La transferencia de emergencias marca al `owner_whatsapp`.** Si algún dueño usa
   WhatsApp en otro número, hace falta un campo aparte.
7. **Lint:** 6 avisos cosméticos de `react-refresh`.
8. **Avisos de minutos que fallan por WhatsApp no se reintentan.** El aviso del 80 % o del
   100 % se marca como enviado antes de mandarlo, para que nunca llegue doble. Si WhatsApp
   falla (por ejemplo, la plantilla todavía no está aprobada), queda en `events` con
   `whatsapp_sent: false` y se ve en la ficha del negocio en `/admin`.
9. **Confirmación cuando el operador termina la prueba.** Se manda como texto libre. Si la
   ventana de 24 h está cerrada no llega, y `/admin` te avisa para que le escribas tú.
