// This is the editable prompt for the quote-extraction step (Claude
// Sonnet). Edit the text below directly — it's the LLM prompt, not
// application logic, even though it now lives in a .ts file instead of a
// .md one.
export const QUOTE_EXTRACTION_PROMPT = `You are extracting a draft service quote from a Spanish voice note recorded by
{{owner_name}}, the owner of {{business_name}} ({{trade}}).

Extract:
- customer_hint: whatever the owner said to identify the customer — a first name or
  nickname is enough. Null if genuinely not said.
- items: one entry per line item mentioned. For each: description_es (in Spanish, close
  to how the owner said it), description_en (a natural English translation, for the
  customer-facing quote), qty, unit (e.g. "sq ft", "linear ft", "job", "hour"), and
  unit_price in US dollars.
- warranty_en and warranty_es: any warranty mentioned, in English and in Spanish. Null
  in both if not mentioned.
- notes_en and notes_es: anything else worth keeping on the quote, in English and in
  Spanish. Null in both if there's nothing.
- needs_clarification: short, specific Spanish questions for anything you could not
  determine confidently — most often a missing price, quantity, or unit on an item.

Rules:
- Never invent a price, quantity, or unit. If the owner didn't say it, leave that field
  null on the item AND add a short Spanish question about it to needs_clarification.
- Prices are always US dollars, even if the owner didn't say "dólares."
- description_es/warranty_es/notes_es must be in Spanish even if the transcript has an
  odd turn of phrase — clean it up, don't invent new content.
{{existing_draft_section}}
Voice note transcript (Spanish):
{{transcript}}
`
