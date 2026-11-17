// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from './GraphView'
import type { GraphViewHandle } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import type { Graph } from '../graph/model'
import type { SimNode } from '../graph/simulation'
import type { Viewport } from '../graph/viewport'
import { DEFAULT_VIEWPORT } from '../graph/viewport'
import { frameView } from './graph-view/frame'

// The canvas, reduced to the viewport it is handed.
let viewport: Viewport = DEFAULT_VIEWPORT
vi.mock('./GraphCanvas', () => ({
  GraphCanvas: (props: { viewport: Viewport }) => { viewport = props.viewport; return null },
}))

const area = { width: 800, height: 600 }
// The loop's waiting frames, by id; `tick` runs them.
let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  // The pane measures `area`; the overlay over it, nothing.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return new DOMRect(0, 0, ...(this.classList.contains('gv-graph-view') ? [area.width, area.height] : [0, 0]))
  }
  frames = new Map()
  window.requestAnimationFrame = cb => { frames.set(++nextFrame, cb); return nextFrame }
  window.cancelAnimationFrame = id => { frames.delete(id) }
  viewport = DEFAULT_VIEWPORT
})

/** Run the loop `n` ticks, or until it stops asking for another. */
const tick = (n = Infinity) => act(async () => {
  for (let i = 0; i < n && frames.size; i++) {
    const due = [...frames.values()]
    frames = new Map()
    for (const cb of due) cb(performance.now())
  }
})

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [] })
const graphOf = (...ids: string[]): Graph => ({
  nodes: ids.map(id => ({ id, name: id, values: {} })),
  edges: ids.slice(1).map(id => ({ id: `${ids[0]}-${id}`, sourceId: ids[0]!, targetId: id })),
})
const first = graphOf('a', 'b', 'c')
const grown = graphOf('a', 'b', 'c', 'd')

async function mount(start: Graph) {
  const ref = React.createRef<GraphViewHandle>()
  const selections: (string | null)[] = []
  const root = createRoot(document.createElement('div'))
  const render = (graph: Graph) => act(async () => {
    root.render(React.createElement(GraphView, { ref, graph, taxonomy, onSelectionChange: n => selections.push(n?.id ?? null) }))
  })
  await render(start)
  return { ref, render, selections }
}

it('frames a graph that follows one that drew no node', async () => {
  const view = await mount(graphOf())
  await tick()
  await view.render(first)
  await tick()
  expect(viewport).not.toEqual(DEFAULT_VIEWPORT)
})

it('keeps the positions, the viewport and its selection over a reload', async () => {
  const view = await mount(first)
  await tick()
  await act(async () => view.ref.current!.select('a'))
  const framed = viewport
  const before = view.ref.current!.getPositions()

  await view.render(grown)
  const after = view.ref.current!.getPositions()
  for (const [id, p] of before) expect(after.get(id)).toEqual(p)
  await tick()
  expect(viewport).toBe(framed)
  expect(view.selections).toEqual(['a'])

  await view.render(graphOf('b', 'c'))
  expect(view.selections).toEqual(['a', null])
})

it('carries a held frame over a reload, on the new graph\'s nodes among its ids', async () => {
  const view = await mount(first)
  // Past the warm-up, while the opening frame still holds.
  while (frames.size && viewport === DEFAULT_VIEWPORT) await tick(1)
  await view.render(grown)
  await tick(1)
  const nodes = [...view.ref.current!.getPositions()].map(([id, p]) => ({ id, ...p }))
  const frame = (ids: string[]) => frameView(viewport, { ids }, nodes as SimNode[], { ...area, overlay: 0 })
  expect(frame(first.nodes.map(n => n.id))).toBe(viewport)
  expect(frame(grown.nodes.map(n => n.id))).not.toBe(viewport)
})
