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

let viewport: Viewport = DEFAULT_VIEWPORT
vi.mock('./GraphCanvas', () => ({
  GraphCanvas: (props: { viewport: Viewport }) => { viewport = props.viewport; return null },
}))

const area = { width: 800, height: 600 }
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

const tick = (n = Infinity) => act(async () => {
  for (let i = 0; i < n && frames.size; i++) {
    const due = [...frames.values()]
    frames = new Map()
    for (const cb of due) cb(performance.now())
  }
})

// A style gives the nodes a charge, which spreads them: with none they
// collapse within a pixel, and their frame barely moves when they do.
const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [{ id: 'node' }], filterAxes: [] })
const graphOf = (...ids: string[]): Graph => ({
  nodes: ids.map(id => ({ id, name: id, values: { kind: 'node' } })),
  edges: ids.slice(1).map(id => ({ id: `${ids[0]}-${id}`, sourceId: ids[0]!, targetId: id })),
})
const first = graphOf('a', 'b', 'c')
const grown = graphOf('a', 'b', 'c', 'd')

async function mount(start: Graph, defaultPositions?: ReadonlyMap<string, { x: number; y: number }>) {
  const ref = React.createRef<GraphViewHandle>()
  const selections: string[] = []
  const root = createRoot(document.createElement('div'))
  const render = (graph: Graph) => act(async () => {
    root.render(React.createElement(GraphView, { ref, graph, taxonomy, defaultPositions, onSelectionChange: n => selections.push(n.map(x => x.id).join()) }))
  })
  await render(start)
  const frame = (ids: string[]) => {
    const nodes = [...ref.current!.getPositions()].map(([id, p]) => ({ id, ...p }))
    return frameView(viewport, { ids }, nodes as SimNode[], { ...area, insets: { top: 0, right: 0, bottom: 0, left: 0 } })
  }
  return { ref, render, selections, frame }
}

it('frames a graph that follows one that drew no node', async () => {
  const view = await mount(graphOf())
  await view.render(first)
  await tick()
  expect(view.frame(first.nodes.map(n => n.id))).toBe(viewport)
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
  expect(view.selections).toEqual(['a', ''])
})

it('carries a held frame over a reload, on the new graph\'s nodes among its ids', async () => {
  // `d` starts far from the others, not at random: framing it moves the view,
  // and its pull on `a` over the reload's tick moves their frame, which a
  // dropped hold would leave behind.
  const view = await mount(first, new Map([['d', { x: 3000, y: 2000 }]]))
  // Once the opening frame holds.
  while (frames.size && viewport === DEFAULT_VIEWPORT) await tick(1)
  await view.render(grown)
  await tick(1)
  expect(view.frame(first.nodes.map(n => n.id))).toBe(viewport)
  expect(view.frame(grown.nodes.map(n => n.id))).not.toBe(viewport)
})

it('frames the opening on its first tick, while the layout is hot', async () => {
  await mount(first)
  await tick(1)
  expect(viewport).not.toBe(DEFAULT_VIEWPORT)
})

const kept = new Map([['a', { x: 0, y: 0 }], ['b', { x: 300, y: 100 }], ['c', { x: -200, y: 400 }]])

it('frames a reload that opens at rest, in its one tick', async () => {
  const view = await mount(first, kept)
  await tick()
  expect(view.frame(first.nodes.map(n => n.id))).toBe(viewport)
  for (const [id, p] of view.ref.current!.getPositions()) expect(Math.hypot(p.x - kept.get(id)!.x, p.y - kept.get(id)!.y)).toBeLessThan(0.01)
})

for (const strict of [false, true]) {
  it(`frames a reload that opens at rest when its one tick beats the render${strict ? ', under StrictMode' : ''}`, async () => {
    window.requestAnimationFrame = cb => { cb(performance.now()); return 0 }
    const view = React.createElement(GraphView, { graph: first, taxonomy, defaultPositions: kept })
    await act(async () => { createRoot(document.createElement('div')).render(strict ? React.createElement(React.StrictMode, null, view) : view) })
    expect(viewport).not.toBe(DEFAULT_VIEWPORT)
  })
}

it('frames a reload that opens at rest when the pane measures after its one tick', async () => {
  const resized: (() => void)[] = []
  window.ResizeObserver = class Observer { constructor(cb: ResizeObserverCallback) { resized.push(() => cb([], this)) } observe() {} unobserve() {} disconnect() {} }
  area.width = 0
  const view = await mount(first, kept)
  await tick()
  expect(viewport).toBe(DEFAULT_VIEWPORT)
  area.width = 800
  await act(async () => resized.forEach(cb => cb()))
  expect(viewport).not.toBe(DEFAULT_VIEWPORT)
  expect(view.frame(first.nodes.map(n => n.id))).toBe(viewport)
  for (const [id, p] of view.ref.current!.getPositions()) expect(Math.hypot(p.x - kept.get(id)!.x, p.y - kept.get(id)!.y)).toBeLessThan(0.01)
})
