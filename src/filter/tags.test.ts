import { describe, expect, it } from 'vitest'
import { countsOn, valuesOn } from '../graph/axis'
import type { Graph, GraphNode } from '../graph/model'
import { axisOptions } from '../graph/simulation'
import { createTaxonomy } from '../graph/taxonomy'
import { validateGraph } from '../graph/validate'
import { reconcileFilter } from './reconcile'
import { hiddenMatchesOf, initialFilter, passesSelection } from './types'
import type { FilterState } from './types'

// An allow-list and a narrowing tag axis, side by side.
const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [],
  filterAxes: [
    { id: 'label', emptyMeans: 'none', reads: 'tags' },
    { id: 'assignee', emptyMeans: 'all', reads: 'tags' },
  ],
})
const label = taxonomy.axisFor('label')!
const node = (id: string, tags: GraphNode['tags'], copyKey?: string): GraphNode => ({ id, name: id, values: { kind: 'item' }, tags, copyKey })
const both = node('both', { label: ['bug', 'p1'], assignee: ['ana', 'bo'] })
const none = node('none', {})
const graph: Graph = { nodes: [both, node('copy', { label: ['bug', 'bug'] }, 'both'), none], edges: [] }
const filtered = (selections: Record<string, string[]>): FilterState => new Map(Object.entries(selections).map(([a, v]) => [a, new Set(v)]))
const passes = (n: GraphNode, f: FilterState) => passesSelection({ filter: f, taxonomy, axes: ['label', 'assignee'], node: n })

describe('a tag axis', () => {
  it('passes a node when any of its tags passes', () => {
    expect(passes(both, filtered({ label: ['p1'], assignee: ['bo'] }))).toBe(true)
    expect(passes(both, filtered({ label: ['p2'] }))).toBe(false)
    expect(passes(both, filtered({ label: ['bug'], assignee: ['cy'] }))).toBe(false)
  })

  it('follows absentMeans for a node with no tags there', () => {
    expect(passes(none, filtered({ label: ['bug'] }))).toBe(false)
    expect(passes(node('free', { label: ['bug'] }), filtered({ label: ['bug'], assignee: ['ana'] }))).toBe(true)
  })

  it('presents every tag, and counts each tag of an entity once', () => {
    expect(valuesOn(graph.nodes, label)).toEqual(['bug', 'p1'])
    expect(valuesOn(graph.nodes, 'label')).toEqual([])
    expect(countsOn(graph.nodes, [label]).get('label')).toEqual(new Map([['bug', 1], ['p1', 1]]))
    expect(initialFilter(taxonomy, graph).get('label')).toEqual(new Set(['bug', 'p1']))
  })

  it('widens on a focus only when none of the target\'s tags is on, by its first', () => {
    const focus = (destination: FilterState) =>
      reconcileFilter({ destination, source: destination, locks: new Map(), transition: { kind: 'focus', target: both }, taxonomy, axes: ['label', 'assignee'] }).filter
    expect(focus(filtered({ label: ['p1'], assignee: [] }))).toEqual(filtered({ label: ['p1'], assignee: [] }))
    expect(focus(filtered({ label: [], assignee: ['cy'] }))).toEqual(filtered({ label: ['bug'], assignee: ['cy', 'ana'] }))
  })

  it('counts a hidden search match on its first tag', () => {
    const split = hiddenMatchesOf({ nodes: [both], filter: filtered({ label: ['p2'] }), taxonomy, axes: ['label'], visibleIds: new Set(), matches: () => true })
    expect(split.hiddenByAxis.get('label')).toEqual(new Map([['bug', 1]]))
  })

  it('is never offered to push, pull or a layout axis', () => {
    const tagged: Graph = { nodes: [{ ...both, values: { kind: 'item', label: 'bug', team: 'core' } }], edges: [] }
    expect(axisOptions(taxonomy, tagged).map(o => o.mapping.axis)).toEqual(['kind', 'team'])
  })

  it('cannot be the style axis', () => {
    expect(() => createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [{ id: 'kind', emptyMeans: 'none', reads: 'tags' }] })).toThrow(/style axis/)
  })

  it('is the only axis validateGraph lets tags sit on', () => {
    const stray = node('stray', { team: ['core'] })
    const tagged = validateGraph({ nodes: [both, stray], edges: [] }, taxonomy).filter(d => d.code === 'node-tags-undeclared')
    expect(tagged.map(d => d.nodeId)).toEqual(['stray'])
  })
})
