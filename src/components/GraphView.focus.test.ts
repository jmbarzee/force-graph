// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView, type GraphViewHandle, type GraphViewProps } from './GraphView'
import type { FocusRequest } from './graph-view/focus'
import type { FilterState } from '../filter/types'
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

// Under a controlled filter: `n0` is hidden until the host widens `team`, and
// `n2`, with no `site`, no filter can show.
const teams = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [{ id: 'team', emptyMeans: 'none' }, { id: 'site', emptyMeans: 'none' }] })
const staff: Graph = {
  nodes: ([['n0', { team: 'a', site: 'x' }], ['n1', { team: 'b', site: 'x' }], ['n2', { team: 'a' }]] as const).map(([id, values]) => ({ id, name: id, values })),
  edges: [],
}
const hidesN0: FilterState = new Map([['team', { except: new Set(['a']) }], ['site', { except: new Set() }]])

async function host() {
  const ref = React.createRef<GraphViewHandle>()
  const asks: Parameters<NonNullable<GraphViewProps['onFilterChange']>>[] = []
  const events: string[] = []
  const root = createRoot(document.createElement('div'))
  const render = (filter: FilterState, focus: FocusRequest | null = null) => act(async () => {
    root.render(React.createElement(GraphView, {
      ref, graph: staff, taxonomy: teams, filter, focus,
      onFilterChange: (...ask) => asks.push(ask),
      onFocusResult: (request, shown) => events.push(`${request.key}:${shown}`),
      onSelectionChange: n => events.push(`select:${n?.id}`),
    }))
  })
  await render(hidesN0)
  await tick()
  return { ref, asks, events, render }
}

it('asks the host to widen, and lands only once the host passes the widened filter back', async () => {
  const view = await host()
  const viewport = canvas.viewport
  const request = { id: 'n0', key: 1 }
  await view.render(hidesN0, request)
  await tick()
  expect(view.asks).toEqual([[expect.any(Map), [], request]])
  expect(view.events).toEqual([])
  expect(canvas.viewport).toBe(viewport)

  await view.render(view.asks[0]![0], request)
  expect(view.events).toEqual(['1:true', 'select:n0'])
})

it('reports false, and selects nothing, when the host passes back a filter that still hides the node', async () => {
  const view = await host()
  const request = { id: 'n0', key: 1 }
  await view.render(hidesN0, request)
  await view.render(new Map([['team', { except: new Set(['a', 'b']) }]]), request)
  expect(view.events).toEqual(['1:false'])
})

it('reports false, and asks nothing, for a node no filter can show', async () => {
  const view = await host()
  await view.render(hidesN0, { id: 'n2', key: 1 })
  expect(view.events).toEqual(['1:false'])
  expect(view.asks).toEqual([])
})

it('never reports a waiting focus that a newer one replaced', async () => {
  const view = await host()
  await view.render(hidesN0, { id: 'n0', key: 1 })
  await view.render(hidesN0, { id: 'n1', key: 2 })
  await view.render(view.asks[0]![0], { id: 'n1', key: 2 })
  expect(view.events).toEqual(['2:true', 'select:n1'])
})

it('withdraws a waiting focus that null replaces in the commit that brings the widened filter', async () => {
  const view = await host()
  await view.render(hidesN0, { id: 'n0', key: 1 })
  await view.render(view.asks[0]![0], null)
  expect(view.events).toEqual([])
})

it('withdraws a waiting focus that a newer one replaces in the commit that brings the widened filter', async () => {
  const view = await host()
  await view.render(hidesN0, { id: 'n0', key: 1 })
  await view.render(view.asks[0]![0], { id: 'n1', key: 2 })
  expect(view.events).toEqual(['2:true', 'select:n1'])
})

it('builds a second handle focus on the host filter, not the widening still waiting', async () => {
  const view = await host()
  await act(async () => {
    view.ref.current!.focusNode('n0')
    view.ref.current!.focusNode('n0')
  })
  expect(view.asks).toHaveLength(2)
  expect(view.events).toEqual([])
})

it("marks the handle's widening with the node's id", async () => {
  const view = await host()
  await act(async () => { expect(view.ref.current!.focusNode('n0')).toBe(true) })
  expect(view.asks).toEqual([[expect.any(Map), [], { id: 'n0' }]])
  expect(view.events).toEqual([])
})

it('lands a widening on the filter the view keeps itself', async () => {
  const ref = React.createRef<GraphViewHandle>()
  const selections: (string | null)[] = []
  await act(async () => {
    createRoot(document.createElement('div')).render(React.createElement(GraphView, {
      ref, graph: staff, taxonomy: teams, defaultFilter: hidesN0, onSelectionChange: n => selections.push(n?.id ?? null),
    }))
  })
  await act(async () => { ref.current!.focusNode('n0') })
  expect(selections).toEqual(['n0'])
})
