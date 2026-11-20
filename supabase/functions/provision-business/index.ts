// Given a business_id, creates or updates its Vapi voice assistant (payload
// built by _shared/vapi-assistant.ts from the business's own data),
// imports/assigns its Twilio number in Vapi, and saves vapi_assistant_id
// back onto the business.
//
// Only callable by an authenticated operator (checked against the
// `operators` table using the caller's own JWT) — never exposed publicly.

import { z } from 'npm:zod@3.23.8'
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient, createUserClient } from '../_shared/supabase-admin.ts'
import type { Business } from '../_shared/types.ts'
import { buildAssistantPayload } from '../_shared/vapi-assistant.ts'
import { createOrUpdateAssistant, createOrUpdatePhoneNumber } from '../_shared/vapi.ts'

const requestSchema = z.object({ business_id: z.string().uuid() })

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Falta autenticación.' }, 401)

  const userClient = createUserClient(authHeader)
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'Sesión inválida.' }, 401)

  const { data: operatorRow } = await userClient
    .from('operators')
    .select('id')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!operatorRow) return jsonResponse({ error: 'Esta cuenta no tiene permiso de operador.' }, 403)

  let requestBody: unknown
  try {
    requestBody = await req.json()
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400)
  }

  const parsedBody = requestSchema.safeParse(requestBody)
  if (!parsedBody.success) return jsonResponse({ error: 'business_id inválido.' }, 400)

  const admin = createAdminClient()
  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('*')
    .eq('id', parsedBody.data.business_id)
    .single()
  if (businessError || !business) return jsonResponse({ error: 'Negocio no encontrado.' }, 404)

  const typedBusiness = business as Business

  if (!typedBusiness.twilio_number) {
    return jsonResponse(
      { error: 'Este negocio no tiene número de Twilio asignado. Edítalo primero.' },
      400,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const vapiServerCredentialId = Deno.env.get('VAPI_SERVER_CREDENTIAL_ID')
  if (!supabaseUrl || !vapiServerCredentialId) {
    return jsonResponse(
      {
        error:
          'Falta VAPI_SERVER_CREDENTIAL_ID en los secretos de la función. Créala en Vapi ' +
          '(Integrations → Server Configuration → Add Custom Credential, Bearer Token con el ' +
          'mismo valor que VAPI_SERVER_SECRET) y pega su ID. Ver ENCENDIDO.md.',
      },
      500,
    )
  }
  const voiceWebhookUrl = `${supabaseUrl}/functions/v1/voice-webhook`

  try {
    const assistantPayload = buildAssistantPayload(typedBusiness, {
      serverUrl: voiceWebhookUrl,
      serverCredentialId: vapiServerCredentialId,
      modelProvider: Deno.env.get('VAPI_ASSISTANT_MODEL_PROVIDER'),
      model: Deno.env.get('VAPI_ASSISTANT_MODEL'),
      voiceProvider: Deno.env.get('VAPI_VOICE_PROVIDER'),
      voiceId: Deno.env.get('VAPI_VOICE_ID'),
    })

    const assistant = await createOrUpdateAssistant(
      typedBusiness.vapi_assistant_id,
      assistantPayload,
    )

    const phoneNumber = await createOrUpdatePhoneNumber({
      twilioNumber: typedBusiness.twilio_number,
      assistantId: assistant.id,
    })

    await admin.from('businesses').update({ vapi_assistant_id: assistant.id }).eq('id', typedBusiness.id)

    await admin.from('events').insert({
      business_id: typedBusiness.id,
      type: 'business.provisioned',
      payload: { vapi_assistant_id: assistant.id, phone_number_id: phoneNumber.id },
    })

    return jsonResponse(
      { vapi_assistant_id: assistant.id, phone_number_id: phoneNumber.id },
      200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('provision-business failed', message)

    await admin.from('events').insert({
      business_id: typedBusiness.id,
      type: 'business.provision_failed',
      payload: { error: message },
    })

    return jsonResponse({ error: message }, 502)
  }
})
