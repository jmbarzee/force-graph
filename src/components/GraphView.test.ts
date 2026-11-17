// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it } from 'vitest'
import { GraphView } from './GraphView'
import type { GraphViewHandle } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import type { Graph, GraphNode } from '../graph/model'
import type { GraphDiagnostic } from '../graph/validate'
import type { FilterState } from '../filter/types'
import { GROUPS, initialFilter, selectionFor, withSelection } from '../filter/types'
import { GroupLegend } from './GroupLegend'
import type { ActiveGroup, NodeGroup } from '../graph/groups'
import { GROUP_PALETTE } from '../graph/groups'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

// Two allow-lists; `site` opens without `z`, which only the grown graph has, so a re-seed shows.
const taxonomy = createTaxonomy({
  styleAxis: 'kind', styles: [],
  filterAxes: [{ id: 'team', emptyMeans: 'none' }, { id: 'site', emptyMeans: 'none', initialSelection: values => values.filter(v => v !== 'z') }],
})
const graphOf = (...pairs: [string, string][]): Graph => ({ nodes: pairs.map(([team, site], i): GraphNode => ({ id: `n${i}`, name: team, values: { team, site } })), edges: [] })
const first = graphOf(['a', 'x'], ['b', 'y'])
const grown = graphOf(['a', 'x'], ['b', 'y'], ['c', 'z'])

/** Mount a view that keeps its filter, and the last filter it reported. */
async function mount(props: Partial<React.ComponentProps<typeof GraphView>>, start = first) {
  const ref = React.createRef<GraphViewHandle>()
  const reported: FilterState[] = []
  const el = document.createElement('div')
  const root = createRoot(el)
  const render = (graph: Graph) => act(async () => {
    root.render(React.createElement(GraphView, { ref, graph, taxonomy, onFilterChange: next => reported.push(next), ...props }))
  })
  await render(start)
  return { el, ref, render, last: () => reported[reported.length - 1]! }
}

it('writes one axis through updateFilter, and re-seeds the rest when the graph grows', async () => {
  const view = await mount({})
  await act(async () => view.ref.current!.updateFilter(f => withSelection(f, 'team', new Set(['a']))))
  expect(selectionFor(view.last(), 'team')).toEqual(new Set(['a']))
  await view.render(grown)
  expect(selectionFor(view.last(), 'team')).toEqual(new Set(['a']))
  expect(selectionFor(view.last(), 'site')).toEqual({ except: new Set(['z']) })
})

it('keeps the axes defaultFilter changed, and re-seeds the rest', async () => {
  const view = await mount({ defaultFilter: new Map([['team', { except: new Set(['a']) }], ['site', { except: new Set() }]]) }, graphOf())
  await view.render(grown)
  expect(selectionFor(view.last(), 'team')).toEqual({ except: new Set(['a']) })
  expect(selectionFor(view.last(), 'site')).toEqual({ except: new Set(['z']) })
})

it('names a parent cycle and draws past it with every node hidden', async () => {
  const [a, b, c] = graphOf(['a', 'x'], ['a', 'x'], ['a', 'x']).nodes
  const cycle: Graph = {
    nodes: [{ ...a!, parentId: 'n2' }, { ...b!, parentId: 'n0' }, { ...c!, parentId: 'n1' }],
    edges: [{ id: 'd', sourceId: 'n0', targetId: 'n1' }],
  }
  let reported: readonly GraphDiagnostic[] = []
  const view = await mount({ defaultFilter: new Map([['team', new Set<string>()]]), onDiagnostics: d => { reported = d } }, cycle)
  expect(reported.filter(d => d.code === 'parent-cycle').map(d => d.nodeId)).toEqual(['n0'])
  expect(view.el.textContent).toContain('parent-cycle')
})

// `red` holds n0 alone and shares n1 with `blue`.
const groups: NodeGroup[] = [{ id: 'red', nodeIds: new Set(['n0', 'n1']) }, { id: 'blue', nodeIds: new Set(['n1']) }]

/** Mount a view with a legend over `groups`, and what it drew and reported. */
async function mountGroups(props: Partial<React.ComponentProps<typeof GraphView>>) {
  let drawn: readonly ActiveGroup[] = []
  const writes: [FilterState, readonly string[]][] = []
  const view = await mount({
    groups,
    groupsControl: (active, control) => { drawn = active; return React.createElement(GroupLegend, { items: groups.map(g => ({ id: g.id, label: g.id })), active, control }) },
    onFilterChange: (next, touched) => writes.push([next, touched]),
    ...props,
  })
  return { ...view, drawn: () => drawn, lastWrite: () => writes[writes.length - 1]! }
}

it("hides a group's glow and only-members from its legend row, and a focus turns it back on", async () => {
  const view = await mountGroups({})
  await act(async () => view.el.querySelector<HTMLInputElement>('.gv-group-legend input')!.click())
  const [hidden, touched] = view.lastWrite()
  expect(selectionFor(hidden, GROUPS)).toEqual({ except: new Set(['red']) })
  expect(touched).toEqual([GROUPS])
  expect(view.drawn().map(g => [g.id, [...g.nodeIds]])).toEqual([['blue', ['n1']]])
  let shown = false
  await act(async () => { shown = view.ref.current!.focusNode('n0') })
  expect(shown).toBe(true)
  expect(view.lastWrite()).toEqual([withSelection(hidden, GROUPS, { except: new Set() }), []])
})

it('asks the host to widen a controlled group filter for a focus, and writes nothing of its own', async () => {
  const filter = withSelection(initialFilter(taxonomy, first), GROUPS, { except: new Set(['red']) })
  const view = await mountGroups({ filter })
  await act(async () => { view.ref.current!.focusNode('n0') })
  expect(selectionFor(view.lastWrite()[0], GROUPS)).toEqual({ except: new Set() })
  expect(view.drawn().map(g => g.id)).toEqual(['blue'])
})

it('reports a group colour it cannot read once, and draws the group from the palette', async () => {
  let reported: readonly GraphDiagnostic[] = []
  const view = await mountGroups({ groups: [{ ...groups[0]!, color: 'nope' }], onDiagnostics: d => { reported = d } })
  expect(reported.filter(d => d.code === 'group-color-invalid')).toHaveLength(1)
  expect(view.drawn()[0]!.color).toBe(GROUP_PALETTE.light[0])
})
