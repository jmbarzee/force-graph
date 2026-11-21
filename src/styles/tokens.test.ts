// @vitest-environment jsdom
/// <reference types="vite/client" />
import React, { act } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it } from 'vitest'
import css from './tokens.css?raw'
import readme from '../../README.md?raw'
import { TOKEN_ROLES, createTheme, schemeStylesheet, tokenVar } from './tokens'
import { FilterBar } from '../components/FilterBar'
import { GraphView } from '../components/GraphView'
import { useScheme } from '../components/graph-view/useScheme'
import { fillOf } from '../graph/coloring'
import type { Coloring } from '../graph/coloring'
import type { GraphNode } from '../graph/model'
import { createTaxonomy } from '../graph/taxonomy'

const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [] })

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

it("has a role for every token the README's table offers, each one tokens.css declares", () => {
  const tabled = new Set([...readme.matchAll(/^\| `(--gv-[a-z-]+)` \|/gm)].map(m => m[1]))
  const declared = new Set(css.match(/--gv-[a-z-]+(?=:)/g))
  expect(new Set(TOKEN_ROLES.map(tokenVar))).toEqual(tabled)
  for (const token of tabled) expect(declared).toContain(token)
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
    createRoot(host).render(React.createElement(FilterBar, { taxonomy, tokens, theme: 'dark', available: new Map(), filter: new Map(), onFilterChange: () => {} }))
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

const notes = { nodes: ['C', 'C#'].map((note): GraphNode => ({ id: note, name: note, values: { note } })), edges: [] }
const byNote: Coloring = { by: 'axis', axis: 'note' }

it("pins a host's stylesheet without a view to the style values' alone", () => {
  const styled = createTaxonomy({ styleAxis: 'kind', values: [
    { id: 'teachingLab', label: 'Lab', color: { light: { fill: '#0f766e', border: '#094740' }, dark: { fill: '#2dd4bf', border: '#094740' } } },
    { id: 'office', label: 'Office', color: { light: { fill: '#64748b', border: '#3c4653' }, dark: { fill: '#64748b', border: '#3c4653' } } },
  ] })
  expect(schemeStylesheet(styled, '.dark')).toBe(
    ':root {\n  --gv-node-teaching-lab: #0f766e;\n  --gv-node-teaching-lab-border: #094740;\n  --gv-node-office: #64748b;\n  --gv-node-office-border: #3c4653;\n}\n.dark {\n  --gv-node-teaching-lab: #2dd4bf;\n}',
  )
})

it("carries the fill's keys in a host's stylesheet, in both themes, under the pane's names", () => {
  const [light, dark] = schemeStylesheet(taxonomy, '.dark', { coloring: { fill: byNote }, graph: notes }).split('.dark')
  const keys = [...fillOf(byNote, notes, taxonomy).keys.values()]
  expect(keys.map(k => k.cssVar)).toEqual(['--gv-node-c', '--gv-node-c-2'])
  for (const { cssVar, color } of keys) {
    for (const [block, theme] of [[light, 'light'], [dark, 'dark']] as const) {
      expect(block).toContain(`${cssVar}: ${color[theme].fill};`)
      expect(block).toContain(`${cssVar}-border: ${color[theme].border};`)
    }
  }
})

it("carries the fill's keys on a host's chrome, resolving an equal colouring once", async () => {
  const host = mount()
  let asked = 0
  const of = (node: GraphNode) => (asked++, node.values.note)
  const keys = [{ id: 'C', label: 'C' }, { id: 'C#', label: 'C#' }]
  function Chrome() {
    const view = { coloring: { fill: { by: 'node', keys: [...keys], of } as const }, graph: notes }
    return React.createElement('aside', useScheme(taxonomy, { view }).scopeProps)
  }
  const root = createRoot(host)
  await act(async () => root.render(React.createElement(Chrome)))
  await act(async () => root.render(React.createElement(Chrome)))
  expect(asked).toBe(notes.nodes.length)
  const aside = host.querySelector('aside')!
  expect(aside.getAttribute('data-gv-theme')).toBe('dark')
  for (const { cssVar, color } of fillOf({ by: 'node', keys, of }, notes, taxonomy).keys.values()) {
    expect(aside.style.getPropertyValue(cssVar)).toBe(color.dark.fill)
    expect(aside.style.getPropertyValue(`${cssVar}-border`)).toBe(color.dark.border)
  }
})
