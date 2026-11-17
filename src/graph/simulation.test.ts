import { describe, expect, it } from 'vitest'
import { Simulation, axisOptions, defaultParamsFor, labelledParams, pairTuning, retunedFor, withPushOverride } from './simulation'
import type { ForceParams, Layout } from './simulation'
import { layoutFrame, resolvePhysics } from './forces'
import { createTaxonomy, engineOf } from './taxonomy'
import { identityMapping, mappingKey } from './axis'
import { readableGraph } from './model'
import type { Graph, GraphNode } from './model'

const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [{ id: 'service', label: 'service', color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } }],
})
const node = (id: string): GraphNode => ({ id, name: id, values: { kind: 'service' } })
const graph: Graph = {
  nodes: ['a', 'b', 'c', 'd'].map(node),
  edges: [{ id: 'ab', sourceId: 'a', targetId: 'b' }, { id: 'cd', sourceId: 'c', targetId: 'd' }],
}
// What the view's hook hands over: the taxonomy's defaults under a patch, resolved and framed over the graph.
const layoutOf = (patch: Partial<ForceParams> = {}): Layout => {
  const params = { ...defaultParamsFor(taxonomy), ...patch }
  const resolved = resolvePhysics(params, taxonomy)
  return { params, resolved, frame: layoutFrame(readableGraph(graph), resolved) }
}
const positions = new Map([['a', { x: 0, y: 0 }], ['b', { x: 150, y: 0 }], ['c', { x: 0, y: 400 }], ['d', { x: 150, y: 400 }]])

// Each node's x velocity after one tick under the given cohesion.
const pushed = (cohesion: ReadonlyMap<string, number>) => {
  const sim = new Simulation(graph, layoutOf(), () => 0.5, positions)
  sim.setCohesion(cohesion)
  sim.tick()
  return new Map(sim.nodes.map(n => [n.id, n.vx]))
}

describe('Simulation.setCohesion', () => {
  it('springs a listed edge at its factor times its stiffness, and leaves an unlisted one alone', () => {
    const slack = pushed(new Map([['ab', 0]]))
    const plain = pushed(new Map())
    const tripled = pushed(new Map([['ab', 3]]))
    const spring = plain.get('a')! - slack.get('a')!
    expect(spring).not.toBe(0)
    expect(tripled.get('a')! - slack.get('a')!).toBeCloseTo(3 * spring)
    expect(tripled.get('c')).toBe(plain.get('c'))
  })
})

// A simulation that cools fast to the given threshold, from the start or cool.
const simAt = (alphaMin: number, cool = false): Simulation => {
  const sim = new Simulation(graph, layoutOf({ alphaDecay: 0.25, alphaMin }), () => 0.5)
  if (cool) sim.cool()
  return sim
}

// Ticks until the simulation reports stable, or -1 past 100.
const ticksToStop = (sim: Simulation): number => {
  for (let n = 0; n <= 100; n++) {
    if (sim.isStable()) return n
    sim.tick()
  }
  return -1
}

describe('Simulation', () => {
  it('stops at the tick alpha reaches 0 when the threshold is 0', () => {
    expect(ticksToStop(simAt(0))).toBe(4)
  })

  it('stops at the first tick alpha falls below any other threshold', () => {
    expect(ticksToStop(simAt(0.3))).toBe(3)
  })

  it('ticks once from cool, at the threshold', () => {
    expect(ticksToStop(simAt(0.3, true))).toBe(1)
  })

  it('ticks not at all from cool when the threshold is 0', () => {
    expect(ticksToStop(simAt(0, true))).toBe(0)
  })
})

describe('a declared pair mapping', () => {
  const kinds = ['scheduler', 'router', 'worker', 'store']
  const declaring = createTaxonomy({
    styleAxis: 'kind',
    styles: kinds.map(id => ({ id, label: id, color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } })),
    filterAxes: [{ id: 'team', emptyMeans: 'all' }],
    pairMappings: [{
      id: 'role', label: 'Role', axis: 'kind', buckets: [
        { id: 'control', label: 'Control', abbreviation: 'C', values: ['scheduler', 'router'] },
        { id: 'work', label: 'Work', abbreviation: 'W', values: ['worker', 'store'] },
      ],
    }],
  })
  const byKind: Graph = {
    nodes: kinds.map(kind => ({ id: kind, name: kind, values: { kind, team: 'core' } })),
    edges: [
      { id: 'sw', sourceId: 'scheduler', targetId: 'worker' },
      { id: 'rs', sourceId: 'router', targetId: 'store' },
      { id: 'sr', sourceId: 'scheduler', targetId: 'router' },
    ],
  }

  it('is offered after the style axis and before the observed values, with its counts', () => {
    const options = axisOptions(declaring, byKind)
    expect(options.map(o => o.mapping.id)).toEqual(['kind:identity', 'role', 'team:identity'])
    expect(options[1]).toMatchObject({ pushTokens: 2, pullTokens: 2 })
  })

  it('keys apart from the view\'s mappings whatever its id', () => {
    const named = createTaxonomy({ styleAxis: 'kind', styles: [], pairMappings: [{ ...engineOf(declaring).pairMappings[0], id: 'kind:identity' }] })
    const keys = axisOptions(named, byKind).map(o => mappingKey(o.mapping))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps its overrides when the graph changes', () => {
    const params = { ...defaultParamsFor(declaring), pair: withPushOverride(pairTuning(engineOf(declaring).pairMappings[0]), 'control', { charge: 1, coreRadius: 2 }) }
    const grown: Graph = { ...byKind, nodes: [...byKind.nodes, { id: 'w2', name: 'w2', values: { kind: 'worker', team: 'edge' } }] }
    expect(retunedFor(params, declaring, grown).pair).toBe(params.pair)
  })
})

describe('labelledParams', () => {
  const taxonomy = createTaxonomy({
    styleAxis: 'kind',
    styles: [{ id: 'svc', label: 'Service', color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } }],
    filterAxes: [{ id: 'login', emptyMeans: 'all' }],
  })
  const params = { ...defaultParamsFor(taxonomy), bandX: { mapping: identityMapping(taxonomy.axisFor('login')!, ['ada', 'grace']), overrides: new Map() } }

  it('names the controls\' buckets by labels, keeping their ids', () => {
    const named = labelledParams(params, taxonomy, { login: { ada: 'Ada Lovelace' }, kind: { svc: 'Backend' } })
    const buckets = (named.bandX as typeof params.bandX).mapping.buckets
    expect(buckets.map(b => [b.id, b.label, b.abbreviation])).toEqual([['ada', 'Ada Lovelace', 'Ad'], ['grace', 'grace', 'gr']])
    expect(named.pair.mapping.buckets.map(b => [b.id, b.label])).toEqual([['svc', 'Backend']])
  })

  it('names a style bucket labels does not name by the style axis\'s labelFor', () => {
    const filtered = createTaxonomy({
      styleAxis: 'kind',
      styles: ['svc', 'db'].map(id => ({ id, label: `${id} style`, color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } })),
      filterAxes: [{ id: 'kind', emptyMeans: 'none', labelFor: v => (v === 'db' ? 'Database' : `${v} style`) }],
    })
    const named = labelledParams(defaultParamsFor(filtered), filtered, { kind: { svc: 'Service' } })
    expect(named.pair.mapping.buckets.map(b => b.label)).toEqual(['Service', 'Database'])
  })

  it('hands back the same parameters with no labels', () => {
    expect(labelledParams(params, taxonomy, undefined)).toBe(params)
  })
})
