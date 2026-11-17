// @vitest-environment jsdom
/// <reference types="vite/client" />
import React, { act } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it } from 'vitest'
import css from './tokens.css?raw'
import { TOKEN_ROLES, createTheme, tokenVar } from './tokens'
import { FilterBar } from '../components/FilterBar'
import { GraphView } from '../components/GraphView'
import { useScheme } from '../components/graph-view/useScheme'
import { createTaxonomy } from '../graph/taxonomy'

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [] })

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = (query: string) => ({ matches: query.includes('dark') }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  document.head.replaceChildren()
  document.body.replaceChildren()
})

/** A container in the document, with `rules` mounted beside the library's tokens. */
function mount(rules = '') {
  const style = document.createElement('style')
  style.textContent = `${css}\n${rules}`
  document.head.append(style)
  const host = document.createElement('div')
  document.body.append(host)
  return host
}

it('has a role for every token tokens.css declares, and none it does not', () => {
  const declared = new Set(css.match(/--gv-[a-z-]+(?=:)/g))
  expect(new Set(TOKEN_ROLES.map(tokenVar))).toEqual(declared)
})

it('refuses an unknown role at compile time', () => {
  // @ts-expect-error — not a token's role
  createTheme({ light: { accentColour: '#000' } })
})

it("renders one token on the pane's root as the CSS override does", async () => {
  const typed = mount()
  const styled = mount('.override { --gv-accent: #0f766e; }')
  const tokens = createTheme({ dark: { accent: '#0f766e' } })
  await act(async () => {
    createRoot(typed).render(React.createElement(GraphView, { graph: { nodes: [], edges: [] }, taxonomy, tokens }))
    createRoot(styled).render(React.createElement(GraphView, { graph: { nodes: [], edges: [] }, taxonomy, className: 'override' }))
  })
  const accent = (host: HTMLElement) => getComputedStyle(host.querySelector('.gv-graph-view')!).getPropertyValue('--gv-accent').trim()
  expect(accent(typed)).toBe('#0f766e')
  expect(accent(typed)).toBe(accent(styled))
})

it("takes the bar's tokens for its resolved theme only", async () => {
  const host = mount()
  const tokens = createTheme({ light: { colorSurface: '#fff8e1' }, dark: { colorSurface: '#111111' } })
  await act(async () => {
    createRoot(host).render(React.createElement(FilterBar, { taxonomy, tokens, theme: 'dark', values: new Map(), filter: new Map(), onFilterChange: () => {} }))
  })
  expect(host.querySelector<HTMLElement>('[data-gv-theme]')?.style.getPropertyValue('--gv-color-surface')).toBe('#111111')
})

it("resolves a host's chrome in a layout effect, so it never paints light under a dark OS", () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  const host = mount()
  const tokens = createTheme({ dark: { accent: '#0f766e' } })
  function Chrome() {
    return React.createElement('aside', useScheme(taxonomy, { tokens }).scopeProps)
  }
  // A synchronous commit runs layout effects and their updates, but not
  // passive effects, before it returns — and so before the browser can paint.
  flushSync(() => createRoot(host).render(React.createElement(Chrome)))
  const aside = host.querySelector('aside')!
  expect(aside.getAttribute('data-gv-theme')).toBe('dark')
  expect(aside.style.getPropertyValue('--gv-accent')).toBe('#0f766e')
})
