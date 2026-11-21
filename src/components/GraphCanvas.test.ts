// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { drawGhosts, drawRing, edgeAt, FOCUS_DASH, GraphCanvas, SELECTION_WIDTH } from './GraphCanvas'
import { TaxonomyContext } from './graph-view/useTaxonomy'
import { createTaxonomy } from '../graph/taxonomy'
import type { GraphEdge } from '../graph/model'
import type { EdgeStroke } from '../graph/scheme'
import { NEUTRAL_STROKE } from '../graph/shapes'
import { DEFAULT_NODE_SCALE } from '../graph/node-scale'
import type { SimNode } from '../graph/simulation'

const at = new Map([['a', { x: 0, y: 0 }], ['b', { x: 100, y: 0 }], ['c', { x: 0, y: 10 }], ['d', { x: 100, y: 10 }]])
const vp = { x: 0, y: 0, scale: 1 }
const ab: GraphEdge = { id: 'ab', sourceId: 'a', targetId: 'b' }
const cd: GraphEdge = { id: 'cd', sourceId: 'c', targetId: 'd' }
const none = new Map<string, number>()
const drawn = new Map<GraphEdge, EdgeStroke>()

describe('edgeAt', () => {
  it('takes the nearest of the edges in reach', () => {
    expect(edgeAt(50, 4, [ab, cd], at, vp, none, drawn)).toBe(ab)
    expect(edgeAt(50, 6, [ab, cd], at, vp, none, drawn)).toBe(cd)
  })

  it('reaches 4 screen pixels from the stroke, and no further', () => {
    expect(edgeAt(50, 4, [ab], at, vp, none, drawn)).toBe(ab)
    expect(edgeAt(50, 4.5, [ab], at, vp, none, drawn)).toBeNull()
    expect(edgeAt(104.5, 0, [ab], at, vp, none, drawn)).toBeNull()
    expect(edgeAt(100, 5, [ab], at, { x: 0, y: 0, scale: 2 }, none, drawn)).toBeNull()
  })

  it('passes over an edge stroked at alpha 0, which is not drawn', () => {
    const unplayed = new Map([[ab, { ...NEUTRAL_STROKE, alpha: 0 }]])
    const near = new Map([...at, ['e', { x: 0, y: 4 }], ['f', { x: 100, y: 4 }]])
    const ef: GraphEdge = { id: 'ef', sourceId: 'e', targetId: 'f' }
    expect(edgeAt(50, 1, [ab, ef], near, vp, none, drawn)).toBe(ab)
    expect(edgeAt(50, 1, [ab, ef], near, vp, none, unplayed)).toBe(ef)
    expect(edgeAt(50, 0, [ab], near, vp, none, unplayed)).toBeNull()
  })

  it('hits an edge in its lane, not on the line between its ends', () => {
    const ba: GraphEdge = { id: 'ba', sourceId: 'b', targetId: 'a' }
    const lanes = new Map([['ab', 7], ['ba', -7]])
    expect(edgeAt(50, 7, [ab, ba], at, vp, lanes, drawn)).toBe(ab)
    expect(edgeAt(50, -7, [ab, ba], at, vp, lanes, drawn)).toBe(ba)
    expect(edgeAt(50, 0, [ab, ba], at, vp, lanes, drawn)).toBeNull()
  })
})

interface Paint { op: 'fill' | 'stroke'; x?: number; y?: number; radius?: number; color: unknown; width: number; dash: number[]; alpha: number }

/** A context that records each fill and stroke, with its arc (none for a path) and the state it was drawn in; every other call does nothing. */
function recordingCtx() {
  const paints: Paint[] = []
  let arc: { x: number; y: number; radius: number } | undefined, dash: number[] = []
  const state: Record<string | symbol, unknown> = { lineWidth: 1, globalAlpha: 1 }
  const paint = (op: Paint['op']) => () => {
    paints.push({ op, ...arc, color: state[op === 'fill' ? 'fillStyle' : 'strokeStyle'], width: state.lineWidth as number, dash, alpha: state.globalAlpha as number })
  }
  const calls: Record<string, unknown> = {
    setLineDash: (d: number[]) => { dash = d },
    beginPath: () => { arc = undefined },
    arc: (x: number, y: number, radius: number) => { arc = { x, y, radius } },
    fill: paint('fill'),
    stroke: paint('stroke'),
    measureText: () => ({ width: 0 }),
  }
  const ctx = new Proxy(state, {
    get: (t, k) => calls[k as string] ?? (k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, paints }
}

describe('drawRing', () => {
  it('strokes 2px clear of the edge, and answers its outer edge', () => {
    const { ctx, paints } = recordingCtx()
    expect(drawRing(ctx, 0, 0, 10, 2, 'red', [3, 3], 0.2)).toBe(14)
    expect(paints).toEqual([{ op: 'stroke', x: 0, y: 0, radius: 13, color: 'red', width: 2, dash: [3, 3], alpha: 0.2 }])
  })

  it('stacks each ring where the one inside it ends', () => {
    const { ctx, paints } = recordingCtx()
    let edge = 10
    for (const width of [2, 2, 2.5, 2]) edge = drawRing(ctx, 0, 0, edge, width, 'c', [], 1)
    expect(paints.map(s => s.radius)).toEqual([13, 17, 21.25, 25.5])
  })
})

describe('drawGhosts', () => {
  it('fills and borders two copies of the body, the back one first, each a fifth of r further up and right and fainter', () => {
    const { ctx, paints } = recordingCtx()
    drawGhosts(ctx, 0, 0, 10, 'fill', 'border', 1.5, 0.8)
    const ghost = (o: number, alpha: number) => [
      { op: 'fill', x: o, y: -o, radius: 10, color: 'fill', width: 1.5, dash: [], alpha },
      { op: 'stroke', x: o, y: -o, radius: 10, color: 'border', width: 1.5, dash: [], alpha },
    ]
    expect(paints).toEqual([...ghost(4, 0.2), ...ghost(2, 0.4)])
  })
})

describe('GraphCanvas', () => {
  it('clears node and edge hover when the pointer leaves it', () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
    const onHoverNode = vi.fn()
    const onHoverEdge = vi.fn()
    const props = { nodes: [], edges: [], onHoverNode, onHoverEdge } as unknown as React.ComponentProps<typeof GraphCanvas>
    const el = document.body.appendChild(document.createElement('div'))
    const root = createRoot(el)
    act(() => root.render(React.createElement(TaxonomyContext.Provider, { value: createTaxonomy({ styleAxis: 'kind', values: [] }) },
      React.createElement(GraphCanvas, props))))
    act(() => { el.querySelector('canvas')!.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })) })
    expect(onHoverNode).toHaveBeenCalledWith(null)
    expect(onHoverEdge).toHaveBeenCalledWith(null)
    act(() => root.unmount())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Paints one frame of a canvas over `props`, its viewport at (200, 200), and answers what it painted. */
  function paintFrame(props: Partial<React.ComponentProps<typeof GraphCanvas>>) {
    const { ctx, paints } = recordingCtx()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.stubGlobal('ResizeObserver', class {
      constructor(private cb: (entries: unknown[]) => void) {}
      observe() { this.cb([{ contentRect: { width: 400, height: 400 } }]) }
      disconnect() {}
    })
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const all = {
      edges: [], viewport: { x: 200, y: 200, scale: 1 }, nodeScale: DEFAULT_NODE_SCALE, theme: 'light',
      selectedNodeIds: new Set(), focusedNodeId: null, highlightedNodes: null, highlightedEdges: null, hoveredNodeId: null,
      hoveredEdgeId: null, flashNode: null, searchMatchIds: null, running: false, edgeStrokes: new Map(), edgeOffsets: new Map(),
      undirectedEdges: new Set(), activeSection: null, groupGlows: [], markedEdges: new Set(), ...props,
    } as unknown as React.ComponentProps<typeof GraphCanvas>
    const el = document.body.appendChild(document.createElement('div'))
    const root = createRoot(el)
    act(() => root.render(React.createElement(TaxonomyContext.Provider, { value: createTaxonomy({ styleAxis: 'kind', values: [] }) },
      React.createElement(GraphCanvas, all))))
    act(() => frame!(0))
    act(() => root.unmount())
    return paints
  }

  const simNode = (id: string, x: number, extra: Partial<SimNode> = {}): SimNode =>
    ({ id, name: id, values: {}, x, y: 0, vx: 0, vy: 0, pinned: false, ...extra })

  it('paints stacked nodes\' ghosts behind every edge, and rings only the body', () => {
    // A stacked course at screen (200, 200), and its stacked lab at (300, 200), selected and focused.
    const paints = paintFrame({
      nodes: [simNode('course', 0, { stack: true }), simNode('lab', 100, { stack: true, parentId: 'course' })],
      edges: [{ id: 'e', sourceId: 'lab', targetId: 'course' }], selectedNodeIds: new Set(['lab']), focusedNodeId: 'lab',
    })

    const onBody = (p: Paint) => p.y === 200 && (p.x === 200 || p.x === 300)
    const ghosts = paints.filter(p => p.radius !== undefined && !onBody(p))
    expect(ghosts.filter(p => p.op === 'fill')).toHaveLength(4)
    const labBody = paints.find(p => p.op === 'fill' && p.x === 300 && p.y === 200)!
    expect(ghosts.find(p => p.op === 'fill')!.color).toBe(labBody.color)
    const firstEdge = paints.findIndex(p => p.op === 'stroke' && p.radius === undefined)
    expect(paints.indexOf(ghosts[ghosts.length - 1])).toBeLessThan(firstEdge)
    const rings = paints.filter(p => p.width === SELECTION_WIDTH || p.dash === FOCUS_DASH)
    expect(rings.map(p => [p.x, p.y])).toEqual([[300, 200], [300, 200]])
  })

  it('starts a flash outside the node\'s rings', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    // Two copies of one entity, the first dashed, hovered and flashing.
    const paints = paintFrame({
      nodes: [simNode('a', 0, { copyKey: 'k', ring: 'dashed' }), simNode('b', 100, { copyKey: 'k' })],
      hoveredNodeId: 'a', flashNode: { id: 'a', at: 1000 },
    })

    const halo = paints.find(p => p.op === 'stroke' && p.alpha === 0.55 && p.x === 200)!
    const flash = paints.find(p => p.op === 'stroke' && p.width === 3)!
    expect(flash.radius! - flash.width / 2).toBeGreaterThan(halo.radius! + halo.width / 2)
  })
})
