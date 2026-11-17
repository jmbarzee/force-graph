// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphView } from './GraphView'
import type { Coloring } from '../graph/coloring'
import type { GraphViewHandle } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import { createTuning } from '../graph/tuning'
import type { Tuning } from '../graph/tuning'
import type { Graph, GraphNode } from '../graph/model'
import type { GraphDiagnostic } from '../graph/validate'
import type { FilterState } from '../filter/types'
import { GROUPS, initialFilter, selectionFor, withSelection } from '../filter/types'
import { GroupLegend } from './GroupLegend'
import type { ActiveGroup, NodeGroup } from '../graph/groups'
import { PALETTE } from '../graph/scheme'
import type { EdgeStroke } from '../graph/scheme'

// What the canvas was last handed, and every simulation the view built.
const drawn = vi.hoisted(() => ({ strokes: new Map<{ id: string }, EdgeStroke>(), simulations: [] as object[], hover: (_id: string | null) => {} }))
vi.mock('./GraphCanvas', () => ({
  GraphCanvas: (props: { edgeStrokes: typeof drawn.strokes; onHoverNode: typeof drawn.hover }) => { drawn.strokes = props.edgeStrokes; drawn.hover = props.onHoverNode; return null },
}))
vi.mock('../graph/simulation', async importOriginal => {
  const actual = await importOriginal<typeof import('../graph/simulation')>()
  class Simulation extends actual.Simulation {
    constructor(...args: ConstructorParameters<typeof actual.Simulation>) { super(...args); drawn.simulations.push(this) }
  }
  return { ...actual, Simulation }
})

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
  expect(reported.filter(d => d.code === 'key-color-invalid')).toHaveLength(1)
  expect(view.drawn()[0]!.color).toBe(PALETTE[0].light)
})

it("runs a layout scalar's compute once per edit, for the panel, the overlay and the simulation alike", async () => {
  let computed = 0
  const counted = createTaxonomy({
    styleAxis: 'kind', styles: [],
    scalars: [{ id: 'rank', compute: graph => { computed++; return new Map([...graph.nodes].map((n, i) => [n.id, i])) } }],
  })
  const tuningAt = (gravityY: number) => createTuning({ forces: { bandY: { scalar: 'rank' }, gravityY } }, counted)
  const root = createRoot(document.createElement('div'))
  const render = (tuning: Tuning) => act(async () => {
    root.render(React.createElement(GraphView, { graph: first, taxonomy: counted, tuning, onTuningChange: () => {} }))
  })
  await render(tuningAt(1))
  computed = 0
  await render(tuningAt(2))
  expect(computed).toBe(1)
})

// Two edges over two buckets: `a` peaks the graph at 4; `b` has no series.
const played: Graph = {
  ...graphOf(['a', 'x'], ['b', 'y']),
  window: { since: 0, until: 2 * 86_400_000, buckets: 2 },
  edges: [{ id: 'a', sourceId: 'n0', targetId: 'n1', weight: 1, series: [0, 4] }, { id: 'b', sourceId: 'n1', targetId: 'n0', weight: 0.5 }],
}
const strokeOf = (id: string) => [...drawn.strokes].find(([edge]) => edge.id === id)![1]

it('strokes an edge at the playhead by its series over the peak, and leaves the simulation be', async () => {
  const onPlayheadChange = vi.fn()
  const root = createRoot(document.createElement('div'))
  const render = (playhead: number | null) => act(async () => {
    root.render(React.createElement(GraphView, { graph: played, taxonomy, playhead, onPlayheadChange }))
  })
  await render(null)
  const built = drawn.simulations.length
  expect(strokeOf('a').width).toBeCloseTo(2.4)
  expect(strokeOf('a').alpha).toBeCloseTo(0.7)
  await render(0.5)
  expect(strokeOf('a').width).toBeCloseTo(1.2 * 1.5)
  expect(strokeOf('a').alpha).toBeCloseTo(0.7 * 0.5)
  expect(strokeOf('b').width).toBeCloseTo(1.2 * 1.5)
  await render(7)
  expect(strokeOf('a').alpha).toBeCloseTo(0.7)
  expect(drawn.simulations.length).toBe(built)
  expect(onPlayheadChange).not.toHaveBeenCalled()
})

it('keeps its own playhead from defaultPlayhead, moved by the scrubber', async () => {
  const onPlayheadChange = vi.fn()
  const view = await mount({ defaultPlayhead: 0, onPlayheadChange }, played)
  expect(strokeOf('a').alpha).toBe(0)
  await act(async () => view.el.querySelector<HTMLButtonElement>('[aria-label="Whole window"]')!.click())
  expect(onPlayheadChange).toHaveBeenLastCalledWith(null)
  expect(strokeOf('a').alpha).toBeCloseTo(0.7)
})

it('shows no scrubber for a graph without a window, or when chrome turns it off', async () => {
  expect((await mount({}, played)).el.querySelector('.gv-scrubber')).not.toBeNull()
  expect((await mount({ chrome: { scrubber: false } }, played)).el.querySelector('.gv-scrubber')).toBeNull()
  expect((await mount({}, { ...played, window: undefined })).el.querySelector('.gv-scrubber')).toBeNull()
})

it('reads a new graph as unchanged only when its window, weights and series are', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const said = () => warn.mock.calls.some(([m]) => String(m).includes('nothing in it did'))
  const view = await mount({}, played)
  await view.render({ ...played, window: { ...played.window! }, edges: played.edges.map(e => ({ ...e, series: e.series && [3, 4] })) })
  expect(said()).toBe(false)
  await view.render({ ...played, window: { ...played.window!, buckets: 3 } })
  expect(said()).toBe(false)
  await view.render({ ...played, window: { ...played.window!, buckets: 3 }, edges: played.edges.map(e => ({ ...e, weight: 0.25 })) })
  expect(said()).toBe(false)
  await view.render({ ...played, window: { ...played.window!, buckets: 3 }, edges: played.edges.map(e => ({ ...e, weight: 0.25 })) })
  expect(said()).toBe(true)
  warn.mockRestore()
})

it('names a search result\'s style by labels, then by labelFor, then by the style\'s label', async () => {
  const styled = createTaxonomy({
    styleAxis: 'kind',
    styles: ['svc', 'db', 'queue'].map(id => ({ id, label: `${id} style`, color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } })),
    filterAxes: [{ id: 'kind', emptyMeans: 'none', labelFor: v => (v === 'db' ? 'Database' : `${v} style`) }],
  })
  const graph: Graph = { nodes: ['svc', 'db', 'queue'].map((kind, i): GraphNode => ({ id: `n${i}`, name: `match ${kind}`, values: { kind } })), edges: [] }
  const view = await mount({ taxonomy: styled, labels: { kind: { svc: 'Service' } }, search: { query: 'match', active: true }, onSearchChange: () => {} }, graph)
  expect([...view.el.querySelectorAll('.gv-graph-search-result-type')].map(e => e.textContent)).toEqual(['Service', 'Database', 'queue style'])
})

describe('coloring.fill', () => {
  // The team chips name a key no fill declares.
  const filled = createTaxonomy({
    styleAxis: 'kind', styles: [{ id: 'svc', label: 'Service' }],
    filterAxes: [{ id: 'team', emptyMeans: 'all', chipsFor: values => values.map(v => ({ id: v, label: v, values: [v], tint: 'mauve' })) }],
  })
  const graph: Graph = { nodes: [{ id: 'n0', name: 'zero', values: { kind: 'svc', team: 'red' } }], edges: [] }
  const byTeam = { fill: { by: 'axis' as const, axis: 'team' } }

  async function mountFilled(coloring?: { fill?: Coloring }) {
    let reported: readonly GraphDiagnostic[] = []
    const el = document.createElement('div')
    const root = createRoot(el)
    const render = (next?: { fill?: Coloring }) => act(async () => {
      root.render(React.createElement(GraphView, { graph, taxonomy: filled, coloring: next, onDiagnostics: d => { reported = d } }))
    })
    await render(coloring)
    return { el, render, reported: () => reported }
  }

  it('repaints a new colouring without rebuilding the simulation', async () => {
    const view = await mountFilled()
    const built = drawn.simulations.length
    await view.render(byTeam)
    expect(drawn.simulations.length).toBe(built)
  })

  it("names the hovered node's fill key beside its swatch", async () => {
    const view = await mountFilled(byTeam)
    await act(async () => drawn.hover('n0'))
    const row = view.el.querySelector('.gv-tooltip-fill')!
    expect(row.textContent).toBe('red')
    expect(row.querySelector<HTMLElement>('.gv-tooltip-swatch')!.style.background).toBe('var(--gv-node-red)')
  })

  it('neither re-resolves nor re-reports a colouring equal to the last', async () => {
    const of = vi.fn((node: GraphNode) => node.values.team)
    const onDiagnostics = vi.fn()
    const root = createRoot(document.createElement('div'))
    const render = () => act(async () => {
      root.render(React.createElement(GraphView, { graph, taxonomy: filled, coloring: { fill: { by: 'node', keys: [{ id: 'red', label: 'Red' }], of } }, onDiagnostics }))
    })
    await render()
    const [asked, reported] = [of.mock.calls.length, onDiagnostics.mock.calls.length]
    expect(reported).toBeGreaterThan(0)
    await render()
    expect([of.mock.calls.length, onDiagnostics.mock.calls.length]).toEqual([asked, reported])
  })

  it('reports a chip tint naming no key once', async () => {
    const view = await mountFilled(byTeam)
    await view.render({ ...byTeam })
    expect(view.reported().filter(d => d.code === 'tint-undeclared')).toHaveLength(1)
  })
})
