# ENCENDIDO.md — de "código listo" a "primera llamada real"

Meta: que alguien llame al número de **Martinez Roofing**, conteste la IA y en menos de
60 segundos te llegue el resumen por WhatsApp con los botones *Confirmar cita* y
*Lo llamo yo* (SPEC §2, momento 1).

Todo se puede hacer **sin terminal en tu compu**: desde paneles web, desde GitHub o
pidiéndoselo a Claude Code en la nube. Donde DEPLOY.md dice "corre este comando", la
tabla del final te da el equivalente.

---

## 0. Estado del código (revisión del 2026-11-20)

| Revisión | Resultado |
|---|---|
| Pruebas de Edge Functions (`deno task test`, Deno 2.9.6) | ✅ **111 de 111 pasan**, 0 fallan (17 archivos de prueba) |
| `deno check` de las 9 Edge Functions | ✅ 8 limpias · ⚠️ `whatsapp-webhook` tiene 1 error de tipos (ver §6, hallazgo 1) |
| `npm run typecheck` (frontend) | ✅ sin errores |
| `npm run typecheck:api` (`/api/quote-pdf`) | ✅ sin errores |
| `npm run lint` | ✅ 0 errores · 6 avisos menores (`react-refresh/only-export-components`) |
| `npm run build` | ✅ compila (JS de 485 kB, 136 kB comprimido) |
| `npm test` (vitest) | ❌ 17 archivos en rojo: vitest intenta correr pruebas de Deno (`jsr:@std/assert`). No es un bug del producto; ver §6, hallazgo 4 |
| Edge Functions en el repo vs. DEPLOY.md | ✅ las 9 coinciden |
| Migraciones | ✅ 16, en orden; toda tabla de negocio tiene `business_id` y RLS |
| Plantillas de WhatsApp: código vs. DEPLOY.md | ✅ las 6 coinciden en nombre y número de variables. ⚠️ El texto exacto no estaba escrito en ningún lado; ahora está en §4 |
| `.env.example` vs. código | ✅ todas las variables que usa el código están. Detalles menores en §6 |

**Lo que no pude verificar:** la documentación de Vapi y la de Supabase. La red de este
entorno bloquea `docs.vapi.ai` y `supabase.com`, igual que cuando se escribió el código.
Los puntos que dependen de eso dicen **🔎 por verificar**, y la primera llamada sirve
para confirmarlos (paso 15).

---

## 1. Resumen en tres columnas

Columnas: **✅ En el código** (ya está hecho) · **👆 Tú en un panel** (clics, detalle en
§2) · **🤖 Automatizable** (Claude o GitHub lo pueden hacer por ti).

| # | Paso | ✅ En el código | 👆 Tú en un panel | 🤖 Automatizable |
|---|---|---|---|---|
| 1 | Tablas en Supabase | 16 migraciones con RLS | Pegarlas en el SQL Editor, en orden | GitHub Action con botón "Run workflow" (`supabase db push`) |
| 2 | Tu usuario de `/admin` | Login con email y contraseña; tabla `operators` | Crear el usuario en Auth y pegar 1 línea de SQL | — |
| 3 | Número de Twilio | Vapi lo importa solo al tocar "Activar línea" | Pasar la cuenta a pago y comprar un número de Houston | — |
| 4 | Llave de Anthropic | Haiku para el resumen | Crear la llave | — |
| 5 | Vapi | `provision-business` crea el asistente completo | Crear la cuenta, copiar la llave privada, conectar llaves de proveedores | — |
| 6 | WhatsApp (Meta) | Webhook con firma, botones e idempotencia | Crear la app, usar el número de prueba, copiar 4 valores | — |
| 7 | Secretos de las funciones | El código los lee y avisa si falta alguno | Pegarlos en Edge Functions → Secrets | Lo mismo desde el GitHub Action (`supabase secrets set`) |
| 8 | Desplegar 3 funciones | `config.toml` ya trae `verify_jwt = false` | — (el editor del panel no sirve: ver paso 8) | **Sí**: GitHub Action o Claude Code en la nube |
| 9 | Webhook de Meta | Responde al GET de verificación | Pegar la URL y el token; suscribir `messages` | — |
| 10 | Variables de Vercel | El frontend ya está desplegado | Pegar 2 variables y hacer Redeploy | — |
| 11 | Plantilla `nueva_llamada` | El código la usa fuera de la ventana de 24 h | Registrarla en WhatsApp Manager (texto en §4) | — |
| 12 | Crear Martinez Roofing | Formulario en `/admin` | Llenar el formulario (datos en el paso 12) | Alternativa: SQL listo en el paso 12 |
| 13 | Activar la línea | Botón "Activar línea" | Un clic | — |
| 14 | Abrir la ventana de 24 h | Registra el mensaje entrante | Mandar "Hola" desde tu celular | — |
| 15 | **Primera llamada** | Todo el flujo | Llamar y revisar `calls` y `events` | — |

---

## 2. Pasos en orden, con cada clic

> Ten a la mano un bloc de notas privado (no lo subas a GitHub) para ir guardando
> llaves. Al final del paso 7 todas terminan en Supabase.

### Paso 1 — Tablas en Supabase

**✅ Código:** `supabase/migrations/` (16 archivos).

**👆 Tú (hoy, sin terminal):**
1. supabase.com → tu proyecto → menú izquierdo **SQL Editor** → **New query**.
2. En GitHub abre `supabase/migrations/20261008000001_extensions.sql` → botón **Raw** →
   copia todo → pégalo en el SQL Editor → **Run**. Debe decir *Success*.
3. Repite con los 16 archivos **en orden de número** (del `...0001` al `...0016`).
4. Revisa en **Table Editor** que existan `businesses`, `customers`, `calls`, `quotes`,
   `messages`, `events`, `operators` y `quote_drafts`.
5. Vault (en el mismo SQL Editor, una sola vez). Esto es lo que usan los cron jobs:
   ```sql
   select vault.create_secret('https://<tu-project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<tu-anon-key>', 'anon_key');
   select vault.create_secret('<un-secreto-largo-que-tú-inventes>', 'cron_secret');
   ```
   - `<tu-project-ref>`: **Project Settings → General → Project ID**.
   - `<tu-anon-key>`: **Project Settings → API Keys**. 🔎 Si tu proyecto muestra llaves
     nuevas (`sb_publishable_...`), usa la de la pestaña **Legacy API keys** (`anon`, empieza
     con `eyJ`). Los cron jobs llaman a funciones que validan JWT, y la llave nueva no es un JWT.
   - Guarda el `cron_secret` en tu bloc: va igual en el paso 7 como `CRON_SECRET`.

   Para la primera llamada no hace falta, pero sin esto los 3 cron jobs fallan cada hora.

⚠️ Si aplicas las migraciones a mano, Supabase no las registra en su historial. Si más
adelante usas el GitHub Action con `db push`, va a intentar correrlas otra vez. Elige un
solo camino: o todo a mano, o todo con el Action desde el principio (recomendado, ver
paso 8).

**🤖 Automatizable:** el mismo GitHub Action del paso 8 puede correr `supabase db push`.

### Paso 2 — Tu usuario de operador para `/admin`

**✅ Código:** `/admin` solo deja entrar a quien está en la tabla `operators`. DEPLOY.md
no lo mencionaba.

**👆 Tú:**
1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Pon tu email y una contraseña. Marca **Auto Confirm User** → **Create user**.
3. SQL Editor → New query → pega esto (cambia el email) → **Run**:
   ```sql
   insert into public.operators (user_id, name)
   select id, 'Marcus' from auth.users where email = 'tu-email@ejemplo.com';
   ```
4. Debe decir *1 row affected*. Si dice 0, el email no coincide.

### Paso 3 — Número de Twilio

**✅ Código:** `provision-business` importa el número a Vapi con tu SID y tu token. No
tienes que configurar nada en Twilio a mano.

**👆 Tú:**
1. console.twilio.com → crea la cuenta o entra.
2. 🔎 **Pasa la cuenta a pago** (**Admin → Account billing → Upgrade**, unos $20 de saldo).
   En cuentas de prueba, quien llama escucha primero un aviso de "trial account" y tiene que
   presionar una tecla. Eso arruina la demo.
3. **Phone Numbers → Manage → Buy a number** → Country: United States → Number: `713`
   (o `832`, `281`, `346`, Houston) → marca **Voice** → **Search** → **Buy**.
4. Anota el número en formato `+1713XXXXXXX`.
5. En la página principal de la consola (**Account Info**) copia el **Account SID** y el
   **Auth Token** → bloc de notas.

### Paso 4 — Llave de Anthropic

**👆 Tú:** console.anthropic.com → **API Keys** → **Create Key** → nombre `socio-supabase`
→ copia la llave (`sk-ant-...`). Revisa en **Billing** que haya saldo.

Crea una segunda llave, `socio-vapi`, para el paso 5. Así puedes ver por separado cuánto
gasta cada lado.

### Paso 5 — Vapi

**✅ Código:** `provision-business` crea el asistente con el saludo exacto de SPEC §7, el
prompt de recepcionista, la transferencia de emergencias, la extracción estructurada y la
URL del webhook con su secreto. No se configura nada del asistente a mano.

**👆 Tú:**
1. dashboard.vapi.ai → crea la cuenta.
2. Menú de la organización → **API Keys** → copia la **Private Key** → es `VAPI_API_KEY`.
   (La *Public Key* no sirve aquí.)
3. Inventa un secreto largo (por ejemplo 40 letras y números al azar) → es
   `VAPI_SERVER_SECRET`. No se pega en Vapi: el código se lo manda a Vapi al activar la línea.
4. **Provider Keys** (o *Integrations*) → **Anthropic** → pega la llave `socio-vapi`.
   Haz lo mismo con **Deepgram** si tienes llave (si no, ve el paso 4b de la sección 3).
5. 🔎 Revisa que el modelo `claude-haiku-4-5-20251001` aparezca en la lista de modelos de
   Anthropic dentro de Vapi, y que exista la voz `Paige` del proveedor *Vapi*. Si alguno no
   existe, se cambia con `VAPI_ASSISTANT_MODEL` o `VAPI_VOICE_ID` en el paso 7, sin tocar
   código.

### Paso 6 — WhatsApp (Meta), con el número de prueba

Para la primera llamada, **usa el número de prueba que Meta te da gratis**. El número
real del producto necesita la verificación del negocio y la aprobación del nombre, y eso
tarda días. Ver la sección 3.

**👆 Tú:**
1. developers.facebook.com → **My Apps** → **Create App** → caso de uso
   **Connect with customers through WhatsApp** (tipo *Business*) → elige o crea tu
   portafolio comercial → **Create app**.
2. En la app: **WhatsApp → API Setup**.
   - **From:** deja el número de prueba (*Test number*).
   - **To:** **Manage phone number list** → agrega **tu celular** → confirma con el código
     que te llega por WhatsApp. Ese mismo número será el `owner_whatsapp` de Martinez Roofing.
   - Copia el **Phone number ID** → es `WHATSAPP_PHONE_NUMBER_ID`.
   - Copia el **WhatsApp Business Account ID** → es `WHATSAPP_BUSINESS_ACCOUNT_ID`.
   - Copia el **Temporary access token** → es `WHATSAPP_ACCESS_TOKEN`. Dura 24 horas;
     sirve para la primera llamada. El token permanente está en la sección 3.
3. **App settings → Basic** → **App secret** → **Show** → es `WHATSAPP_APP_SECRET`.
4. Inventa una palabra secreta (ej. `socio-verifica-8k2x`) → es `WHATSAPP_VERIFY_TOKEN`.

### Paso 7 — Secretos de las Edge Functions

**✅ Código:** cada función revisa sus secretos y, si falta uno, deja un error claro en
`events` o en la respuesta.

**👆 Tú:** Supabase → **Edge Functions** → **Secrets** (o *Manage secrets*) → agrega uno
por uno: nombre a la izquierda, valor a la derecha. 🔎 Si la pantalla permite pegar
varios a la vez en formato `NOMBRE=valor`, úsalo.

**Mínimos para la primera llamada:**

| Nombre | De dónde sale |
|---|---|
| `TWILIO_ACCOUNT_SID` | Paso 3 |
| `TWILIO_AUTH_TOKEN` | Paso 3 |
| `VAPI_API_KEY` | Paso 5.2 |
| `VAPI_SERVER_SECRET` | Paso 5.3 (lo inventaste tú) |
| `ANTHROPIC_API_KEY` | Paso 4 (`socio-supabase`) |
| `WHATSAPP_ACCESS_TOKEN` | Paso 6.2 |
| `WHATSAPP_PHONE_NUMBER_ID` | Paso 6.2 |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Paso 6.2 |
| `WHATSAPP_APP_SECRET` | Paso 6.3 |
| `WHATSAPP_VERIFY_TOKEN` | Paso 6.4 (lo inventaste tú) |
| `CRON_SECRET` | Paso 1.5 (el mismo valor que en Vault) |

**No los pongas:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` ni `SUPABASE_SERVICE_ROLE_KEY`.
Supabase los inyecta solo.

Los demás (`RESEND_*`, `STRIPE_*`, `DEEPGRAM_API_KEY`, `APP_BASE_URL`,
`QUOTE_PDF_SHARED_SECRET`) van en la sección 3, para los momentos 2 y 3.

**🤖 Automatizable:** el GitHub Action del paso 8 puede leerlos de los *Secrets* de
GitHub y correr `supabase secrets set`. Así quedan en un solo lugar.

### Paso 8 — Desplegar las Edge Functions

Para la primera llamada bastan 3: **`voice-webhook`**, **`whatsapp-webhook`** y
**`provision-business`**.

**✅ Código:** las 9 funciones y `supabase/config.toml` con `verify_jwt = false` para los
4 webhooks.

**👆 Desde el panel: no lo recomiendo.** Todas las funciones importan archivos de
`_shared/` (unos 30 archivos) y el editor del panel no está pensado para eso. Si aun así
lo usas, tienes que apagar **Verify JWT** a mano en `voice-webhook`, `whatsapp-webhook`,
`stripe-webhook` y `quote-accept` (Edge Functions → la función → *Details/Settings*).
Si se te olvida, Vapi y Meta reciben **401**.

**🤖 Automatizable (elige una):**

- **A. GitHub Action con botón (recomendado).** Un archivo
  `.github/workflows/supabase-deploy.yml` que corres desde GitHub → **Actions** →
  *Supabase deploy* → **Run workflow**, incluso desde el celular. Hace `db push` (paso 1),
  `secrets set` (paso 7) y `functions deploy` de las 9 funciones, y respeta `config.toml`.
  Necesita en GitHub → **Settings → Secrets and variables → Actions**:
  - `SUPABASE_ACCESS_TOKEN`: supabase.com → tu avatar → **Account → Access Tokens** →
    **Generate new token**.
  - `SUPABASE_PROJECT_REF`: el Project ID del paso 1.
  - `SUPABASE_DB_PASSWORD`: la contraseña de la base que pusiste al crear el proyecto
    (si no la recuerdas: **Project Settings → Database → Reset database password**).
  - Los secretos del paso 7, si quieres que el Action también los suba.

  **Todavía no existe el archivo:** pediste no escribir código en esta tarea. Es la
  siguiente tarea que te propongo.
- **B. Que Claude Code en la nube lo despliegue.** Desde este entorno **sí** hay
  conexión a `api.supabase.com` (lo probé). En una sesión, Claude te pide el
  `SUPABASE_ACCESS_TOKEN` en un formulario seguro (nunca en el chat) y corre
  `npx supabase functions deploy ... --project-ref ...`. Sirve para hoy, pero no queda
  como botón repetible.

**Cómo verificas:** Supabase → **Edge Functions**: las 3 funciones aparecen con estado
activo. Al abrir `voice-webhook` en el navegador debe responder
`{"error":"Método no permitido."}` (bien: solo acepta POST).

### Paso 9 — Webhook de Meta

Va **después** del paso 8: Meta prueba la URL en el momento en que la guardas.

**👆 Tú:** developers.facebook.com → tu app → **WhatsApp → Configuration** → **Webhook**
→ **Edit**:
- **Callback URL:** `https://<tu-project-ref>.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token:** el `WHATSAPP_VERIFY_TOKEN` del paso 6.4
- **Verify and save**. Si falla: revisa que `whatsapp-webhook` tenga Verify JWT apagado y
  que el token sea idéntico.
- Abajo, en **Webhook fields**, busca **`messages`** → **Subscribe**.

### Paso 10 — Variables de Vercel

**✅ Código:** el frontend ya está desplegado (commit "Primer deploy en Vercel").

**👆 Tú:** vercel.com → proyecto → **Settings → Environment Variables** → agrega, para
*Production* y *Preview*:
- `VITE_SUPABASE_URL` = `https://<tu-project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = la `anon` key del paso 1.5 (esta sí es pública)

Luego **Deployments** → el último → menú **⋯** → **Redeploy**. Las variables `VITE_` se
leen al compilar, así que sin redeploy no se aplican.

**Cómo verificas:** abre `https://<tu-dominio-vercel>/admin` y entra con el usuario del
paso 2.

### Paso 11 — Plantilla `nueva_llamada`

No bloquea la primera llamada: si le escribiste "Hola" al bot hace menos de 24 h (paso
14), el aviso sale como mensaje normal con botones. Pero **regístrala hoy**, porque Meta
puede tardar hasta 24 h en aprobarla.

**👆 Tú:** business.facebook.com → **WhatsApp Manager** → **Message templates** →
**Create template** → categoría **Utility** → nombre `nueva_llamada` → idioma
**Spanish (MEX)** → texto y botones de §4 → **Submit**.

### Paso 12 — Crear Martinez Roofing

**👆 Tú (recomendado):** `/admin` → **Nuevo negocio** →
- Nombre: `Martinez Roofing` · Giro: `roofing` · Ciudad: `Houston` · Estado: `TX`
- Zona horaria: `America/Chicago`
- Dueño: `Carlos Martinez`
- WhatsApp del dueño: **tu celular** en formato `+1...` o `+52...`, el mismo del paso 6.2
- Número de Twilio: el del paso 3 (`+1713...`)
- Horario: lunes a viernes 07:00–18:00, sábado 08:00–14:00, domingo cerrado
- Servicios (mínimo y máximo en dólares):
  - Roof inspection: 0–150
  - Roof repair / leak patch: 300–1200
  - Full roof replacement (asphalt shingle): 8000–16000
  - Gutter installation / repair: 500–2500
  - Storm damage emergency tarp: 200–600
- Transferencia de emergencias: encendida. ⚠️ Transfiere al número de **WhatsApp del dueño**,
  así que las llamadas de emergencia de prueba sonarán en tu celular.

**Alternativa sin formulario:** SQL Editor. Es lo mismo que hace
`scripts/seed-demo-business.ts`; cambia los dos números:
```sql
insert into public.businesses
  (name, trade, city, state, timezone, owner_name, owner_whatsapp, twilio_number,
   emergency_transfer, hours, services)
values (
  'Martinez Roofing', 'roofing', 'Houston', 'TX', 'America/Chicago', 'Carlos Martinez',
  '+1TU_CELULAR', '+1713NUMERO_TWILIO', true,
  '{"monday":{"open":"07:00","close":"18:00"},"tuesday":{"open":"07:00","close":"18:00"},
    "wednesday":{"open":"07:00","close":"18:00"},"thursday":{"open":"07:00","close":"18:00"},
    "friday":{"open":"07:00","close":"18:00"},"saturday":{"open":"08:00","close":"14:00"},
    "sunday":null}'::jsonb,
  '[{"name":"Roof inspection","price_min":0,"price_max":150},
    {"name":"Roof repair / leak patch","price_min":300,"price_max":1200},
    {"name":"Full roof replacement (asphalt shingle)","price_min":8000,"price_max":16000},
    {"name":"Gutter installation / repair","price_min":500,"price_max":2500},
    {"name":"Storm damage emergency tarp","price_min":200,"price_max":600}]'::jsonb
);
```

### Paso 13 — Activar la línea

**👆 Tú:** `/admin` → Martinez Roofing → **Activar línea**.

**Qué debe pasar:** mensaje de éxito; en `businesses` se llena `vapi_assistant_id`; en
`events` aparece `business.provisioned`. En Vapi → **Assistants** aparece "Martinez
Roofing — Recepcionista", y en **Phone Numbers**, tu número de Twilio ligado a él.

**Si falla:** `events` → `business.provision_failed` → el campo `payload.error` trae la
respuesta exacta de Vapi (por ejemplo, modelo o voz que no existe → paso 5.5).

### Paso 14 — Abrir la ventana de 24 horas

**👆 Tú:** desde tu celular, manda "Hola" por WhatsApp al **número de prueba** de Meta.

**Qué debe pasar:** el bot te contesta "No entendí ese mensaje 🤔. Puedo avisarte de
llamadas nuevas…". Eso confirma que el webhook, la firma y tu número de dueño funcionan.
En `messages` aparece una fila `inbound`.

Si te contesta "Este número es solo para los dueños…", tu número no coincide con
`owner_whatsapp` (revisa el `+` y la lada).

### Paso 15 — Primera llamada real ☎️

**👆 Tú:** desde otro teléfono, llama al número de Twilio. Sigue la prueba 1 de
`TESTING.md` (gotera, nombre, dirección, jueves en la mañana) y cuelga.

**Qué debe pasar:**
1. Saludo: *"Thanks for calling Martinez Roofing. This is Martinez Roofing's virtual
   assistant, and this call may be recorded…"*
2. Menos de 60 s después de colgar: WhatsApp con 📞 *Nueva llamada — …*, el resumen en
   español y los botones *Confirmar cita* / *Lo llamo yo*.
3. Supabase → `calls`: una fila con `transcript`, `extracted` y `summary_es`.
4. `events`: `call.webhook_received` y luego `call.processed` con `whatsapp_sent: true`.

**🔎 Lo más importante de esta llamada:** abre el evento `call.webhook_received` y copia el
`payload.raw`. Ese es el formato real que manda Vapi, que nunca se pudo verificar con su
documentación. Si `calls.extracted` llegó casi todo en `null` pero el `transcript` sí
existe, los datos estructurados vienen en otra parte del JSON. Pásale ese payload a
Claude en la siguiente tarea para ajustar `_shared/vapi-report.ts`.

**Si no llega el WhatsApp:** revisa `events` en este orden:
- No hay `call.webhook_received`: Vapi no llegó a la función. Revisa el 401 (Verify JWT o
  `VAPI_SERVER_SECRET`) en Vapi → **Call Logs** → la llamada → *Server messages*.
- Hay `call.unmatched_business`: el asistente o el número no coinciden con el negocio.
- Hay `call.processed` con `whatsapp_sent: false`: lee `whatsapp_error`. Lo más común es
  que venció el token temporal o la ventana de 24 h está cerrada sin plantilla aprobada.

---

## 3. Después de la primera llamada (momentos 2 y 3, y clientes reales)

| Qué | 👆 Tú en un panel | 🤖 Automatizable |
|---|---|---|
| **a. Token permanente de Meta** | business.facebook.com → **Settings → Users → System users** → **Add** (Admin) → **Assign assets**: tu app y tu WABA con control total → **Generate token**, permisos `whatsapp_business_messaging` y `whatsapp_business_management`, sin vencimiento → reemplaza `WHATSAPP_ACCESS_TOKEN` | Actualizarlo en GitHub Secrets y volver a correr el Action |
| **b. Número real de WhatsApp** | WhatsApp Manager → **Phone numbers → Add phone number** → nombre visible "Socio" → verificar por SMS o llamada. Requiere la verificación del negocio (**Security Center → Start verification**) | — |
| **c. Las otras 5 plantillas** | Igual que el paso 11, texto en §4 | — |
| **d. Deepgram** (notas de voz) | console.deepgram.com → **API Keys → Create** → `DEEPGRAM_API_KEY` | — |
| **e. Resend** (email al cliente) | resend.com → **Domains → Add domain** → copia los registros DNS a tu proveedor de dominio → **Verify** → **API Keys → Create** → `RESEND_API_KEY`; `RESEND_FROM_EMAIL` = `quotes@tu-dominio` | — |
| **f. PDF en Vercel** | Vercel → Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → API Keys → `service_role` o *secret*), `APP_BASE_URL`, `QUOTE_PDF_SHARED_SECRET` (inventado) → Redeploy | — |
| **g. Secretos extra en Supabase** | `DEEPGRAM_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_BASE_URL`, `QUOTE_PDF_SHARED_SECRET` (el mismo de Vercel) | GitHub Action |
| **h. Desplegar las otras 6 funciones** | — | GitHub Action (despliega las 9) |
| **i. Stripe: producto y precio** | dashboard.stripe.com (modo **Test**) → **Product catalog → Add product** → nombre `Socio Base` → **Recurring**, $199.00 USD **Monthly** → **Save** → copia el **Price ID** (`price_...`) → `STRIPE_PRICE_ID`. Los 14 días de prueba los pone el código al crear el Checkout, no van en el precio. Reemplaza a `scripts/stripe-setup.ts` | O Claude con el conector de Stripe que ya tienes en Claude |
| **j. Stripe: webhook** | **Developers → Webhooks → Add endpoint** → URL `https://<ref>.supabase.co/functions/v1/stripe-webhook` → eventos `customer.subscription.created/updated/deleted` → copia el **Signing secret** → `STRIPE_WEBHOOK_SECRET`; **API keys** → `STRIPE_SECRET_KEY` | — |
| **k. Cron jobs** | SQL Editor: `select jobname, schedule from cron.job;` → deben salir 3, cada uno con `0 * * * *` (requiere el paso 1.5) | — |
| **l. Desvío del celular del dueño** | En el celular del dueño, desvío condicional al número de Twilio (código según compañía, SPEC §5.2) | — |

---

## 4. Texto exacto de las plantillas de WhatsApp

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

> Estos textos copian los mensajes libres que ya manda el código, para que el dueño lea
> lo mismo dentro y fuera de la ventana de 24 h. Si Meta te pide cambiar una palabra,
> no pasa nada mientras no cambie el **número ni el orden** de las variables.

---

## 5. DEPLOY.md sin terminal: equivalencias

| DEPLOY.md dice | Hazlo así |
|---|---|
| §1 `npx supabase link` + `db push` | SQL Editor, archivo por archivo (paso 1), o GitHub Action |
| §2 SQL de Vault | Ya era panel: SQL Editor (paso 1.5) |
| §3 `npx supabase secrets set ...` | Edge Functions → Secrets (paso 7), o GitHub Action |
| §3 `deno run scripts/stripe-setup.ts` | Stripe → Product catalog (§3.i) |
| §4 `npx supabase functions deploy` ×9 | GitHub Action, o Claude Code en la nube (paso 8) |
| §4 `npx supabase functions serve` (Docker) | No aplica en la nube. Sustituto: las pruebas de Deno que Claude corre aquí + la primera llamada |
| §5 `vercel --prod` | Push a la rama conectada, o Vercel → Deployments → Redeploy |
| §10 `deno run scripts/seed-demo-business.ts` | Formulario de `/admin` o el SQL del paso 12 |

---

## 6. Hallazgos de la revisión (para tareas siguientes, no bloquean la primera llamada salvo que se diga)

1. **`deno check` falla en `whatsapp-webhook`** (`_shared/deepgram.ts:30`,
   `new Blob([bytes])`: con Deno 2.9 / TS 6, `Uint8Array<ArrayBufferLike>` ya no es
   `BlobPart`). En tiempo de ejecución funciona; solo es de tipos. 🔎 Si el despliegue de
   Supabase revisa tipos, este error impediría desplegar `whatsapp-webhook`. Se corrige en
   una línea.
2. **⚠️ Variables de plantilla con saltos de línea.** `summary_es` se pide "de 2 a 3
   líneas", y se manda como `{{2}}` de `nueva_llamada`. Meta rechaza los parámetros de
   plantilla con saltos de línea, tabuladores o más de 4 espacios seguidos. Dentro de la
   ventana de 24 h no pasa nada, porque sale como texto libre. **Fuera de la ventana, el
   aviso de llamada fallaría.** Hay que limpiar los parámetros antes de enviarlos. Es
   importante antes del primer cliente real.
3. **🔎 Formato del webhook de Vapi sin verificar.** `vapi-report.ts` prueba varias
   ubicaciones para cada campo porque nunca se pudo leer la documentación de Vapi. Además,
   `analysisPlan.structuredDataPlan` puede estar en desuso en Vapi. La primera llamada lo
   confirma (paso 15). Si `extracted` llega vacío, el resumen sigue funcionando a partir
   de la transcripción, pero se pierden la urgencia, el spam y los datos estructurados.
4. **`npm test` en rojo.** vitest busca `*.test.ts` en todo el repo y recoge los de Deno.
   Hay que excluir `supabase/functions` en la configuración de vitest. Además, el frontend
   no tiene pruebas propias, así que después de excluirlas vitest diría "No test files
   found".
5. **DEPLOY.md desactualizado en 3 detalles:** dice que el texto de las plantillas está "en
   los mensajes de días anteriores de esta conversación" (no existe; ahora está en §4);
   "revisa `static_files` (paso 4)" ya no aplica; y no menciona crear el usuario operador
   ni comprar el número de Twilio.
6. **`.env.example`:** `OPENAI_API_KEY` no la usa ningún código (Whisper no está
   implementado; solo Deepgram). `WHATSAPP_BUSINESS_ACCOUNT_ID` tampoco la lee el código
   (solo sirve de referencia). Faltan `DEMO_OWNER_WHATSAPP` y `DEMO_TWILIO_NUMBER`, que usa
   el script del negocio demo.
7. **La transferencia de emergencias marca al `owner_whatsapp`.** Se asume que el WhatsApp
   del dueño es también su celular. Si algún dueño usa WhatsApp en otro número, hace falta
   un campo aparte. Hay que decidirlo antes de los clientes reales.
8. **Lint:** 6 avisos de `react-refresh` en `Button`, `Input`, `Toast` y `auth.tsx`.
   Son cosméticos.
