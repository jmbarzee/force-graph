import { describe, expect, it } from 'vitest'
import { computeVisibleGraph, neighborhoodOf } from './visibleGraph'
import { createTaxonomy } from '../../graph/taxonomy'
import { GROUPS, initialFilter, withSelection } from '../../filter/types'
import { toggleValue } from '../../filter/toggle'
import { groupsByNode } from '../../graph/groups'
import type { NodeStyle } from '../../graph/shapes'
import type { Graph, GraphEdge, GraphNode } from '../../graph/model'
import type { SimNode } from '../../graph/simulation'

const style = (id: string): NodeStyle => ({
  id, label: id, icon: id, abbreviation: id,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
  size: { r: 10, iconSize: 10 },
})
const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [style('parent'), style('child')] })
const node = (id: string, kind: string, parentId?: string): GraphNode => ({ id, name: id, values: { kind }, parentId })

// Two parents, each holding a child; the children's dependency edge
// graduates to the parents when the children are hidden.
const graph: Graph = {
  nodes: [node('p1', 'parent'), node('p2', 'parent'), node('c1', 'child', 'p1'), node('c2', 'child', 'p2')],
  edges: [
    { id: 'in1', sourceId: 'c1', targetId: 'p1', relation: 'containment' },
    { id: 'in2', sourceId: 'c2', targetId: 'p2', relation: 'containment' },
    { id: 'call', sourceId: 'c1', targetId: 'c2', relation: 'dependency' },
  ] satisfies GraphEdge[],
}
const nodes = graph.nodes as SimNode[]
const sim = { nodes, edges: graph.edges, getNode: (id: string) => nodes.find(n => n.id === id) }

describe('computeVisibleGraph origins', () => {
  it('names each visible edge as given', () => {
    const vg = computeVisibleGraph(sim, withSelection(initialFilter(taxonomy, graph), 'kind', new Set(['parent', 'child'])), taxonomy)
    for (const e of vg.visibleEdges) expect(vg.origins.get(e.id)).toBe(e.id)
  })

  it('names a graduated edge by the edge it stands for', () => {
    const vg = computeVisibleGraph(sim, withSelection(initialFilter(taxonomy, graph), 'kind', new Set(['parent'])), taxonomy)
    const grad = vg.visibleEdges.find(e => e.sourceId === 'p1' && e.targetId === 'p2')
    expect(grad).toBeDefined()
    expect(grad!.id).not.toBe('call')
    expect(vg.origins.get(grad!.id)).toBe('call')
  })

  it("carries the weight of the original the taxonomy's collapse keeps", () => {
    const edges = [...graph.edges, { id: 'heavy', sourceId: 'c1', targetId: 'c2', relation: 'dependency' as const, weight: 0.9 }]
    const heaviest = createTaxonomy({
      styleAxis: 'kind', styles: [style('parent'), style('child')],
      collapse: (kept, candidate) => ((candidate.weight ?? 0) > (kept.weight ?? 0) ? candidate : kept),
    })
    for (const [t, weight] of [[taxonomy, undefined], [heaviest, 0.9]] as const) {
      const vg = computeVisibleGraph({ ...sim, edges }, withSelection(initialFilter(t, graph), 'kind', new Set(['parent'])), t)
      expect(vg.visibleEdges.find(e => e.sourceId === 'p1' && e.targetId === 'p2')!.weight).toBe(weight)
    }
  })
})

describe('computeVisibleGraph undirected', () => {
  it('names a visible edge of an undirected type, graduated or not', () => {
    const peers = createTaxonomy({
      styleAxis: 'kind', styles: [style('parent'), style('child')],
      edgeTypes: [{ id: 'peer', sourceValue: 'child', targetValue: 'child', relation: 'dependency', direction: 'undirected' }],
    })
    const all = computeVisibleGraph(sim, withSelection(initialFilter(peers, graph), 'kind', new Set(['parent', 'child'])), peers)
    expect([...all.undirected]).toEqual(['call'])
    const parents = computeVisibleGraph(sim, withSelection(initialFilter(peers, graph), 'kind', new Set(['parent'])), peers)
    expect([...parents.undirected]).toEqual(['grad:p1↔p2'])
  })

  it('draws one undirected edge on a pair an original joins in the other order', () => {
    const peers = createTaxonomy({
      styleAxis: 'kind', styles: [style('parent'), style('child')],
      edgeTypes: [{ id: 'peer', relation: 'dependency', direction: 'undirected' }],
    })
    const edges = [...graph.edges, { id: 'back', sourceId: 'p2', targetId: 'p1', relation: 'dependency' as const }]
    const vg = computeVisibleGraph({ ...sim, edges }, withSelection(initialFilter(peers, graph), 'kind', new Set(['parent'])), peers)
    expect(vg.visibleEdges.filter(e => e.relation === 'dependency').map(e => e.id)).toEqual(['back'])
  })
})

describe('neighborhoodOf', () => {
  it('leaves out a hidden neighbor', () => {
    const vg = computeVisibleGraph(sim, withSelection(initialFilter(taxonomy, graph), 'kind', new Set(['parent'])), taxonomy)
    expect(neighborhoodOf('p1', vg.visibleNodes, vg.visibleEdges).map(n => n.id)).toEqual(['p1', 'p2'])
  })
})

describe('computeVisibleGraph over groups', () => {
  it("hides a group's only-members and keeps a node a shown group shares, and one in no group", () => {
    const groupsOf = groupsByNode([{ id: 'x', nodeIds: new Set(['c1', 'c2']) }, { id: 'y', nodeIds: new Set(['c2']) }])
    const vg = computeVisibleGraph(sim, toggleValue(initialFilter(taxonomy, graph), GROUPS, 'x'), taxonomy, taxonomy.filterAxes, groupsOf)
    expect([...vg.visibleIds].sort()).toEqual(['c2', 'p1', 'p2'])
  })
})
