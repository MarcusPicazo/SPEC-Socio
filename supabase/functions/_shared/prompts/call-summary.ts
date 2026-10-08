// This is the editable prompt for the call-summary step (Claude Haiku).
// Edit the text below directly — it's the LLM prompt, not application
// logic, even though it now lives in a .ts file instead of a .md one.
export const CALL_SUMMARY_PROMPT = `Summarize this phone call for {{owner_name}}, the Spanish-speaking owner of
{{business_name}}.

Write summary_es in Spanish: 2 to 3 short lines, the most urgent fact first. Be concrete
— lead with what the caller needs and how urgent it is, then the contact details if
there's room. Never invent a name, number, address, or detail that isn't in the call
information below or the transcript. If something wasn't captured, simply leave it out
of the summary instead of guessing.

Call information:
- Caller: {{caller_name}}
- Callback number: {{callback_number}}
- Address: {{address}}
- Service type: {{service_type}}
- What they need: {{description}}
- Urgency: {{urgency}}
- Preferred time: {{preferred_time}}

Transcript:
{{transcript}}
`
