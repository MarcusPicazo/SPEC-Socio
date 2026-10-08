const VAPI_BASE_URL = 'https://api.vapi.ai'

export interface VapiAssistant {
  id: string
  [key: string]: unknown
}

export interface VapiPhoneNumber {
  id: string
  number?: string
  assistantId?: string | null
  [key: string]: unknown
}

function vapiHeaders(): HeadersInit {
  const apiKey = Deno.env.get('VAPI_API_KEY')
  if (!apiKey) throw new Error('Falta VAPI_API_KEY en el entorno de la función.')
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

async function vapiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${VAPI_BASE_URL}${path}`, {
    ...init,
    headers: { ...vapiHeaders(), ...(init.headers ?? {}) },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Vapi ${init.method ?? 'GET'} ${path} -> ${response.status}: ${text}`)
  }
  return (text ? JSON.parse(text) : null) as T
}

/** Creates a new Vapi assistant, or updates it in place if assistantId is already set. */
export function createOrUpdateAssistant(
  assistantId: string | null,
  payload: Record<string, unknown>,
): Promise<VapiAssistant> {
  if (assistantId) {
    return vapiFetch<VapiAssistant>(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }
  return vapiFetch<VapiAssistant>('/assistant', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Finds the Vapi phone number matching twilioNumber and points it at
 * assistantId, importing it from Twilio first if Vapi doesn't know about it
 * yet.
 */
export async function createOrUpdatePhoneNumber(args: {
  twilioNumber: string
  assistantId: string
}): Promise<VapiPhoneNumber> {
  const { twilioNumber, assistantId } = args

  const existing = await vapiFetch<VapiPhoneNumber[]>('/phone-number', { method: 'GET' })
  const match = existing.find((phoneNumber) => phoneNumber.number === twilioNumber)

  if (match) {
    return vapiFetch<VapiPhoneNumber>(`/phone-number/${match.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ assistantId }),
    })
  }

  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error('Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN en el entorno de la función.')
  }

  return vapiFetch<VapiPhoneNumber>('/phone-number', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'twilio',
      number: twilioNumber,
      twilioAccountSid,
      twilioAuthToken,
      assistantId,
    }),
  })
}
