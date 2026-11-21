// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from '../GraphView'
import { createTaxonomy } from '../../graph/taxonomy'
import { createTheme } from '../../styles/tokens'

const frames: FrameRequestCallback[] = []
const painted: unknown[] = []
const fonts: string[] = []
let drawn = 0

beforeEach(() => {
  // A pane an earlier test mounted draws no further frame.
  frames.length = 0
  fonts.length = 0
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
    set: (_, key, value) => {
      if (key === 'fillStyle' || key === 'strokeStyle') painted.push(value)
      if (key === 'font') fonts.push(value)
      return true
    },
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

/** Draw `graph` in a pane mounted under a host carrying `hostStyle`, with `style` on the pane. */
const drawUnder = async (hostStyle: string, style?: React.CSSProperties) => {
  const host = document.body.appendChild(document.createElement('div'))
  host.setAttribute('style', hostStyle)
  await act(async () => {
    createRoot(host).render(React.createElement(GraphView, { graph, taxonomy, style }))
  })
  await runFrames(1)
}

it('draws in the pane\'s --gv-font-sans', async () => {
  await drawUnder('font-family: Palatino', { ['--gv-font-sans' as string]: 'Georgia' })
  expect(fonts.length).toBeGreaterThan(0)
  expect(fonts.every(font => font.endsWith('px Georgia'))).toBe(true)
})

it('draws in the font the pane inherits while --gv-font-sans is left inherit', async () => {
  await drawUnder('font-family: Palatino', { ['--gv-font-sans' as string]: 'inherit' })
  expect(fonts.length).toBeGreaterThan(0)
  expect(fonts.every(font => font.endsWith('px Palatino'))).toBe(true)
})
