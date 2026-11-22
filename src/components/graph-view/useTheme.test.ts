// @vitest-environment jsdom
import React, { act } from 'react'
import { renderToString } from 'react-dom/server'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from '../GraphView'
import { createTaxonomy } from '../../graph/taxonomy'
import { useTheme } from './useTheme'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

function Pane() {
  const ref = React.useRef<HTMLDivElement>(null)
  return React.createElement('div', { ref, 'data-gv-theme': useTheme(ref, 'system') })
}

it('hydrates a server-rendered pane under a dark host without a mismatch, then takes dark', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(React.createElement(Pane))
  document.documentElement.setAttribute('data-theme', 'dark')
  window.matchMedia = (query: string) => ({ matches: query.includes('dark') }) as MediaQueryList
  document.body.append(container)
  const error = vi.spyOn(console, 'error')
  await act(async () => { hydrateRoot(container, React.createElement(Pane)) })
  expect(error).not.toHaveBeenCalled()
  expect(container.firstElementChild?.getAttribute('data-gv-theme')).toBe('dark')
})

it('reports a client-only pane under a dark OS as dark, once', async () => {
  window.matchMedia = (query: string) => ({ matches: query.includes('dark') }) as MediaQueryList
  const onThemeResolved = vi.fn()
  const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [] })
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  await act(async () => {
    createRoot(document.createElement('div')).render(
      React.createElement(GraphView, { graph: { nodes: [], edges: [] }, taxonomy, onThemeResolved }))
  })
  expect(onThemeResolved.mock.calls).toEqual([['dark']])
})

it('marks a pane under a dark host with data-gv-theme, and writes no data-theme', async () => {
  window.matchMedia = (query: string) => ({ matches: !query.includes('dark') }) as MediaQueryList
  const host = document.createElement('div')
  host.setAttribute('data-theme', 'dark')
  document.body.append(host)
  const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [] })
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  await act(async () => {
    createRoot(host).render(React.createElement(GraphView, { graph: { nodes: [], edges: [] }, taxonomy }))
  })
  const pane = host.querySelector('.gv-graph-view')
  expect(pane?.getAttribute('data-gv-theme')).toBe('dark')
  expect(pane?.hasAttribute('data-theme')).toBe(false)
})
