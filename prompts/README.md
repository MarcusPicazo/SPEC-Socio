# Los prompts se movieron

Los archivos de `prompts/*.md` ahora viven en
`supabase/functions/_shared/prompts/*.md`.

**Por qué:** `supabase functions deploy` solo empaqueta lo que está dentro de
`supabase/functions/`. Las funciones leían estos archivos con
`Deno.readTextFile` en tiempo de arranque — eso no es un `import`, así que el
bundler no los incluía, y las funciones fallaban al iniciar una vez
desplegadas (aunque funcionaran perfecto en local). Moverlos adentro y
declararlos con `static_files` en `supabase/config.toml` resuelve esto.

Esta carpeta se deja vacía a propósito, como señal de dónde buscar si algo
sigue referenciando la ruta vieja.
