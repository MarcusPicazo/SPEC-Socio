# Los prompts se movieron

Los prompts ahora viven como módulos de TypeScript en
`supabase/functions/_shared/prompts/*.ts` (`call-summary.ts`,
`quote-extraction.ts`, `receptionist.ts`), cada uno exportando una sola
constante (`CALL_SUMMARY_PROMPT`, etc.) con el texto del prompt. Edita el
texto directamente ahí — sigue siendo el prompt, no lógica de la
aplicación, solo que ahora es un `import` normal en vez de un
`Deno.readTextFile`.

Esta carpeta se deja vacía a propósito, como señal de dónde buscar si algo
sigue referenciando la ruta vieja.
