// Unit tests (`npm test`): `src/**/*.test.ts` and the examples' checks, under
// node unless a file opts into jsdom. The examples import the package by name,
// resolved from source as their Vite config resolves it.
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@jmbarzee/force-graph': fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'examples/**/*.test.ts'],
  },
})
