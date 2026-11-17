// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('../../src/components/GraphCanvas', () => ({ GraphCanvas: () => null }))

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

// The roots come first by name: `Ethics of AI`, listed under a subject no
// department owns, stands alone before the first faculty.
it('tabs from the roots through the first faculty\'s first course, announcing each', async () => {
  const el = document.body.appendChild(document.createElement('div'))
  await act(async () => createRoot(el).render(React.createElement(App)))
  const pane = el.querySelector<HTMLElement>('.gv-graph-view')!
  await act(async () => pane.focus())
  const said: (string | null)[] = []
  for (let i = 0; i < 4; i++) {
    await act(async () => { pane.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    said.push(el.querySelector('[role="status"]')!.textContent)
  }
  expect(said).toEqual([
    'Ethics of AI, Course, IDST 300 · 2 cr · Summer',
    'Faculty of Arts, Faculty, Prof. Marta Lindqvist',
    'Linguistics, Department, LING · Faculty of Arts',
    'Computational Linguistics, Course, LING 340 · 3 cr · Autumn',
  ])
})
