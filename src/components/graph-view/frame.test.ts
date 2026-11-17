import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEWPORT, worldToScreen } from '../../graph/viewport'
import { Simulation, defaultParamsFor } from '../../graph/simulation'
import { layoutFrame, resolvePhysics } from '../../graph/forces'
import type { SimNode } from '../../graph/simulation'
import { createTaxonomy } from '../../graph/taxonomy'
import { readableGraph } from '../../graph/model'
import type { Graph } from '../../graph/model'
import { frameQueue, frameView } from './frame'
import type { FrameRequest } from './frame'

const node = (id: string, x: number, y: number) => ({ id, x, y }) as SimNode
const drawn = [node('a', -100, -50), node('b', 200, 80), node('c', 40, 300)]
const area = { width: 800, height: 600, overlay: 120 }
const vp = { x: 10, y: 20, scale: 0.5 }

describe('frameView', () => {
  it('places every drawn node, and no hidden one, inside the canvas below the overlay', () => {
    const hidden = node('h', 5000, -5000)
    const next = frameView(vp, { ids: ['a', 'b', 'c', 'h'] }, drawn, area)
    const inside = (n: SimNode) => {
      const [x, y] = worldToScreen(next, n.x, n.y)
      return x >= 60 && x <= area.width - 60 && y >= area.overlay + 60 && y <= area.height - 60
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
    expect(worldToScreen(next, 200, 80)).toEqual([400, 360])
    expect(frameView(vp, { ids: ['b'], minScale: 0 }, drawn, area).scale).toBe(vp.scale)
  })
})

describe('frameQueue', () => {
  const queued = () => {
    const framed: FrameRequest[] = []
    return { framed, queue: frameQueue(request => { framed.push(request); return true }) }
  }
  const opening = { ids: ['a'], when: 'warm', hold: true } as const

  it('holds a frame from the first warm tick, running its then once', () => {
    const { framed, queue } = queued()
    let thens = 0
    queue.request({ ...opening, then: () => thens++ })
    queue.tick(0.5)
    expect(framed).toEqual([])
    queue.tick(0.29); queue.tick(0.2); queue.tick(0.1)
    expect(framed).toHaveLength(3)
    expect(thens).toBe(1)
  })

  it('releases a held frame, and one waiting to hold, at once', () => {
    const { framed, queue } = queued()
    queue.request(opening)
    queue.release()
    queue.tick(0.1)
    queue.request(opening)
    queue.tick(0.1)
    queue.release()
    queue.tick(0.1)
    expect(framed).toHaveLength(1)
  })

  it('releases a held frame for a newer request, and for a next one acting after it', () => {
    const { framed, queue } = queued()
    const fit = { ids: ['b'] }
    queue.request(opening)
    queue.tick(0.1)
    queue.request(fit)
    queue.tick(0.1)
    const focus = { ids: ['c'], when: 'next' } as const
    queue.request(focus)
    queue.request(opening)
    queue.tick(0.1); queue.tick(0.1)
    expect(framed).toEqual([opening, fit, opening, focus])
  })
})

describe('a held frame over a settling layout', () => {
  const taxonomy = createTaxonomy({
    styleAxis: 'kind',
    styles: [{ id: 'item', label: 'item', color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } }],
  })
  const graph: Graph = {
    nodes: Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, name: `n${i}`, values: { kind: 'item' } })),
    edges: Array.from({ length: 299 }, (_, i) => ({ id: `e${i}`, sourceId: `n${i + 1}`, targetId: `n${Math.floor(i / 3)}` })),
  }
  const area = { width: 1200, height: 800, overlay: 120 }

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
    queue.request({ ids: sim.nodes.map(n => n.id), padding: 0, when: 'warm', hold })
    while (!sim.isStable()) { sim.tick(); queue.tick(sim.alpha) }
    return sim.nodes.every(n => {
      const [x, y] = worldToScreen(vp, n.x, n.y)
      return x > -0.5 && x < area.width + 0.5 && y > area.overlay - 0.5 && y < area.height + 0.5
    })
  }

  it('keeps every node in view below the overlay once settled, which one warm frame does not', () => {
    expect(settledInView(true)).toBe(true)
    expect(settledInView(false)).toBe(false)
  })
})
