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
