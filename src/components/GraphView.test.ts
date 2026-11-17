// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphView } from './GraphView'
import type { ColorChannels, Coloring, ResolvedColoring } from '../graph/coloring'
import type { GraphViewHandle, GraphViewProps, GroupsControl } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import { createTuning } from '../graph/tuning'
import type { Tuning } from '../graph/tuning'
import type { Graph, GraphNode } from '../graph/model'
import type { GraphDiagnostic } from '../graph/validate'
import type { FilterState } from '../filter/types'
import { GROUPS, initialFilter, selectionFor, withSelection } from '../filter/types'
import { ColorLegend } from './ColorLegend'
import type { GlowGroup, NodeGroup } from '../graph/groups'
import { PALETTE } from '../graph/scheme'
import type { EdgeStroke } from '../graph/scheme'

// What the canvas was last handed, and every simulation the view built.
const drawn = vi.hoisted(() => ({
  strokes: new Map<{ id: string }, EdgeStroke>(), simulations: [] as object[],
  hover: (_id: string | null) => {}, hoverEdge: (_hover: { id: string; x: number; y: number } | null) => {}, hoveredEdgeId: null as string | null,
  select: (_id: string | null, _additive: boolean) => {}, lasso: (_ids: string[]) => {}, selected: new Set<string>() as ReadonlySet<string>,
  ring: null as ResolvedColoring | null, glows: [] as readonly GlowGroup[],
}))
vi.mock('./GraphCanvas', () => ({
  GraphCanvas: (props: {
    edgeStrokes: typeof drawn.strokes; onHoverNode: typeof drawn.hover; onHoverEdge: typeof drawn.hoverEdge; hoveredEdgeId: string | null
    onSelectNode: typeof drawn.select; onLassoSelect: typeof drawn.lasso; selectedNodeIds: ReadonlySet<string>; ring: ResolvedColoring | null
    groupGlows: readonly GlowGroup[]
  }) => {
    drawn.strokes = props.edgeStrokes; drawn.hover = props.onHoverNode; drawn.hoverEdge = props.onHoverEdge; drawn.hoveredEdgeId = props.hoveredEdgeId
    drawn.select = props.onSelectNode; drawn.lasso = props.onLassoSelect; drawn.selected = props.selectedNodeIds; drawn.ring = props.ring; drawn.glows = props.groupGlows
    return null
  },
}))
vi.mock('../graph/simulation', async importOriginal => {
  const actual = await importOriginal<typeof import('../graph/simulation')>()
  class Simulation extends actual.Simulation {
    constructor(...args: ConstructorParameters<typeof actual.Simulation>) { super(...args); drawn.simulations.push(this) }
  }
  return { ...actual, Simulation }
})

// Every root a test mounts, unmounted after it: a view left alive re-renders and rewrites `drawn`.
const roots: Root[] = []
function newRoot(el: HTMLElement): Root {
  const root = createRoot(el)
  roots.push(root)
  return root
}
afterEach(() => act(() => { for (const root of roots.splice(0)) root.unmount() }))

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
  const root = newRoot(el)
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

/** Mount a view with a legend over `groups`, and what it reported. */
async function mountGroups(props: Partial<React.ComponentProps<typeof GraphView>>) {
  const writes: [FilterState, readonly string[]][] = []
  const view = await mount({
    groups,
    legend: (channels, control) => React.createElement(ColorLegend, { channels, control }),
    onFilterChange: (next, touched) => writes.push([next, touched]),
    ...props,
  })
  return { ...view, lastWrite: () => writes[writes.length - 1]! }
}

it("hides a group's glow and only-members from its legend row, and a focus turns it back on", async () => {
  const view = await mountGroups({})
  await act(async () => view.el.querySelector<HTMLInputElement>('.gv-color-legend input')!.click())
  const [hidden, touched] = view.lastWrite()
  expect(selectionFor(hidden, GROUPS)).toEqual({ except: new Set(['red']) })
  expect(touched).toEqual([GROUPS])
  expect(drawn.glows.map(g => [g.id, [...g.nodeIds]])).toEqual([['blue', ['n1']]])
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
  expect(drawn.glows.map(g => g.id)).toEqual(['blue'])
})

it('reports a group colour it cannot read once, and draws the group from the palette', async () => {
  let reported: readonly GraphDiagnostic[] = []
  await mountGroups({ groups: [{ ...groups[0]!, color: 'nope' }], onDiagnostics: d => { reported = d } })
  expect(reported.filter(d => d.code === 'key-color-invalid')).toHaveLength(1)
  expect(drawn.glows[0]!.color).toBe(PALETTE[0].light)
})

it("runs a layout scalar's compute once per edit, for the panel, the overlay and the simulation alike", async () => {
  let computed = 0
  const counted = createTaxonomy({
    styleAxis: 'kind', styles: [],
    scalars: [{ id: 'rank', compute: graph => { computed++; return new Map([...graph.nodes].map((n, i) => [n.id, i])) } }],
  })
  const tuningAt = (gravityY: number) => createTuning({ forces: { bandY: { scalar: 'rank' }, gravityY } }, counted)
  const root = newRoot(document.createElement('div'))
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
  const root = newRoot(document.createElement('div'))
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
    const root = newRoot(el)
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
    const root = newRoot(document.createElement('div'))
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

describe('coloring.ring', () => {
  it('hands the canvas a new ring without rebuilding the simulation, and reports its undeclared key', async () => {
    let reported: readonly GraphDiagnostic[] = []
    const root = newRoot(document.createElement('div'))
    const render = (ring?: Coloring) => act(async () => {
      root.render(React.createElement(GraphView, { graph: first, taxonomy, coloring: { ring }, onDiagnostics: d => { reported = d } }))
    })
    await render()
    expect(drawn.ring).toBeNull()
    const built = drawn.simulations.length
    await render({ by: 'node', keys: [{ id: 'a', label: 'A' }], of: n => n.values.team })
    expect([...drawn.ring!.keys.keys()]).toEqual(['a'])
    expect(drawn.simulations.length).toBe(built)
    expect(reported.filter(d => d.code === 'key-undeclared')).toHaveLength(1)
  })
})

/** Mount a view over `groups`, re-rendered with each colouring, and what its legend and filter were last handed. */
async function mountLegend(coloring?: GraphViewProps['coloring'], props: Partial<GraphViewProps> = {}) {
  let last: [ColorChannels, GroupsControl] | undefined
  const writes: [FilterState, readonly string[]][] = []
  const root = newRoot(document.createElement('div'))
  const render = (next?: GraphViewProps['coloring']) => act(async () => {
    root.render(React.createElement(GraphView, {
      graph: first, taxonomy, groups, coloring: next, legend: (...args) => { last = args; return null },
      onFilterChange: (f, touched) => writes.push([f, touched]), ...props,
    }))
  })
  await render(coloring)
  return { render, last: () => last!, lastWrite: () => writes[writes.length - 1]! }
}

describe('coloring.glow', () => {
  it('follows the groups when absent, and repaints a new glow without rebuilding the simulation', async () => {
    const view = await mountLegend()
    expect(view.last()[0].glow!.map(k => k.id)).toEqual(['red', 'blue'])
    expect(view.last()[1].toggle).toBeDefined()
    const built = drawn.simulations.length
    await view.render({ glow: { by: 'axis', axis: 'team' } })
    expect(drawn.glows.map(g => [g.id, [...g.nodeIds]])).toEqual([['a', ['n0']], ['b', ['n1']]])
    expect(drawn.simulations.length).toBe(built)
  })

  it("toggles a filter axis's value from its glow row, and the key it hid is no longer visible", async () => {
    const view = await mountLegend({ glow: { by: 'axis', axis: 'team' } })
    await act(async () => view.last()[1].toggle!('a'))
    const [hidden, touched] = view.lastWrite()
    expect(selectionFor(hidden, 'team')).toEqual({ except: new Set(['a']) })
    expect(touched).toEqual(['team'])
    expect(view.last()[1].shown('a')).toBe(false)
    expect(view.last()[0].glow!.map(k => [k.id, k.visible])).toEqual([['a', false], ['b', true]])
  })

  it('hides only the toggled value of an emptyMeans all axis that selects nothing', async () => {
    const narrowing = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [{ id: 'team', emptyMeans: 'all' }] })
    const view = await mountLegend({ glow: { by: 'axis', axis: 'team' } }, { taxonomy: narrowing, defaultFilter: new Map([['team', new Set<string>()]]) })
    expect(view.last()[1].shown('a')).toBe(true)
    await act(async () => view.last()[1].toggle!('a'))
    expect([view.last()[1].shown('a'), view.last()[1].shown('b')]).toEqual([false, true])
  })

  it('shows every key and toggles none while the glow follows a node colouring', async () => {
    const [, control] = (await mountLegend({ glow: { by: 'node', keys: [{ id: 'a', label: 'A' }], of: n => n.values.team } })).last()
    expect(control.shown('a')).toBe(true)
    expect(control.toggle).toBeUndefined()
  })
})

describe('legend', () => {
  it('hands the fill always, the glow and the ring when they colour, each key in the theme and named by labels', async () => {
    const byTeam = { by: 'axis', axis: 'team' } as const
    const view = await mountLegend({}, { groups: undefined })
    expect([view.last()[0].glow, view.last()[0].ring]).toEqual([undefined, undefined])
    const named = await mountLegend({ fill: byTeam, glow: byTeam, ring: byTeam }, { labels: { team: { a: 'Alpha' } } })
    const [channels] = named.last()
    for (const keys of [channels.fill!, channels.glow!, channels.ring!]) {
      expect(keys).toEqual([{ id: 'a', label: 'Alpha', color: PALETTE[0].light, visible: true }, { id: 'b', label: 'b', color: PALETTE[1].light, visible: true }])
    }
  })
})

it('says so when the filter draws no node, and stops once it draws one', async () => {
  const view = await mount({ defaultFilter: new Map([['team', { except: new Set(['a', 'b']) }], ['site', { except: new Set() }]]) })
  expect(view.el.querySelector('.gv-graph-empty')?.textContent).toBe('No nodes match the filter.')
  await act(async () => view.ref.current!.updateFilter(f => withSelection(f, 'team', new Set(['a']))))
  expect(view.el.querySelector('.gv-graph-empty')).toBeNull()
})

it('leaves an empty graph to the host', async () => {
  const view = await mount({}, graphOf())
  expect(view.el.querySelector('.gv-graph-empty')).toBeNull()
})

describe('edge hover', () => {
  const [a, b] = first.nodes
  const prerequisite = { id: 'e', sourceId: 'n0', targetId: 'n1' }
  const graph: Graph = { nodes: [a!, { ...b!, parentId: 'n0' }], edges: [prerequisite] }

  it('hands the host its own edge and boxes it, a node winning over it, and null 150 ms after the pointer leaves', async () => {
    vi.useFakeTimers()
    try {
      const onEdgeHover = vi.fn()
      const view = await mount({ onEdgeHover }, graph)
      await act(async () => drawn.hoverEdge({ id: 'e', x: 10, y: 20 }))
      expect(onEdgeHover.mock.lastCall![0]).toBe(prerequisite)
      expect(drawn.hoveredEdgeId).toBe('e')
      expect(view.el.querySelector('.gv-tooltip-name')!.textContent).toBe('a → b')

      // The pointer onto a node, then back onto the edge within the node's grace.
      await act(async () => { drawn.hover('n0'); drawn.hoverEdge(null) })
      expect(onEdgeHover).toHaveBeenLastCalledWith(null)
      expect(drawn.hoveredEdgeId).toBeNull()
      await act(async () => { drawn.hover(null); drawn.hoverEdge({ id: 'e', x: 10, y: 20 }) })
      expect(drawn.hoveredEdgeId).toBeNull()
      await act(async () => { vi.advanceTimersByTime(150) })
      expect(onEdgeHover).toHaveBeenLastCalledWith(prerequisite)

      // The null is timed from the pointer leaving, however long it keeps moving.
      await act(async () => drawn.hoverEdge(null))
      await act(async () => { vi.advanceTimersByTime(100); drawn.hoverEdge(null); vi.advanceTimersByTime(49) })
      expect(onEdgeHover).toHaveBeenLastCalledWith(prerequisite)
      await act(async () => { vi.advanceTimersByTime(1) })
      expect(onEdgeHover).toHaveBeenLastCalledWith(null)
      expect(view.el.querySelector('.gv-graph-hover-tooltip')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('hands a derived containment edge as derived', async () => {
    const onEdgeHover = vi.fn()
    await mount({ onEdgeHover }, graph)
    await act(async () => drawn.hoverEdge({ id: 'in:n1', x: 0, y: 0 }))
    expect(onEdgeHover).toHaveBeenLastCalledWith({ id: 'in:n1', sourceId: 'n1', targetId: 'n0', relation: 'containment' })
  })
})

describe('selection', () => {
  const three = graphOf(['a', 'x'], ['b', 'y'], ['c', 'x'])
  const idsOf = (nodes: readonly GraphNode[]) => nodes.map(n => n.id)

  it('selects alone on a click, toggles on Ctrl/Meta+click, adds a lasso, and clears on the background', async () => {
    const reported: string[][] = []
    await mount({ onSelectionChange: nodes => reported.push(idsOf(nodes)) }, three)
    await act(async () => drawn.select('n1', false))
    await act(async () => drawn.select('n0', true))
    await act(async () => drawn.lasso(['n0', 'n2']))
    expect(drawn.selected).toEqual(new Set(['n1', 'n0', 'n2']))
    await act(async () => drawn.select('n0', true))
    await act(async () => drawn.select('n2', false))
    await act(async () => drawn.select(null, false))
    expect(reported).toEqual([['n1'], ['n1', 'n0'], ['n1', 'n0', 'n2'], ['n1', 'n2'], ['n2'], []])
    expect(drawn.selected).toEqual(new Set())
  })

  it('reports the nodes a reload keeps of its own selection', async () => {
    const reported: string[][] = []
    const view = await mount({ defaultSelectedIds: new Set(['n0', 'n1']), onSelectionChange: nodes => reported.push(idsOf(nodes)) }, three)
    expect(reported).toEqual([])
    await view.render(graphOf(['a', 'x']))
    expect(reported).toEqual([['n0']])
    expect(drawn.selected).toEqual(new Set(['n0']))
  })

  it("reports nothing for the host's own change, and the user's through the handle", async () => {
    const ref = React.createRef<GraphViewHandle>()
    const reported: string[][] = []
    const root = newRoot(document.createElement('div'))
    const render = (selectedIds: ReadonlySet<string>) => act(async () => {
      root.render(React.createElement(GraphView, { ref, graph: three, taxonomy, selectedIds, onSelectionChange: nodes => reported.push(idsOf(nodes)) }))
    })
    await render(new Set(['n0']))
    await render(new Set(['n0', 'n2']))
    const shown = drawn.selected
    await render(new Set(['n0', 'n2']))
    expect(drawn.selected).toBe(shown)
    await act(async () => ref.current!.select('n1'))
    expect(reported).toEqual([['n1']])
    expect(drawn.selected).toEqual(new Set(['n0', 'n2']))
  })
})
