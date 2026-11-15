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
  window.matchMedia = (query: string) => ({ matches: query.includes('dark') }) as MediaQueryList
})

function Pane() {
  const ref = React.useRef<HTMLDivElement>(null)
  return React.createElement('div', { ref, 'data-theme': useTheme(ref, 'system') })
}

it('hydrates a server-rendered pane under a dark host without a mismatch, then takes dark', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(React.createElement(Pane))
  document.documentElement.setAttribute('data-theme', 'dark')
  document.body.append(container)
  const error = vi.spyOn(console, 'error')
  await act(async () => { hydrateRoot(container, React.createElement(Pane)) })
  expect(error).not.toHaveBeenCalled()
  expect(container.firstElementChild?.getAttribute('data-theme')).toBe('dark')
})

it('reports a client-only pane under a dark OS as dark, once', async () => {
  const onThemeResolved = vi.fn()
  const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [] })
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  await act(async () => {
    createRoot(document.createElement('div')).render(
      React.createElement(GraphView, { graph: { nodes: [], edges: [] }, taxonomy, onThemeResolved }))
  })
  expect(onThemeResolved.mock.calls).toEqual([['dark']])
})
