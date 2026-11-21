import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // supabase/functions has its own Deno tests (`deno task test`); vitest
    // only runs the frontend's.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
