// Thin client for Anthropic's Messages API, using output_config.format with
// a JSON schema (structured outputs) so the model's response is produced by
// constrained decoding instead of just being asked nicely for JSON.
// Docs: https://platform.claude.com/docs/en/api/messages and
// https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// (fetched 2026-10-08; output_config.format is current, output_format is
// deprecated).

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicMessagesResponse {
  content: AnthropicContentBlock[]
  stop_reason?: string
}

export interface CallClaudeJsonArgs {
  model: string
  userMessage: string
  schema: Record<string, unknown>
  system?: string
  maxTokens?: number
}

/**
 * Calls Claude with a JSON Schema constraint and returns the parsed JSON.
 * Throws on a non-2xx response, a refusal, a max_tokens cutoff, or a
 * response whose text block isn't valid JSON — callers decide whether to
 * retry.
 */
export async function callClaudeJson<T>(args: CallClaudeJsonArgs): Promise<T> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY en el entorno de la función.')

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens ?? 1024,
      ...(args.system ? { system: args.system } : {}),
      messages: [{ role: 'user', content: args.userMessage }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: args.schema,
        },
      },
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Anthropic ${response.status}: ${text}`)
  }

  const data = JSON.parse(text) as AnthropicMessagesResponse

  if (data.stop_reason === 'refusal') {
    throw new Error('Anthropic rechazó la solicitud (stop_reason: refusal).')
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de Anthropic se truncó por max_tokens.')
  }

  const textBlock = data.content.find((block) => block.type === 'text')
  if (!textBlock?.text) {
    throw new Error('Anthropic no devolvió un bloque de texto.')
  }

  return JSON.parse(textBlock.text) as T
}
