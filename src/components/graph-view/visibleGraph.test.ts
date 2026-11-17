import { describe, expect, it } from 'vitest'
import { computeVisibleGraph, neighborhoodOf } from './visibleGraph'
import { createTaxonomy } from '../../graph/taxonomy'
import { fitToView } from '../../graph/viewport'
import { initialFilter, withSelection } from '../../filter/types'
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
})

describe('neighborhoodOf', () => {
  it('frames the drawn neighbors, not a hidden one far from the node', () => {
    const at: Record<string, [number, number]> = { p1: [0, 0], p2: [100, 0], c1: [5000, 5000], c2: [100, 10] }
    const placed = graph.nodes.map(n => ({ ...n, x: at[n.id][0], y: at[n.id][1] })) as SimNode[]
    const source = { nodes: placed, edges: graph.edges, getNode: (id: string) => placed.find(n => n.id === id) }
    const vg = computeVisibleGraph(source, withSelection(initialFilter(taxonomy, graph), 'kind', new Set(['parent'])), taxonomy)
    const drawn = placed.filter(n => n.id === 'p1' || n.id === 'p2')
    expect(fitToView(neighborhoodOf('p1', vg.visibleNodes, vg.visibleEdges), 800, 600)).toEqual(fitToView(drawn, 800, 600))
  })
})
