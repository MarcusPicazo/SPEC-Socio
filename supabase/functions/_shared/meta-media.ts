// Downloads media WhatsApp sent us (voice notes). Two Graph API calls:
// look up the media id to get a short-lived URL, then fetch that URL —
// both need the same Bearer token, and the URL expires in ~5 minutes, so
// they're always called back to back.
// developers.facebook.com is blocked by this environment's network
// policy; this is built from search results quoting Meta's docs.

export interface DownloadedMedia {
  bytes: Uint8Array
  mimeType: string
}

function credentials(): { accessToken: string; apiVersion: string } {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  if (!accessToken) throw new Error('Falta WHATSAPP_ACCESS_TOKEN en el entorno de la función.')
  return { accessToken, apiVersion: Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0' }
}

async function fetchMediaUrl(
  mediaId: string,
  accessToken: string,
  apiVersion: string,
): Promise<{ url: string; mimeType: string }> {
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Meta media lookup ${response.status}: ${text}`)
  }
  const data = JSON.parse(text) as { url?: string; mime_type?: string }
  if (!data.url) throw new Error('Meta no devolvió una url para este medio.')
  return { url: data.url, mimeType: data.mime_type ?? 'application/octet-stream' }
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<DownloadedMedia> {
  const { accessToken, apiVersion } = credentials()
  const { url, mimeType } = await fetchMediaUrl(mediaId, accessToken, apiVersion)

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) {
    throw new Error(`Meta media download ${response.status}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { bytes, mimeType }
}

/** Picks a filename extension from a WhatsApp audio mime_type, for the Storage path. */
export function extensionForMimeType(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (lower.includes('ogg')) return 'ogg'
  if (lower.includes('mp3') || lower.includes('mpeg')) return 'mp3'
  if (lower.includes('amr')) return 'amr'
  if (lower.includes('wav')) return 'wav'
  if (lower.includes('aac')) return 'aac'
  if (lower.includes('m4a')) return 'm4a'
  return 'bin'
}
