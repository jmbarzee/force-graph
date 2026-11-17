import { describe, expect, it } from 'vitest'
import { getTransitiveDeps, highlightOf } from './highlight'
import type { GraphEdge, GraphNode } from './model'
import { createTaxonomy } from './taxonomy'

// a → b, and b — c undirected.
const edges: GraphEdge[] = [
  { id: 'ab', sourceId: 'a', targetId: 'b' },
  { id: 'bc', sourceId: 'b', targetId: 'c' },
]
const visible = new Set(['a', 'b', 'c'])
const undirected = new Set(['bc'])

describe('getTransitiveDeps', () => {
  it('walks a directed edge one way and an undirected edge both ways', () => {
    expect(getTransitiveDeps('a', edges, visible, 'downstream', undirected)).toEqual(new Set(['a', 'b', 'c']))
    expect(getTransitiveDeps('b', edges, visible, 'upstream', undirected)).toEqual(new Set(['b', 'a', 'c']))
    expect(getTransitiveDeps('c', edges, visible, 'upstream', undirected)).toEqual(new Set(['c', 'b', 'a']))
    expect(getTransitiveDeps('c', edges, visible, 'downstream', undirected)).toEqual(new Set(['c', 'b']))
  })
})

describe('highlightOf', () => {
  it('lights the union of each active node\'s walk', () => {
    // p → q, and x → y → z, apart; w on neither chain.
    const nodes: GraphNode[] = ['p', 'q', 'x', 'y', 'z', 'w'].map(id => ({ id, name: id, values: {} }))
    const chains: GraphEdge[] = [
      { id: 'pq', sourceId: 'p', targetId: 'q' },
      { id: 'xy', sourceId: 'x', targetId: 'y' },
      { id: 'yz', sourceId: 'y', targetId: 'z' },
    ]
    const byId = new Map(nodes.map(n => [n.id, n]))
    const graph = { visibleNodes: nodes, visibleEdges: chains, visibleIds: new Set(byId.keys()), getNode: (id: string) => byId.get(id) }
    const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [] })
    const lit = highlightOf(taxonomy, [byId.get('p')!, byId.get('x')!], 'downstream', graph, new Set())
    expect(lit.nodes).toEqual(new Set(['p', 'q', 'x', 'y', 'z']))
    expect(lit.edges).toEqual(new Set(['pq', 'xy', 'yz']))
  })
})
