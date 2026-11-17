import { describe, expect, it } from 'vitest'
import { Simulation } from './simulation'
import { createTaxonomy } from './taxonomy'
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
const positions = new Map([['a', { x: 0, y: 0 }], ['b', { x: 150, y: 0 }], ['c', { x: 0, y: 400 }], ['d', { x: 150, y: 400 }]])

// Each node's x velocity after one tick under the given cohesion.
const pushed = (cohesion: ReadonlyMap<string, number>) => {
  const sim = new Simulation(graph, undefined, () => 0.5, taxonomy, positions)
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

// Ticks until the simulation reports stable, or -1 past 100.
const ticksToStop = (alphaMin: number): number => {
  const sim = new Simulation(graph, { alphaDecay: 0.25, alphaMin }, () => 0.5, taxonomy)
  for (let n = 0; n <= 100; n++) {
    if (sim.isStable()) return n
    sim.tick()
  }
  return -1
}

describe('Simulation', () => {
  it('stops at the tick alpha reaches 0 when the threshold is 0', () => {
    expect(ticksToStop(0)).toBe(4)
  })

  it('stops at the first tick alpha falls below any other threshold', () => {
    expect(ticksToStop(0.3)).toBe(3)
  })
})
