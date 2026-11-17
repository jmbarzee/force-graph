import { describe, expect, it } from 'vitest'
import { countsOn, initialFilter } from '@jmbarzee/force-graph'
import { catalog } from './data'
import { buildGraph } from './graph'
import { CAMPUS, ENTITY, taxonomy } from './taxonomy'

describe('faceted counts', () => {
  it('count a cross-listed course once', () => {
    const graph = buildGraph(catalog)
    expect(catalog.courses.some(c => c.listings.length > 1)).toBe(true)
    const counts = countsOn(graph.nodes, [ENTITY, CAMPUS], { filter: initialFilter(taxonomy, graph), taxonomy })
    expect(counts.get(ENTITY)!.get('course')).toBe(catalog.courses.length)
  })
})
