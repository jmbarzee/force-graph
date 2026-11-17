/// <reference types="vite/client" />
import { expect, it } from 'vitest'

const sheets = import.meta.glob<string>('../**/*.css', { query: '?raw', import: 'default', eager: true })

it.each(Object.entries(sheets))('%s holds every rule in @layer gv', (_, css) => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').trim()
  expect(rules.startsWith('@layer gv {')).toBe(true)
  let depth = 0
  const closes = [...rules].findIndex(c => (depth += c === '{' ? 1 : c === '}' ? -1 : 0) === 0 && c === '}')
  expect(closes).toBe(rules.length - 1)
})

it('declares no token on :root', () => {
  expect(sheets['./tokens.css']).not.toMatch(/:root/)
})
