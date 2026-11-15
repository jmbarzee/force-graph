// Unit tests (`npm test`): `src/**/*.test.ts`, under node unless a file opts into jsdom.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
