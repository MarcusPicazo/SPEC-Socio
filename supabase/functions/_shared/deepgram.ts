// Transcribes the owner's Spanish voice notes with Deepgram's pre-recorded
// API. developers.deepgram.com confirms language=es + model=nova-3 as
// query params (not body fields) for Spanish; body is the raw audio bytes
// for a local file, Content-Type set to the audio's real mime type.

const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen'

interface DeepgramResponse {
  results?: {
    channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>
  }
}

export async function transcribeSpanish(bytes: Uint8Array, mimeType: string): Promise<string> {
  const apiKey = Deno.env.get('DEEPGRAM_API_KEY')
  if (!apiKey) throw new Error('Falta DEEPGRAM_API_KEY en el entorno de la función.')

  const url = `${DEEPGRAM_URL}?model=nova-3&language=es&smart_format=true`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': mimeType,
    },
    // Wrapped in a Blob rather than passed as a raw Uint8Array: BodyInit's
    // exact typed-array requirements have shifted across TS/lib versions
    // (Uint8Array became generic over its buffer type), and Blob sidesteps
    // the question entirely regardless of what `bytes`' generic parameter
    // happens to be.
    body: new Blob([bytes]),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Deepgram ${response.status}: ${text}`)
  }

  const data = JSON.parse(text) as DeepgramResponse
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript
  if (typeof transcript !== 'string') {
    throw new Error('Deepgram no devolvió un transcript.')
  }
  return transcript
}
