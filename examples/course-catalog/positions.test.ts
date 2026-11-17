import { describe, expect, it } from 'vitest'
import { Simulation, defaultParamsFor } from '../../src/graph/simulation'
import { layoutFrame, resolvePhysics } from '../../src/graph/forces'
import { readableGraph } from '../../src/graph/model'
import { catalog } from './data'
import { buildGraph } from './graph'
import { loadPositions, savePositions } from './positions'
import { taxonomy } from './taxonomy'

const graph = buildGraph(catalog)
// What the view's hook hands the simulation: the taxonomy's defaults, resolved and framed over the graph.
const params = defaultParamsFor(taxonomy)
const resolved = resolvePhysics(params, taxonomy)
const layout = { params, resolved, frame: layoutFrame(readableGraph(graph), resolved) }

// A seeded generator, so the settled layout is the same each run.
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

// What the view does between a build and `onSettled`: tick until the simulation stops on its own.
function settle(sim: Simulation) {
  while (!sim.isStable()) sim.tick()
  return new Map(sim.nodes.map(n => [n.id, { x: n.x, y: n.y }]))
}

function memoryStore() {
  const items = new Map<string, string>()
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) }
}

describe('kept positions', () => {
  it('are none before the view first settles', () => {
    expect(loadPositions(memoryStore())).toBeUndefined()
  })

  it('are none when what was kept does not parse', () => {
    const store = memoryStore()
    store.setItem('course-catalog.positions', '{')
    expect(loadPositions(store)).toBeUndefined()
  })

  it('open a reload with every node where it came to rest', () => {
    const store = memoryStore()
    const rested = settle(new Simulation(graph, layout, seeded(1)))
    savePositions(store, rested)

    const kept = loadPositions(store)
    expect(kept).toEqual(rested)
    const reloaded = new Simulation(graph, layout, seeded(2), kept)
    for (const n of reloaded.nodes) expect({ x: n.x, y: n.y }).toEqual(rested.get(n.id))
  })
})
