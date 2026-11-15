// @vitest-environment jsdom
import React, { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useTheme } from './useTheme'

function Pane() {
  const ref = React.useRef<HTMLDivElement>(null)
  return React.createElement('div', { ref, 'data-theme': useTheme(ref, 'system') })
}

it('hydrates a server-rendered pane under a dark host without a mismatch, then takes dark', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(React.createElement(Pane))
  document.documentElement.setAttribute('data-theme', 'dark')
  window.matchMedia = (query: string) => ({ matches: query.includes('dark') }) as MediaQueryList
  document.body.append(container)
  const error = vi.spyOn(console, 'error')
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  await act(async () => { hydrateRoot(container, React.createElement(Pane)) })
  expect(error).not.toHaveBeenCalled()
  expect(container.firstElementChild?.getAttribute('data-theme')).toBe('dark')
})
