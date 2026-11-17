// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView, type GraphViewHandle } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import type { Graph } from '../graph/model'
import type { SimNode } from '../graph/simulation'
import { DEFAULT_VIEWPORT, type Viewport } from '../graph/viewport'
import { frameView } from './graph-view/frame'

interface CanvasProps { viewport: Viewport; flashNode: { id: string } | null; onViewportChange: (vp: Viewport) => void }
let canvas: CanvasProps
vi.mock('./GraphCanvas', () => ({
  GraphCanvas: (props: CanvasProps) => { canvas = props; return null },
}))

const area = { width: 800, height: 600 }
let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return new DOMRect(0, 0, ...(this.classList.contains('gv-graph-view') ? [area.width, area.height] : [0, 0]))
  }
  frames = new Map()
  window.requestAnimationFrame = cb => { frames.set(++nextFrame, cb); return nextFrame }
  window.cancelAnimationFrame = id => { frames.delete(id) }
})

const tick = (n = Infinity) => act(async () => {
  for (let i = 0; i < n && frames.size; i++) {
    const due = [...frames.values()]
    frames = new Map()
    for (const cb of due) cb(performance.now())
  }
})

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [] })
const graph: Graph = {
  nodes: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id, values: {} })),
  edges: [{ id: 'a-b', sourceId: 'a', targetId: 'b' }, { id: 'c-d', sourceId: 'c', targetId: 'd' }],
}
// The two pairs start far apart, so a frame of one is not a frame of both.
const defaultPositions = new Map([['a', { x: 0, y: 0 }], ['b', { x: 100, y: 0 }], ['c', { x: 2000, y: 1500 }], ['d', { x: 2100, y: 1500 }]])

async function mount() {
  const ref = React.createRef<GraphViewHandle>()
  const selections: (string | null)[] = []
  const root = createRoot(document.createElement('div'))
  await act(async () => {
    root.render(React.createElement(GraphView, { ref, graph, taxonomy, defaultPositions, onSelectionChange: n => selections.push(n?.id ?? null) }))
  })
  await tick()
  const frame = (ids: string[]) => {
    const nodes = [...ref.current!.getPositions()].map(([id, p]) => ({ id, ...p }))
    return frameView(canvas.viewport, { ids }, nodes as SimNode[], { ...area, overlay: 0 })
  }
  return { ref, selections, frame }
}

it('frames the target with its neighbors, holds, selects it, and flashes it once settled', async () => {
  const view = await mount()
  expect(canvas.viewport).not.toBe(DEFAULT_VIEWPORT)
  await act(async () => { view.ref.current!.focusNode('a') })
  await tick(1)
  expect(view.frame(['a', 'b'])).toBe(canvas.viewport)
  expect(view.frame(['a', 'b', 'c', 'd'])).not.toBe(canvas.viewport)
  expect(canvas.flashNode).toBeNull()

  await tick()
  expect(view.frame(['a', 'b'])).toBe(canvas.viewport)
  expect(canvas.flashNode?.id).toBe('a')
  expect(view.selections).toEqual(['a'])
})

it('selects the target of a focus the user lets go before it frames', async () => {
  const view = await mount()
  await act(async () => { view.ref.current!.focusNode('a') })
  await act(async () => canvas.onViewportChange(canvas.viewport))
  await tick()
  expect(view.selections).toEqual(['a'])
  expect(canvas.flashNode).toBeNull()
})
