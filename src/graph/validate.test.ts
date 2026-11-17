import { describe, expect, it } from 'vitest'
import { dropInvalid, validateGraph } from './validate'
import { createTaxonomy } from './taxonomy'
import type { Graph, GraphNode } from './model'

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [] })
const node = (id: string, parentId?: string): GraphNode => ({ id, name: id, values: {}, parentId })
// `t` hangs off the two-cycle `b`/`c`; `s` is its own parent.
const graph: Graph = { nodes: [node('t', 'c'), node('c', 'b'), node('s', 's'), node('b', 'c')], edges: [] }

describe('a parent cycle', () => {
  const diagnostics = validateGraph(graph, taxonomy)

  it('is one error per cycle, naming its nodes from the first in graph order', () => {
    expect(diagnostics.filter(d => d.code === 'parent-cycle').map(d => [d.nodeId, d.message])).toEqual([
      ['c', 'parentId runs in a cycle: "c" → "b" → "c"; the view clears "c"\'s parent'],
      ['s', 'parentId runs in a cycle: "s" → "s"; the view clears "s"\'s parent'],
    ])
  })

  it('is broken at that first node, leaving a tree', () => {
    expect(dropInvalid(graph, diagnostics).nodes.map(n => n.parentId)).toEqual(['c', undefined, undefined, 'c'])
  })
})

describe('an edge weight', () => {
  const weights = [undefined, 0, 0.5, 1, -0.1, 1.5, NaN, Infinity]
  const weighted: Graph = {
    nodes: [node('a'), node('b')],
    edges: weights.map((weight, i) => ({ id: `e${i}`, sourceId: 'a', targetId: 'b', weight })),
  }
  const diagnostics = validateGraph(weighted, taxonomy).filter(d => d.code === 'edge-weight-invalid')

  it('is a warning outside [0, 1] or not finite', () => {
    expect(diagnostics.map(d => [d.severity, d.edgeId])).toEqual([['warning', 'e4'], ['warning', 'e5'], ['warning', 'e6'], ['warning', 'e7']])
  })

  it('keeps its edge', () => {
    expect(dropInvalid(weighted, diagnostics).edges).toHaveLength(weights.length)
  })
})

describe('a parentId pair no type claims', () => {
  it('is one containment-untyped warning, naming the derived edge', () => {
    const diagnostics = validateGraph({ nodes: [node('p'), node('c', 'p')], edges: [] }, taxonomy)
    expect(diagnostics.filter(d => d.code === 'containment-untyped').map(d => [d.severity, d.edgeId])).toEqual([['warning', 'in:c']])
  })
})

describe('a time window', () => {
  const series = (id: string, counts: number[]) => ({ id, sourceId: 'a', targetId: 'b', series: counts })
  const edges = [series('ok', [0, 2]), series('short', [1]), series('negative', [1, -1]), series('nan', [1, NaN])]
  const everySeries = edges.map(e => ['edge-series-invalid', e.id])
  const named = (window: Graph['window']) =>
    validateGraph({ nodes: [node('a'), node('b')], edges, window }, taxonomy)
      .filter(d => d.code === 'window-invalid' || d.code === 'edge-series-invalid')
      .map(d => [d.code, d.edgeId])

  it('names each series that does not read against it', () => {
    expect(named({ since: 0, until: 10, buckets: 2 })).toEqual(everySeries.slice(1))
  })

  it('names itself when it is not one, and every series with it', () => {
    for (const window of [{ since: 10, until: 10, buckets: 2 }, { since: 0, until: Infinity, buckets: 2 }, { since: 0, until: 10, buckets: 1.5 }, { since: 0, until: 10, buckets: 0 }]) {
      expect(named(window)).toEqual([['window-invalid', undefined], ...everySeries])
    }
  })

  it('is what every series needs', () => {
    expect(named(undefined)).toEqual(everySeries)
  })
})
