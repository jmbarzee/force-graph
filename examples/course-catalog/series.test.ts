import { describe, expect, it } from 'vitest'
import { validateGraph } from '@jmbarzee/force-graph'
import { catalog } from './data'
import { buildGraph } from './graph'
import { taxonomy } from './taxonomy'

describe('a requirement series', () => {
  const graph = buildGraph(catalog)
  const total = (series: readonly number[] = []) => series.reduce((a, b) => a + b, 0)
  const heaviest = Math.max(...graph.edges.map(e => total(e.series)))

  it('totals, over the heaviest total, to its weight', () => {
    expect(graph.edges.length).toBeGreaterThan(0)
    for (const edge of graph.edges) expect(total(edge.series) / heaviest).toBeCloseTo(edge.weight!)
  })

  it('reads against the term', () => {
    expect(validateGraph(graph, taxonomy).filter(d => d.code === 'window-invalid' || d.code === 'edge-series-invalid')).toEqual([])
  })
})
