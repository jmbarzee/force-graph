// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from '../GraphView'
import { createTaxonomy } from '../../graph/taxonomy'
import { createTheme } from '../../styles/tokens'

const frames: FrameRequestCallback[] = []
const painted: unknown[] = []
let drawn = 0

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class {
    constructor(private readonly cb: ResizeObserverCallback) {}
    observe() { this.cb([{ contentRect: { width: 400, height: 400 } } as ResizeObserverEntry], this) }
    unobserve() {}
    disconnect() {}
  }
  window.requestAnimationFrame = cb => frames.push(cb)
  window.cancelAnimationFrame = () => {}
  // A context that draws nothing, counts frames, and records every colour it is handed.
  const ctx = new Proxy({}, {
    get: (_, key) => key === 'clearRect' ? () => { drawn++ }
      : key === 'measureText' ? () => ({ width: 10 })
      : key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({ addColorStop() {} })
      : () => {},
    set: (_, key, value) => { if (key === 'fillStyle' || key === 'strokeStyle') painted.push(value); return true },
  })
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
})

/** Run `n` animation frames, each queueing the next. */
const runFrames = (n: number) => act(async () => {
  for (let i = 0; i < n; i++) frames.splice(0).forEach(cb => cb(0))
})

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [] })
const graph = { nodes: [{ id: 'a', name: 'a', values: { kind: 'k' }, badges: ['1..n'] }], edges: [] }
const tokens = createTheme({ light: { badgeFill: '#111111' }, dark: { badgeFill: '#222222' } })

it('reads the palette once, not per frame, and again on a theme change, which a host override follows', async () => {
  const computed = vi.spyOn(window, 'getComputedStyle')
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  const render = (theme: 'light' | 'dark') => act(async () => {
    root.render(React.createElement(GraphView, { graph, taxonomy, theme, tokens }))
  })

  await render('light')
  await runFrames(1)
  const resolved = computed.mock.calls.length
  const before = drawn
  await runFrames(50)
  expect(drawn - before).toBe(50)
  expect(computed).toHaveBeenCalledTimes(resolved)
  expect(painted).toContain('#111111')

  await render('dark')
  await runFrames(1)
  expect(computed).toHaveBeenCalledTimes(resolved + 1)
  expect(painted).toContain('#222222')
})
