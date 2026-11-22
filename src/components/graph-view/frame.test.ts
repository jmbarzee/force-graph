import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEWPORT, worldToScreen } from '../../graph/viewport'
import { Simulation, defaultParamsFor } from '../../graph/simulation'
import { layoutFrame, resolvePhysics } from '../../graph/forces'
import type { SimNode } from '../../graph/simulation'
import { createTaxonomy } from '../../graph/taxonomy'
import { readableGraph } from '../../graph/model'
import type { Graph } from '../../graph/model'
import { chromeInsets, frameQueue, frameView } from './frame'
import type { FrameRequest } from './frame'

const node = (id: string, x: number, y: number) => ({ id, x, y }) as SimNode
const drawn = [node('a', -100, -50), node('b', 200, 80), node('c', 40, 300)]
const area = { width: 800, height: 600, insets: { top: 120, right: 100, bottom: 80, left: 150 } }
const vp = { x: 10, y: 20, scale: 0.5 }

describe('frameView', () => {
  it('places every drawn node, and no hidden one, inside the canvas the chrome leaves clear', () => {
    const hidden = node('h', 5000, -5000)
    const next = frameView(vp, { ids: ['a', 'b', 'c', 'h'] }, drawn, area)
    const { top, right, bottom, left } = area.insets
    const inside = (n: SimNode) => {
      const [x, y] = worldToScreen(next, n.x, n.y)
      return x >= left + 60 && x <= area.width - right - 60 && y >= top + 60 && y <= area.height - bottom - 60
    }
    expect(drawn.every(inside)).toBe(true)
    expect(inside(hidden)).toBe(false)
  })

  it('leaves the viewport as it is when the request names no drawn node', () => {
    expect(frameView(vp, { ids: ['h'] }, drawn, area)).toBe(vp)
  })

  it('leaves the viewport as it is when no framed node would move half a pixel', () => {
    const framed = frameView(vp, { ids: ['a', 'b', 'c'] }, drawn, area)
    const nudged = [node('a', -100.2, -50), drawn[1]!, drawn[2]!]
    expect(frameView(framed, { ids: ['a', 'b', 'c'] }, nudged, area)).toBe(framed)
    expect(frameView(framed, { ids: ['a', 'b', 'c'] }, [node('a', -110, -50), drawn[1]!, drawn[2]!], area)).not.toBe(framed)
  })

  it('centres at the current scale raised to minScale', () => {
    const next = frameView(vp, { ids: ['b'], minScale: 1.2 }, drawn, area)
    expect(next.scale).toBe(1.2)
    expect(worldToScreen(next, 200, 80)).toEqual([425, 320])
    expect(frameView(vp, { ids: ['b'], minScale: 0 }, drawn, area).scale).toBe(vp.scale)
  })

  it.each([
    ['across', { top: 100, right: 400, bottom: 0, left: 300 }, [400, 350]],
    ['down', { top: 300, right: 0, bottom: 200, left: 100 }, [450, 300]],
  ])('frames %s the whole pane where the insets leave twice the padding or less, and the other axis inside them', (_, insets, centre) => {
    const next = frameView(vp, { ids: ['b'], minScale: 1 }, drawn, { width: 800, height: 600, insets })
    expect(worldToScreen(next, 200, 80)).toEqual(centre)
    expect(frameView(vp, { ids: ['a', 'b', 'c'] }, drawn, { width: 800, height: 600, insets }).scale).toBeGreaterThan(0)
  })
})

describe('chromeInsets', () => {
  it('clears each rect from its cheapest side, keeping the deepest on each side', () => {
    // course-catalog's chrome at 1280×800, plus a hidden panel and one off the pane.
    const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom })
    const chrome = [
      rect(0, 0, 1280, 164), // the overlay
      rect(12, 176, 208, 507), // the legend
      rect(371, 718, 909, 752), // the scrubber
      rect(528, 765, 752, 788), // Fit, Auto, Play
      rect(1180, 759, 1268, 788), // Controls
      rect(0, 0, 0, 0),
      rect(1300, 0, 1500, 800),
    ]
    expect(chromeInsets({ width: 1280, height: 800 }, chrome)).toEqual({ top: 164, right: 0, bottom: 82, left: 208 })
  })
})

describe('frameQueue', () => {
  const queued = (drawn = () => true) => {
    const framed: FrameRequest[] = []
    return { framed, queue: frameQueue(request => { if (!drawn()) return false; framed.push(request); return true }) }
  }
  const opening = { ids: ['a'], when: 'drawn', hold: true } as const

  it('holds a frame from the first tick', () => {
    const { framed, queue } = queued()
    queue.request(opening)
    queue.tick(); queue.tick()
    expect(framed).toHaveLength(2)
  })

  it('releases a held frame, and one waiting to hold, at once', () => {
    const { framed, queue } = queued()
    queue.request(opening)
    queue.release()
    queue.tick()
    queue.request(opening)
    queue.tick()
    queue.release()
    queue.tick()
    expect(framed).toHaveLength(1)
  })

  it('keeps, past a settle, a drawn frame the pane holds up, and frames it once when the pane measures', () => {
    let measured = false
    const { framed, queue } = queued(() => measured)
    queue.request(opening)
    queue.tick()
    queue.settle()
    queue.retry()
    expect(framed).toEqual([])
    measured = true
    queue.retry()
    queue.retry()
    queue.tick()
    expect(framed).toHaveLength(1)
  })

  it('drops at a pan a drawn frame a settle kept, and frames nothing when a node then draws', () => {
    let drawn = false
    const { framed, queue } = queued(() => drawn)
    queue.request(opening)
    queue.tick()
    queue.settle()
    queue.release()
    drawn = true
    queue.retry()
    queue.tick()
    expect(framed).toEqual([])
  })

  it('drops a refit\'s drawn frame at a pan before it lands', () => {
    const { framed, queue } = queued()
    queue.request(opening)
    queue.release()
    queue.retry()
    queue.tick()
    expect(framed).toEqual([])
  })

  it('frames a drawn frame at the first resize or commit that draws one of its ids, before any tick, and holds it', () => {
    let measured = false
    const { framed, queue } = queued(() => measured)
    queue.request(opening)
    queue.retry()
    expect(framed).toEqual([])
    measured = true
    queue.retry()
    queue.tick()
    expect(framed).toEqual([opening, opening])
  })

  it('releases a held frame for a newer request, and for a next one acting after it', () => {
    const { framed, queue } = queued()
    const fit = { ids: ['b'] }
    queue.request(opening)
    queue.tick()
    queue.request(fit)
    queue.tick()
    const focus = { ids: ['c'], when: 'next' } as const
    queue.request(focus)
    queue.request(opening)
    queue.tick(); queue.tick()
    expect(framed).toEqual([opening, fit, opening, focus])
  })

  it('keeps a next frame waiting to hold behind a newer drawn one, and holds it after', () => {
    let measured = false
    const { framed, queue } = queued(() => measured)
    const focus = { ids: ['c'], when: 'next', hold: true } as const
    queue.request(focus)
    queue.request(opening)
    queue.tick()
    measured = true
    queue.tick(); queue.tick()
    expect(framed).toEqual([opening, focus, focus])
  })

  it('runs released when a held frame is released, but not for a newer request or before it holds', () => {
    const { queue } = queued()
    let releases = 0
    const focus = { ids: ['a'], when: 'next', hold: true, released: () => releases++ } as const
    queue.request(focus)
    queue.release()
    queue.request(focus)
    queue.tick()
    queue.request({ ids: ['b'] })
    queue.release()
    expect(releases).toBe(0)
    queue.request(focus)
    queue.tick()
    queue.release()
    queue.release()
    expect(releases).toBe(1)
  })
})

describe('a held frame over a settling layout', () => {
  const taxonomy = createTaxonomy({
    styleAxis: 'kind',
    values: [{ id: 'item', label: 'item', color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } }],
  })
  const graph: Graph = {
    nodes: Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, name: `n${i}`, values: { kind: 'item' } })),
    edges: Array.from({ length: 299 }, (_, i) => ({ id: `e${i}`, sourceId: `n${i + 1}`, targetId: `n${Math.floor(i / 3)}` })),
  }
  const area = { width: 1200, height: 800, insets: { top: 120, right: 0, bottom: 0, left: 0 } }

  // A cluster revealed at one point and reheated, as a refit seeds it, framed
  // with no padding so any spread after the frame shows.
  const settledInView = (hold: boolean) => {
    let seed = 1
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const params = defaultParamsFor(taxonomy)
    const resolved = resolvePhysics(params, taxonomy)
    const sim = new Simulation(graph, { params, resolved, frame: layoutFrame(readableGraph(graph), resolved) }, rng, new Map(graph.nodes.map(n => [n.id, { x: rng() * 20, y: rng() * 20 }])))
    sim.reheat(0.5)
    let vp = DEFAULT_VIEWPORT
    const queue = frameQueue(request => { vp = frameView(vp, request, sim.nodes, area); return true })
    queue.request({ ids: sim.nodes.map(n => n.id), padding: 0, when: 'drawn', hold })
    while (!sim.isStable()) { sim.tick(); queue.tick() }
    return sim.nodes.every(n => {
      const [x, y] = worldToScreen(vp, n.x, n.y)
      return x > -0.5 && x < area.width + 0.5 && y > area.insets.top - 0.5 && y < area.height + 0.5
    })
  }

  it('keeps every node in view below the chrome once settled, which one frame does not', () => {
    expect(settledInView(true)).toBe(true)
    expect(settledInView(false)).toBe(false)
  })
})
