// Graph View: a force-directed graph, filtered, highlighted and tuned.
// Wires together validation, simulation, viewport, rendering and interaction.

import React from 'react'
import './GraphView.css'
import { intensityAt, nodesById, isContainment, peakOf, seriesOf, unitWeight, windowOf, withContainmentEdges } from '../graph/model'
import type { Graph, GraphEdge, GraphNode } from '../graph/model'
import type { FilterState, AxisLocks } from '../filter/types'
import { GROUPS, changedAxes, initialFilter, filterStatesEqual, hiddenMatchesOf, listEqual, locksEqual, reseedFilter, selectionFor, selects } from '../filter/types'
import { reconcileFilter } from '../filter/reconcile'
import { toggleValue } from '../filter/toggle'
import { NO_OVERRIDES } from '../filter/linked'
import type { LinkedViewState } from '../filter/linked'
import type { ForceParams, SimNode, Simulation } from '../graph/simulation'
import { bandOverlay } from '../graph/forces'
import { countsOn, isIdentityMapping, mappingKey, valuesOn } from '../graph/axis'
import type { AxisId, AxisMapping } from '../graph/axis'
import type { PresentSets } from './graph-view/present'
import { presentSetsOf } from './graph-view/present'
import type { EdgeStroke, Theme } from '../graph/scheme'
import { scopeStyle } from '../styles/tokens'
import type { ThemeTokens } from '../styles/tokens'
import { useResolvedTheme, THEME_CHOICES } from './graph-view/useTheme'
import type { ThemeChoice } from './graph-view/useTheme'
import { axisOptions, layoutAxisOptions, pairTuning, sprungEdges } from '../graph/simulation'
import { copyGroups, copyKeyOf } from '../graph/model'
import type { NodeScaleParams } from '../graph/node-scale'
import { CONTAINMENT_STROKE, NEUTRAL_STROKE, played, weighted } from '../graph/shapes'
import { defaultTuningFor, tuningsEqual, makeTuning, openTuning } from '../graph/tuning-internal'
import type { Tuning } from '../graph/tuning'
import { TUNING_PRESETS } from '../graph/presets'
import type { TuningPreset } from '../graph/presets'
import { usePresets } from './graph-view/usePresets'
import { TaxonomyContext, useTaxonomy } from './graph-view/useTaxonomy'
import type { Taxonomy } from '../graph/taxonomy'
import { engineOf } from '../graph/taxonomy'
import { worldToScreen } from '../graph/viewport'
import type { Viewport } from '../graph/viewport'
import { zoomAt } from '../graph/viewport'
import { GraphCanvas } from './GraphCanvas'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { GraphControlPanel } from './GraphControlPanel'
import { hiddenByOf } from './controls/NothingVisible'
import { Scrubber } from './Scrubber'
import { activeGroupsOf, boostGroupsForNodes, cohesionOf, groupSlotsOf, groupsByNode, nodeGroupsOf, type ActiveGroup, type Groups, type NodeGroup } from '../graph/groups'
import { FilterBar, hiddenMatchBadge } from './FilterBar'
import type { SearchState } from './FilterBar'
export type { SearchState } from './FilterBar'
import { useRecentlyChanged } from './graph-view/useRecentlyChanged'
import { useViewport } from './graph-view/useViewport'
import { useHighlight } from './graph-view/useHighlight'
import { useSimulation } from './graph-view/useSimulation'
import { useVisibleGraph } from './graph-view/useVisibleGraph'
import { neighborhoodOf, passesFilter } from './graph-view/visibleGraph'
import { useSimulationLoop } from './graph-view/useSimulationLoop'
import { useControllable, useControlledWarning, useLatest, useStable } from './graph-view/useControllable'
import { namesNode, sameFocusRequest } from './graph-view/focus'
import type { FocusRequest } from './graph-view/focus'
export type { FocusRequest } from './graph-view/focus'
import { useIsomorphicLayoutEffect } from './graph-view/useIsomorphicLayoutEffect'
import { validateGraph, dropInvalid } from '../graph/validate'
import type { GraphDiagnostic } from '../graph/validate'

/** A node's position in the layout, in world units. */
export interface Position {
  /** Rightward. */
  x: number
  /** Downward. */
  y: number
}

/** The host's action for a node, offered in the hover box. */
export interface NodeAction {
  /** The button's text. */
  label: string
  /** Called with the host's node when the user picks the action. */
  onSelect: (node: GraphNode) => void
}

/** What `groupsControl` may ask of the view. */
export interface GroupsControl {
  /** Whether the filter shows this group (its `GROUPS` entry). */
  shown(id: string): boolean
  /** Show or hide this group, as the bar writes an axis: `onFilterChange` names `GROUPS` touched. Absent when the filter is read-only. */
  toggle?(id: string): void
  /** Emphasise one group (a legend row under the pointer), or none; the view glows it stronger. */
  emphasize(id: string | null): void
}

/** Which parts of the pane's own chrome are offered; every part is on by default. */
export interface GraphViewChrome {
  /** The search control in the bar. */
  search?: boolean
  /** The lock toggle on each axis. Default: only when the host controls `locks` with `onLocksChange` — a one-view host has nothing to lock against, and a value without its callback is read-only. */
  locks?: boolean
  /** The Fit / theme / Play cluster and the node count. */
  transport?: boolean
  /** The pane's own list of the graph's defects under the bar. */
  diagnostics?: boolean
  /** The shortcuts panel and the `?` key that opens it. */
  shortcuts?: boolean
  /** The control panel (the forces, the node scale). */
  controls?: boolean
  /** The Auto / Light / Dark button. It sits in the transport cluster, so `transport: false` hides it too. */
  themeToggle?: boolean
  /** The "dependencies / dependents" line in the hover box. */
  directionLine?: boolean
  /** Centre and zoom to a node's neighbours on double-click. */
  activateZoom?: boolean
  /** The scrubber that plays the graph's `window` back, shown only when the graph declares a valid one. */
  scrubber?: boolean
}

/**
 * What a host may ask of a mounted view. `focusNode` is the whole focus
 * recipe in one call: widen the filter just enough on the axes shown
 * (overriding a lock, which flashes), frame the node with its neighbors until
 * the layout settles, select it, and flash it.
 */
export interface GraphViewHandle {
  /** Reveal, frame and select a node by id. False when the id is not in the graph or the filter cannot be widened to show it. */
  focusNode(id: string): boolean
  /** Select a node, or clear the selection with null. An id the graph does not hold is ignored. */
  select(id: string | null): void
  /** Frame the visible nodes. */
  fit(): void
  /** Every node's position, by id — a layout the host may keep and hand back as `defaultPositions`. */
  getPositions(): Map<string, Position>
  /** Move nodes to the given positions (pinned ones stay) and let the layout settle around them. */
  setPositions(positions: ReadonlyMap<string, Position>): void
  /** Rewrite the filter from its current value: the axes `fn` changes count as the user's, a later graph re-seeds the rest, and `onFilterChange` reports the write. */
  updateFilter(fn: (filter: FilterState) => FilterState): void
}

/**
 * The view's inputs. Only `graph` is required, with a taxonomy from either the
 * `taxonomy` prop or an `TaxonomyContext.Provider` above. Every piece of state
 * follows the React convention: pass the value and its callback to control it,
 * or neither and the view keeps it; a callback alone still reports changes.
 */
export interface GraphViewProps {
  /** The graph, built by the host from whatever it reads. Keep one object until its nodes or edges change. */
  graph: Graph
  /** The taxonomy, when not supplied through `TaxonomyContext`. */
  taxonomy?: Taxonomy
  /**
   * Where the pane's shortcuts listen. `pane` (the default): the root is
   * focusable and handles the keys that reach it, so a host page keeps Tab
   * and Space for its own controls. `global`: the window — for a host whose
   * whole page is this pane, or a tab shell's active tab. `none`: no
   * shortcuts — a tab shell's hidden tab.
   */
  keyboard?: 'pane' | 'global' | 'none'
  /** Where nodes start, by id — a layout the host kept (`getPositions`). Read whenever the simulation is built; a node the live layout already holds keeps its place. */
  defaultPositions?: ReadonlyMap<string, Position>
  /** Chip badge counts per axis and value — the host's reading of its own data. Absent, the graph's entity counts (the copies of one `copyKey` once); `faceted`, those counts under the other axes' selections. */
  counts?: ReadonlyMap<string, ReadonlyMap<string, number>> | 'faceted'
  /** The host's findings bars, rendered under the filter chips. */
  findings?: React.ReactNode
  /** Groups to glow, over the whole graph: derived from the data, or listed. The view settles membership once per graph and groups, then restricts each to the visible set and colours it. */
  groups?: Groups
  /** A multiplier on the stiffness of every edge whose two ends share a visible group, so members drift together. Default 1, off. */
  groupCohesion?: number
  /** The host's control for its groups (`GroupLegend`, or its own), rendered inside the pane — which sets `--gv-toolbar-height` on its root so a control can anchor under the bar — and handed the groups as drawn, colours included, and the view's control over them. */
  groupsControl?: (active: readonly ActiveGroup[], control: GroupsControl) => React.ReactNode
  /** Edges to mark, by id, with a dashed band behind their stroke; a graduated edge is marked when the edge it stands for is. */
  markedEdges?: ReadonlySet<string>
  /** The host's action for a node, offered in the hover box: one for every node, or the host's answer per node (null for none). */
  nodeAction?: NodeAction | ((node: GraphNode) => NodeAction | null)
  /** Which parts of the pane's chrome are offered. Default: everything, the lock toggles only when `locks` is controlled with its callback. */
  chrome?: GraphViewChrome
  /** The search control's title, for a host with its own words. */
  searchTitle?: string
  /** The search field's placeholder, for a host with its own words. */
  searchPlaceholder?: string
  /**
   * The selected node, when the host controls the selection: the view shows
   * this and nothing else while it is defined. A selection the user makes
   * arrives through `onSelectionChange`; the host answers by setting this, or
   * does not. Absent, the view keeps the selection itself.
   */
  selectedId?: string | null
  /** Where the view's own selection starts when the host does not control it. Read once. */
  defaultSelectedId?: string | null
  /**
   * A request to reveal, frame and select a node — the declarative form of
   * the handle's `focusNode`. Compared by value: a new `id` or `key` is a new
   * request. It waits until its node is in the graph, then `onFocusResult`
   * reports whether the filter could show it. Null, a newer request, or one
   * without an `id` (a `useLinkedViews` focus by values) withdraws a waiting
   * one, unreported.
   */
  focus?: Partial<FocusRequest> | null
  /** A focus request's outcome, once its node is in the graph: whether the node ended visible. A withdrawn request is not reported. */
  onFocusResult?: (request: FocusRequest, shown: boolean) => void
  /** Added to the root's class list; the root keeps its own. */
  className?: string
  /** Merged onto the root's style; the scheme's variables stay. */
  style?: React.CSSProperties

  /**
   * The selection per axis. Controlled while defined: the view shows it and
   * never rewrites it — a host that controls the filter re-seeds it for a
   * new graph itself (`reseedFilter`). Absent, the view keeps the filter:
   * `defaultFilter`, or `initialFilter(taxonomy, graph)`, re-seeded from
   * each new graph on every axis the user has not touched.
   */
  filter?: FilterState
  /**
   * Every change to the filter — the user's and, when the view keeps the
   * filter itself, its own re-seed on a graph change. `touched` names the
   * axes the user changed, in the bar or through `updateFilter`; a write of the view's own (its re-seed,
   * a focus's widening) names none — so a host that controls the filter can
   * keep the set `reseedFilter` takes.
   */
  onFilterChange?: (next: FilterState, touched: readonly AxisId[]) => void
  /**
   * Where the view's own filter starts when the host does not control it —
   * a start that depends on the host's state, which a descriptor's
   * `initialSelection` cannot see. Read once; it counts as the user's on
   * every axis where it differs from `initialFilter(taxonomy, graph)`, and a
   * later graph re-seeds the rest.
   */
  defaultFilter?: FilterState
  /** Which axes are locked against a cross-view adoption. Default: `defaultLocks`, else none. Controlling it with `onLocksChange` shows the lock toggles. */
  locks?: AxisLocks
  /** Every change to the locks. */
  onLocksChange?: (next: AxisLocks) => void
  /** Where the view's own locks start when the host does not control them. Read once. */
  defaultLocks?: AxisLocks
  /** The locks a host-side focus into this view overrode (`useLinkedViews`'s `switchTo`); flashed once per key, as the view's own are. */
  overriddenLocks?: LinkedViewState['overriddenLocks']
  /** The axes shown, in order. Default: `defaultAxes`, else every declared filter axis. Editable in the bar unless controlled without a callback. */
  axes?: readonly string[]
  /** Every change to the axes shown. */
  onAxesChange?: (next: readonly string[]) => void
  /** Where the view's own axes start when the host does not control them. Read once. */
  defaultAxes?: readonly string[]
  /** The search control. Default: `defaultSearch`, else closed and empty. */
  search?: SearchState
  /** Every change to the search. */
  onSearchChange?: (next: SearchState) => void
  /** Where the view's own search starts when the host does not control it. Read once. */
  defaultSearch?: SearchState
  /** The pane's theme choice. Default: `defaultTheme`, else `system`. */
  theme?: ThemeChoice
  /** Every change to the theme choice. */
  onThemeChange?: (next: ThemeChoice) => void
  /** Where the view's own theme choice starts when the host does not control it. Read once. */
  defaultTheme?: ThemeChoice
  /** What `system` resolves to, for a host that knows its own theme. Given, the pane reads no ancestor's `data-theme` and no OS preference for it. */
  systemTheme?: Theme
  /** Per theme, the tokens `createTheme` overrides on the pane's root. */
  tokens?: ThemeTokens
  /**
   * The tuning — the forces and the node scale, as the user set them.
   * Controlled while defined: the view reads it, retunes it for the graph and
   * taxonomy it faces (a tuning on an axis the graph no longer carries
   * returns to the style axis, reported through `onTuningChange`), and
   * otherwise never writes it. Absent, the view keeps the tuning:
   * `defaultTuning`, else the taxonomy's defaults.
   */
  tuning?: Tuning
  /** Every change to the tuning — the user's in the control panel and the view's retune for a new graph or taxonomy. */
  onTuningChange?: (next: Tuning) => void
  /** Where the view's own tuning starts when the host does not control it — `createTuning`'s or `tuningFromJSON`'s answer, say. Read once. */
  defaultTuning?: Tuning
  /**
   * The named tunings the control panel offers. Default `TUNING_PRESETS`;
   * `[...TUNING_PRESETS, mine]` adds a host's, `[mine]` replaces them, `[]`
   * hides the row. A preset naming an axis or scalar the taxonomy lacks is
   * listed disabled with why, and said once on the console.
   */
  presets?: readonly TuningPreset[]
  /**
   * Where in the graph's `window` the edges are drawn: a fractional bucket
   * index, clamped to `[0, buckets − 1]`, at which each edge with a `series`
   * strokes its count there. Null, the whole window: every edge draws its
   * static `weight`. Default: `defaultPlayhead`, else null.
   */
  playhead?: number | null
  /** Every change to the playhead — the scrubber's seek, play and reset. */
  onPlayheadChange?: (next: number | null) => void
  /** Where the view's own playhead starts when the host does not control it. Read once. */
  defaultPlayhead?: number | null

  /**
   * The selection the user made — a click, Enter, Escape, a search pick, a
   * focus landing, the handle — as the host's own node, or null when they
   * cleared it. Not called for a change the host made through `selectedId`.
   * When the view keeps the selection itself, also null when the selected
   * node leaves the graph.
   */
  onSelectionChange?: (node: GraphNode | null) => void
  /** The graph's diagnostics, whenever they are recomputed — the first graph's included, and an empty list is a call. */
  onDiagnostics?: (diagnostics: readonly GraphDiagnostic[]) => void
  /** A node double-clicked. */
  onNodeActivate?: (node: GraphNode) => void
  /** The node under the pointer, or null. */
  onHover?: (node: GraphNode | null) => void
  /** The theme the pane resolved to draw in — the choice, or the host's for `system`. */
  onThemeResolved?: (theme: Theme) => void
  /** Every node's position, by id, each time the simulation comes to rest on its own — not when the user pauses it: a layout to keep and hand back as `defaultPositions`. */
  onSettled?: (positions: ReadonlyMap<string, Position>) => void
}

const NO_GROUPS: readonly NodeGroup[] = []

/**
 * The graph view: the host's `Graph`, laid out by forces, filtered by the
 * bar, highlighted on hover and selection, tuned by the control panel and
 * drawn on a canvas. Only `graph` and a taxonomy are required; every piece
 * of state is controlled by the host or kept by the view.
 */
export const GraphView = React.forwardRef<GraphViewHandle, GraphViewProps>(function GraphView({
  graph: hostGraph,
  taxonomy: taxonomyProp,
  keyboard = 'pane',
  defaultPositions,
  counts: hostCounts,
  findings,
  groups,
  groupCohesion = 1,
  groupsControl,
  markedEdges,
  nodeAction,
  chrome,
  searchTitle = 'Search nodes (/)',
  searchPlaceholder = 'Search nodes...',
  selectedId, defaultSelectedId = null,
  focus,
  onFocusResult,
  className,
  style,
  filter: filterProp, onFilterChange, defaultFilter: defaultFilterProp,
  locks: locksProp, onLocksChange, defaultLocks, overriddenLocks: hostOverridden,
  axes: hostAxes, onAxesChange, defaultAxes,
  search: searchProp, onSearchChange, defaultSearch,
  theme: themeProp, onThemeChange, defaultTheme, systemTheme, tokens,
  tuning: tuningProp, onTuningChange, defaultTuning, presets = TUNING_PRESETS,
  playhead: playheadProp, onPlayheadChange, defaultPlayhead,
  onSelectionChange, onNodeActivate, onHover, onThemeResolved, onDiagnostics, onSettled,
}: GraphViewProps, ref) {
  // The taxonomy: the prop, or the context. Neither is a wiring bug a
  // default would hide, so it is said here, once, before any hook.
  const fromContext = React.useContext(TaxonomyContext)
  const taxonomy = taxonomyProp ?? fromContext
  if (!taxonomy) {
    throw new Error('GraphView has no taxonomy: pass `taxonomy`, or mount it inside <TaxonomyContext.Provider value={…}>.')
  }
  // The host's nodes by id, for every output that hands a node back and for
  // the requests that name one.
  const hostIndex = React.useMemo(() => nodesById(hostGraph.nodes), [hostGraph])
  // State the host may control or leave to the view: the filter, the locks,
  // the axes shown, the search control, the theme choice. The first three
  // are compared by content, so a host that rebuilds one each render is not
  // read as a change.
  // The filter's writes go through `writeFilter`, which tells the host which
  // axes the user touched (the view's own writes touch none), and shadows
  // `filterRef` so a write that follows another in one commit — the re-seed
  // below, then a focus landing on the node that just arrived — builds on
  // the earlier result rather than the render's value.
  const [rawFilter, setFilterState] = useControllable(filterProp, undefined, () => defaultFilterProp ?? initialFilter(taxonomy, hostGraph), 'filter')
  const filter = useStable(rawFilter, filterStatesEqual)
  const filterRef = useLatest(filter)
  const onFilterChangeRef = useLatest(onFilterChange)
  // Whether a write reaches anyone: the view's own state, or a host that
  // listens. A controlled filter without a callback is read-only.
  const filterWritable = filterProp === undefined || onFilterChange !== undefined
  const writeFilter = React.useCallback((next: FilterState, touched: readonly AxisId[]) => {
    filterRef.current = next
    setFilterState(next)
    onFilterChangeRef.current?.(next, touched)
  }, [filterRef, setFilterState, onFilterChangeRef])
  // The axes the user has touched — in the bar, through the handle's
  // `updateFilter`, or where `defaultFilter` differs from the opening filter.
  // State, not an inference: a selection that happens to equal a graph's
  // opening one is not thereby untouched. A later graph re-seeds the rest.
  const [touchedAxes] = React.useState(() => new Set(defaultFilterProp ? changedAxes(initialFilter(taxonomy, hostGraph), defaultFilterProp) : []))
  const userWriteFilter = React.useCallback((next: FilterState, touched: readonly AxisId[]) => {
    for (const axis of touched) touchedAxes.add(axis)
    writeFilter(next, touched)
  }, [writeFilter, touchedAxes])
  // A graph that changes while the view keeps the filter itself re-seeds
  // every axis the user has not touched: a host that mounts empty while its
  // data loads is not left blank, and a value first seen later is not born
  // hidden. The user's selections stand; a host that controls the filter
  // owns it, and the view never rewrites it.
  const seededFromRef = React.useRef(hostGraph)
  React.useEffect(() => {
    if (seededFromRef.current === hostGraph) return
    seededFromRef.current = hostGraph
    if (filterProp !== undefined) return
    const next = reseedFilter(filter, taxonomy, hostGraph, touchedAxes)
    if (next !== filter) writeFilter(next, [])
  }, [hostGraph]) // eslint-disable-line react-hooks/exhaustive-deps
  const [rawLocks, setLocks] = useControllable(locksProp, onLocksChange, () => defaultLocks ?? new Map<string, boolean>(), 'locks')
  const locks = useStable(rawLocks, locksEqual)
  const [rawAxes, setAxes] = useControllable(hostAxes, onAxesChange, () => defaultAxes ?? taxonomy.filterAxes.map(d => d.id), 'axes')
  const axes = useStable(rawAxes, listEqual)
  const axesEditable = hostAxes === undefined || onAxesChange !== undefined
  const [search, setSearch] = useControllable(searchProp, onSearchChange, () => defaultSearch ?? { query: '', active: false }, 'search')
  const [themeChoice, setThemeChoice] = useControllable(themeProp, onThemeChange, () => defaultTheme ?? 'system', 'theme')
  const [rawPlayhead, setPlayhead] = useControllable(playheadProp, onPlayheadChange, () => defaultPlayhead ?? null, 'playhead')
  const searchQuery = search.query
  const searchActive = search.active
  // The axes this view filters on are those shown, in order: an axis the host
  // declared but this view does not show is not filtering here.
  const filterAxes = React.useMemo(
    () => axes.flatMap(id => { const d = taxonomy.axisFor(id); return d ? [d] : [] }),
    [axes, taxonomy],
  )
  const show = {
    search: chrome?.search ?? true,
    locks: chrome?.locks ?? (locksProp !== undefined && onLocksChange !== undefined),
    transport: chrome?.transport ?? true,
    diagnostics: chrome?.diagnostics ?? true,
    shortcuts: chrome?.shortcuts ?? true,
    directionLine: chrome?.directionLine ?? true,
    activateZoom: chrome?.activateZoom ?? true,
    controls: chrome?.controls ?? true,
    themeToggle: chrome?.themeToggle ?? true,
    scrubber: chrome?.scrubber ?? true,
  }
  // The host's graph, checked once: every defect named, the edges an error
  // names left out of what is drawn, and the containment edge each `parentId`
  // implies added where the host listed none. The list is shown under the bar
  // and handed to `onDiagnostics`.
  const { diagnostics: graphDiagnostics, graph } = React.useMemo(() => {
    const diagnostics = validateGraph(hostGraph, taxonomy)
    return { diagnostics, graph: withContainmentEdges(dropInvalid(hostGraph, diagnostics)) }
  }, [hostGraph, taxonomy])
  const { groups: nodeGroups, diagnostics: groupDiagnostics } = React.useMemo(() => nodeGroupsOf(groups ?? NO_GROUPS, graph.nodes), [groups, graph])
  const groupSlots = React.useMemo(() => groupSlotsOf(nodeGroups, graph.edges), [nodeGroups, graph])
  const groupsOf = React.useMemo(() => groupsByNode(nodeGroups), [nodeGroups])
  const diagnostics = React.useMemo(() => groupDiagnostics.length ? [...graphDiagnostics, ...groupDiagnostics] : graphDiagnostics, [graphDiagnostics, groupDiagnostics])
  const graphIndex = React.useMemo(() => nodesById(graph.nodes), [graph])
  const counts = React.useMemo(
    () => (typeof hostCounts === 'object' ? hostCounts : countsOn(graph.nodes, axes, hostCounts && { filter, taxonomy })),
    [hostCounts, graph, axes, hostCounts === 'faceted' && filter, taxonomy],
  )
  // Every node's copies, by the key they share — derived here, once per graph.
  const copies = React.useMemo(() => copyGroups(graph), [graph])

  // --- Core state ---
  // Camera (viewport transform, container and overlay refs, every framing),
  // framing the visible nodes, set below once they are derived.
  const visibleNodesRef = React.useRef<SimNode[]>([])
  const { viewport, moveViewport, containerRef, overlayRef, overlayHeight, requestFrame, tickFrame, releaseFrame } = useViewport(visibleNodesRef)
  // The simulation instance + its handlers are owned by useSimulation, and the
  // RAF loop + fps by useSimulationLoop, both called below once `graph` and the
  // visible subgraph are available.

  // Interaction / highlight state (hover, selection, keyboard focus, shift, and
  // the control-panel preview) is owned by useHighlight, called below once the
  // visible subgraph it derives from is available.

  // --- Search ---
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  // A pane that measures no height while displayed draws nothing and says
  // nothing: said once here, with the fix. A pane hidden by its host
  // (`display: none`, a tab shell's other tab) has no offset parent and is
  // not the case.
  const saidZeroRef = React.useRef(false)
  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => {
      if (saidZeroRef.current || el.offsetParent === null) return
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height === 0) {
        saidZeroRef.current = true
        console.warn('[force-graph] the pane measured 0 px tall: give its parent a height — the pane fills a flex column, or a block with a height.')
      }
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // What each filter axis can take, read off the graph: the engine declares no
  // value vocabulary, so the bar learns an axis's domain from the nodes.
  const valuesByAxis = React.useMemo(
    () => new Map(taxonomy.filterAxes.map(d => [d.id, valuesOn(graph.nodes, d.id)])),
    [graph, taxonomy],
  )
  const recentlyChanged = useRecentlyChanged(filter, valuesByAxis)

  // The opening frame, when a rebuild follows a drawing of no node: called
  // from useSimulation's build effect, before the new simulation is drawn.
  const onSimRebuild = () => {
    if (visibleNodesRef.current.length === 0) requestFrame({ ids: graph.nodes.map(n => n.id), when: 'warm', hold: true })
  }

  // The tuning: the host's while `tuning` is defined, the view's own
  // otherwise. Every write — the control panel's, a retune — goes through
  // `tuningRef`, which composes two writes in one tick the way the filter's
  // ref does, tells the host, and applies the write when the view owns it.
  const [rawTuning, setTuning] = useControllable<Tuning>(tuningProp, onTuningChange, () => defaultTuning ?? defaultTuningFor(taxonomy), 'tuning')
  // Compared by content, as the filter is: a host that re-reads its tuning
  // from JSON each render is not read as a change, and the retune does not
  // write back every render.
  const tuning = openTuning(useStable(rawTuning, tuningsEqual))
  const tuningRef = useLatest(tuning)
  const writeTuning = React.useCallback((next: Tuning) => {
    tuningRef.current = openTuning(next)
    setTuning(next)
  }, [tuningRef, setTuning])
  const updateForces = React.useCallback((fn: (prev: ForceParams) => ForceParams) => {
    const prev = tuningRef.current
    const forces = fn(prev.forces)
    if (forces !== prev.forces) writeTuning(makeTuning(forces, prev.nodeScale))
  }, [tuningRef, writeTuning])

  // Simulation spine: the instance, version signal, running flag, the force
  // parameters as retuned for this graph and taxonomy, and every
  // sim-mutating handler.
  const {
    simRef,
    simVersion,
    running, setRunning,
    forceParams,
    resolved,
    frame,
    getNode: getSimNode,
    onParamChange: handleParamChange,
    onForceAdjust: handleForceAdjust,
    onRelayout: handleRelayout,
    onNodeDragStart: handleNodeDragStart,
    onNodeDragMove: handleNodeDragMove,
    onNodeDragEnd: handleNodeDragEnd,
    onToggleRunning: handleToggleRunning,
  } = useSimulation(graph, taxonomy, defaultPositions, onSimRebuild, tuning.forces, updateForces)

  const dragNode = React.useCallback((id: string, wx: number, wy: number) => {
    releaseFrame()
    handleNodeDragStart(id, wx, wy)
  }, [releaseFrame, handleNodeDragStart])

  // What the push/pull tab offers: every axis this graph admits with its
  // measured token cost, and the spring categories some edge falls in under
  // the current one (the pull tokens). Both read the whole graph, not the
  // visible subset — tuning covers what a filter may reveal next.
  const axisChoices = React.useMemo(() => axisOptions(taxonomy, graph), [taxonomy, graph])
  const layoutAxes = React.useMemo(() => layoutAxisOptions(axisChoices, taxonomy), [axisChoices, taxonomy])
  // The theme the pane draws in: the choice, or the host's for system. The
  // scheme rides inline as custom properties in that theme, and every
  // visible edge's stroke is resolved here once, not per frame.
  const resolvedTheme = useResolvedTheme(containerRef, themeChoice, systemTheme)
  const theme = resolvedTheme ?? 'light'
  const schemeStyle = React.useMemo(() => scopeStyle(taxonomy, theme, tokens), [taxonomy, theme, tokens])
  const overlay = React.useMemo(() => bandOverlay(graph.nodes, forceParams, resolved, frame,
    (axis, bucket) => axis.mapping.axis === taxonomy.styleAxis() && isIdentityMapping(axis.mapping)
      ? taxonomy.styleOf(bucket).color[theme].fill
      : undefined), [graph, forceParams, resolved, frame, taxonomy, theme])

  // A new axis starts both pair forces from the taxonomy's declared physics on
  // its buckets (a tuning keyed by one axis has no reading on another).
  const handleAxisChange = React.useCallback((mapping: AxisMapping) => {
    if (mappingKey(mapping) === mappingKey(forceParams.pair.mapping)) return
    handleRelayout({ pair: pairTuning(mapping) })
  }, [forceParams.pair.mapping, handleRelayout])

  // Render-time node sizing — the tuning's other half, tunable from the
  // Controls panel (Misc → Node scaling); a pure-render concern, so a change
  // reheats nothing.
  const nodeScale = tuning.nodeScale
  const handleNodeScaleChange = React.useCallback((patch: Partial<NodeScaleParams>) => {
    const prev = tuningRef.current
    writeTuning(makeTuning(prev.forces, { ...prev.nodeScale, ...patch }))
  }, [tuningRef, writeTuning])

  // The preset row, read against the tuning as the panel shows it.
  const shownTuning = React.useMemo(() => makeTuning(forceParams, nodeScale), [forceParams, nodeScale])
  const { menu: presetMenu, choose: choosePreset } = usePresets(presets, taxonomy, graph, shownTuning, tuningRef, writeTuning, handleRelayout)

  // The locks a focus overrode — the view's own, or a host's under a new
  // key — go to the bar under a key of the view's, which it flashes once.
  const [flashLocks, setFlashLocks] = React.useState(NO_OVERRIDES)
  const flash = React.useCallback((axes: ReadonlySet<AxisId>) => setFlashLocks(prev => ({ axes, key: prev.key + 1 })), [])
  React.useEffect(() => {
    if (hostOverridden && hostOverridden.axes.size > 0) flash(hostOverridden.axes)
  }, [hostOverridden?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Visible subgraph derived from the live sim (filter + edge graduation +
  // summaries + downstream-depth scores), recomputed on filter / sim-rebuild.
  const { visibleNodes, visibleEdges, visibleIds, edgeTypes, undirected, origins, nodeSummaries, downstreamScores } =
    useVisibleGraph(simRef, simVersion, filter, filterAxes, taxonomy, groupsOf)
  visibleNodesRef.current = visibleNodes
  const visibleEdgesRef = useLatest(visibleEdges)

  // The visible edges the host marks, each through its original.
  const visibleMarked = React.useMemo(() => {
    const out = new Set<string>()
    if (markedEdges) for (const edge of visibleEdges) if (markedEdges.has(origins.get(edge.id)!)) out.add(edge.id)
    return out
  }, [markedEdges, visibleEdges, origins])

  // Every visible edge's stroke, from the type the derivation resolved on the
  // edge's ORIGINAL endpoints, once, not per frame. An edge no type claims
  // draws in its relation's default stroke; the diagnostics have named it.
  const typeStrokes = React.useMemo(() => {
    const strokes = new Map<GraphEdge, EdgeStroke>()
    for (const edge of visibleEdges) {
      const type = edgeTypes.get(edge.id)
      strokes.set(edge, type !== undefined ? engineOf(taxonomy).edgeStrokeFor(type) : isContainment(edge) ? CONTAINMENT_STROKE : NEUTRAL_STROKE)
    }
    return strokes
  }, [visibleEdges, edgeTypes, taxonomy])
  // At a playhead, an edge with a series strokes its count there over the
  // peak of the whole graph, not of what the filter shows; else its weight.
  const timeWindow = windowOf(graph)
  const peak = React.useMemo(() => peakOf(graph.edges, timeWindow), [graph, timeWindow])
  const playhead = timeWindow && rawPlayhead !== null ? Math.min(timeWindow.buckets - 1, Math.max(0, rawPlayhead)) : null
  const edgeStrokes = React.useMemo(() => {
    const strokes = new Map<GraphEdge, EdgeStroke>()
    for (const [edge, base] of typeStrokes) {
      const series = seriesOf(edge, timeWindow)
      strokes.set(edge, playhead !== null && series ? played(base, intensityAt(series, playhead, peak)) : weighted(base, unitWeight(edge)))
    }
    return strokes
  }, [typeStrokes, playhead, timeWindow, peak])

  // Parallel dependency edges — two or more between one pair of visible nodes,
  // kept apart — take lanes a few pixels either side of the line so
  // both read. One pass per visible set.
  const edgeOffsets = React.useMemo(() => {
    const byPair = new Map<string, string[]>()
    for (const e of visibleEdges) {
      if (isContainment(e)) continue
      const key = e.sourceId < e.targetId ? `${e.sourceId}|${e.targetId}` : `${e.targetId}|${e.sourceId}`
      const list = byPair.get(key)
      if (list) list.push(e.id); else byPair.set(key, [e.id])
    }
    const out = new Map<string, number>()
    for (const ids of byPair.values()) {
      if (ids.length < 2) continue
      ids.forEach((id, i) => out.set(id, (i - (ids.length - 1) / 2) * 7))
    }
    return out
  }, [visibleEdges])

  // What the controls offer: only what the post-filter visible set holds —
  // `presentSetsOf`.
  // The pull half is read over the edges the simulation springs (the graph's
  // own, both ends visible), not over the graduated edges it draws.
  const sprung = React.useMemo(() => sprungEdges(graph.edges, visibleIds), [graph, visibleIds])
  // Group cohesion: settled when the groups or the visible set change, never
  // per tick; a changed multiplier warms the layout it retunes.
  const cohesion = React.useMemo(() => cohesionOf(nodeGroups, sprung, groupCohesion), [nodeGroups, sprung, groupCohesion])
  React.useEffect(() => simRef.current?.setCohesion(cohesion), [cohesion, simVersion, simRef])
  React.useEffect(() => handleForceAdjust(), [groupCohesion, handleForceAdjust])
  const present = React.useMemo<PresentSets>(
    () => presentSetsOf(visibleNodes, sprung, resolved, getSimNode),
    [visibleNodes, sprung, resolved, taxonomy, getSimNode],
  )

  // The selection: the host's while `selectedId` is defined, the view's own
  // otherwise. Everything the user does to it — a click, Enter, Escape, a
  // search pick, a focus landing, the handle — goes through `requestSelect`,
  // which tells the host of a change and, when the view owns the state,
  // applies it; a host that controls the selection answers by setting the
  // prop, or does not.
  const controlledSelection = selectedId !== undefined
  useControlledWarning('selectedId', controlledSelection)
  const [ownSelected, setOwnSelected] = React.useState<string | null>(defaultSelectedId)
  const selectedNodeId = controlledSelection ? selectedId : ownSelected
  const selectedRef = useLatest(selectedNodeId)
  const onSelectionChangeRef = useLatest(onSelectionChange)
  // Read through refs so the callback never goes stale: the physics loop
  // holds it across renders, and a focus landing after a graph change must
  // report the new graph's node, not the one the loop was created with.
  const hostIndexRef = useLatest(hostIndex)
  const requestSelect = React.useCallback((next: string | null) => {
    // An id the graph does not hold is not a selection: ignored, so what the
    // view shows and what it reports never disagree.
    if (next !== null && !hostIndexRef.current.has(next)) return
    if (!controlledSelection) setOwnSelected(next)
    if (next !== selectedRef.current) onSelectionChangeRef.current?.(next === null ? null : hostIndexRef.current.get(next) ?? null)
  }, [controlledSelection, hostIndexRef, selectedRef, onSelectionChangeRef])
  // The view's own selection does not outlive its node: a graph that no
  // longer holds it clears the selection, and the host hears the null.
  React.useEffect(() => {
    if (controlledSelection || ownSelected === null || hostIndex.has(ownSelected)) return
    setOwnSelected(null)
    onSelectionChangeRef.current?.(null)
  }, [hostIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hover / keyboard-focus / shift + control-panel preview state, plus the
  // derived transitive-dependency highlight sets and focusedNodeId.
  const {
    hoveredNodeId, setHoveredNodeId,
    setFocusedIndex,
    shiftHeld,
    focusedNodeId,
    highlightedNodes, highlightedEdges,
    activeSection, setActiveSection,
    activePushBucket, setActivePushBucket,
    activeGravityBucket, setActiveGravityBucket,
    activePullEdge, setActivePullEdge,
  } = useHighlight(visibleNodes, visibleEdges, visibleIds, undirected, getSimNode, graph, taxonomy, selectedNodeId, hostIndex)

  const hiddenBy = React.useMemo(() => hiddenByOf(graph.nodes, filter, groupsOf), [graph, filter, groupsOf])

  // The groups as drawn: the ones the filter shows, restricted to the visible
  // set and coloured by slot, the one its control emphasises glowing stronger.
  // Drives the canvas glow and the host's control.
  const [emphasizedGroup, setEmphasizedGroup] = React.useState<string | null>(null)
  const groupsHandle = React.useMemo<GroupsControl>(() => ({
    shown: id => selects(selectionFor(filter, GROUPS), id),
    toggle: filterWritable ? id => userWriteFilter(toggleValue(filterRef.current, GROUPS, id), [GROUPS]) : undefined,
    emphasize: setEmphasizedGroup,
  }), [filter, filterWritable, userWriteFilter, filterRef])
  const activeGroups = React.useMemo(() => activeGroupsOf(nodeGroups, groupSlots, visibleIds, groupsHandle.shown, theme, emphasizedGroup), [nodeGroups, groupSlots, visibleIds, groupsHandle, theme, emphasizedGroup])

  // Canvas glow set: the active groups with the group under the hovered/selected
  // node strengthened, so one group surfaces from many faint ones as the pointer
  // moves. The modal keeps the un-boosted activeGroups (its legend colors don't
  // depend on strength).
  const glowGroups = React.useMemo(
    () => boostGroupsForNodes(activeGroups, [hoveredNodeId, selectedNodeId]),
    [activeGroups, hoveredNodeId, selectedNodeId],
  )

  // Search matches against all nodes (not just visible). When search is
  // active we return a Set even if empty so the canvas dims everything —
  // an empty search with a query is "no matches yet, all non-matching",
  // not "no search active".
  // Hidden matches are counted on the chip hiding them: the first declared
  // axis the node fails, under its value there — a precedence a host's own
  // filter bar can share, so the two read alike.
  const { visibleMatchIds, hiddenMatchCount, hiddenMatches } = React.useMemo(() => {
    const none = new Map<string, ReadonlyMap<string, number>>()
    if (!searchQuery) return { visibleMatchIds: null as Set<string> | null, hiddenMatchCount: 0, hiddenMatches: none }
    const lq = searchQuery.toLowerCase()
    const sim = simRef.current
    if (!sim) return { visibleMatchIds: new Set<string>(), hiddenMatchCount: 0, hiddenMatches: none }
    // The host's hook is handed the host's own node, never the simulation's copy.
    const split = hiddenMatchesOf({ nodes: sim.nodes, filter, taxonomy, axes, visibleIds, matches: node => taxonomy.searchText(hostIndex.get(node.id) ?? node).toLowerCase().includes(lq) })
    return { visibleMatchIds: split.visible, hiddenMatchCount: split.hiddenCount, hiddenMatches: split.hiddenByAxis }
  }, [searchQuery, visibleIds, filter, axes, taxonomy, hostIndex])

  // Every node's position, by id: what `getPositions` answers and `onSettled` hears.
  const positions = () => new Map((simRef.current?.nodes ?? []).map(n => [n.id, { x: n.x, y: n.y }]))
  const onSettledRef = useLatest(onSettled)
  const { fps } = useSimulationLoop({
    simRef, running, setRunning,
    onSettled: () => onSettledRef.current?.(positions()),
    visibleIds, downstreamScores,
    filter, axes: filterAxes, groupsOf,
    hoveredNodeId, selectedNodeId,
    requestFrame, tickFrame, releaseFrame, taxonomy,
  })

  // What the host hears: the hover, a double-click, the resolved theme and
  // the graph's diagnostics — always the host's own node objects, never the
  // view's copies. Read through refs, so a host passing a fresh function
  // each render is not re-notified of an unchanged value. The hover does not
  // fire for the empty state the view mounts in; the diagnostics do, since
  // a host wants its first graph's defects too. The selection reports from
  // `requestSelect`, above.
  const onHoverRef = useLatest(onHover)
  const onNodeActivateRef = useLatest(onNodeActivate)
  const onThemeResolvedRef = useLatest(onThemeResolved)
  const onDiagnosticsRef = useLatest(onDiagnostics)
  const mountedRef = React.useRef(false)
  React.useEffect(() => {
    if (!mountedRef.current) return
    onHoverRef.current?.(hoveredNodeId === null ? null : hostIndex.get(hoveredNodeId) ?? null)
  }, [hoveredNodeId]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { mountedRef.current = true }, [])
  React.useEffect(() => { if (resolvedTheme) onThemeResolvedRef.current?.(resolvedTheme) }, [resolvedTheme]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { onDiagnosticsRef.current?.(diagnostics) }, [diagnostics]) // eslint-disable-line react-hooks/exhaustive-deps

  // Double-click node: center and zoom to neighbors, and tell the host.
  const handleDoubleClickNode = React.useCallback((id: string) => {
    const hostNode = hostIndex.get(id)
    if (hostNode) onNodeActivateRef.current?.(hostNode)
    if (show.activateZoom) requestFrame({ ids: neighborhoodOf(id, visibleEdges), padding: 80 })
  }, [requestFrame, hostIndex, show.activateZoom, visibleEdges])

  // Fit-to-view
  const handleFitToView = React.useCallback(() => {
    requestFrame({ ids: visibleIds })
  }, [requestFrame, visibleIds])

  // Search toggle — used by the keyboard handler (Escape closes search). The
  // filter-bar's own search button has its own copy inside FilterBar. Search
  // query is globally shared so clearing it on close affects both views.
  const toggleSearch = () => {
    if (searchActive) {
      setSearch({ query: '', active: false })
    } else {
      setSearch({ query: searchQuery, active: true })
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }

  // Hover with a grace period so the pointer can travel from a node onto its
  // hover tooltip (interactive — it carries the host's cross-view button)
  // without the tooltip vanishing. A null from the canvas schedules a clear;
  // the tooltip's onMouseEnter cancels it, onMouseLeave re-arms it.
  const hoverClearTimer = React.useRef<number | null>(null)
  const cancelHoverClear = React.useCallback(() => {
    if (hoverClearTimer.current !== null) {
      clearTimeout(hoverClearTimer.current)
      hoverClearTimer.current = null
    }
  }, [])
  const handleHoverNode = React.useCallback((id: string | null) => {
    cancelHoverClear()
    if (id !== null) {
      setHoveredNodeId(id)
    } else {
      hoverClearTimer.current = window.setTimeout(() => {
        setHoveredNodeId(null)
        hoverClearTimer.current = null
      }, 150)
    }
  }, [cancelHoverClear, setHoveredNodeId])

  // Select node from search result
  const handleSelectSearchResult = (nodeId: string) => {
    requestSelect(nodeId)
    requestFrame({ ids: [nodeId], minScale: 0 })
  }

  const [flashNode, setFlashNode] = React.useState<{ id: string; at: number } | null>(null)
  const focusNodeById = React.useCallback((id: string): boolean => {
    const node = graphIndex.get(id)
    if (!node) return false
    const base = filterRef.current
    // Widened by whole chips: the graph says which values each chip holds.
    const result = reconcileFilter({ destination: base, source: base, locks, transition: { kind: 'focus', target: { values: node.values, groups: groupsOf.get(id) } }, taxonomy, axes, graph })
    // A read-only filter (controlled, no callback) cannot be widened: the
    // node is judged, framed and reported against the filter the view holds.
    const applied = filterWritable ? result.filter : base
    if (applied !== base) {
      writeFilter(applied, [])
      if (result.overriddenLocks.size > 0) flash(result.overriddenLocks)
    }
    // Whether the filter shows the node: a value absent on a hiding axis
    // cannot be revealed by widening, and the host should know.
    const shown = passesFilter(node, applied, taxonomy, filterAxes, groupsOf)
    if (!shown) return false
    requestSelect(id)
    // Read at each frame, so the neighbors the widened filter draws count.
    const neighborhood = { [Symbol.iterator]: () => neighborhoodOf(id, visibleEdgesRef.current).values() }
    requestFrame({ ids: neighborhood, when: 'next', hold: true, released: () => setFlashNode({ id, at: performance.now() }) })
    if (!running) {
      simRef.current?.reheat(0.1)
      setRunning(true)
    }
    return true
  }, [graphIndex, graph, groupsOf, filterRef, filterWritable, writeFilter, flash, locks, axes, filterAxes, running, setRunning, simRef, requestFrame, requestSelect, taxonomy, visibleEdgesRef])
  // The declarative focus. A request is new when its id or key differs from
  // the last one; it waits until its node is in the graph, then runs the
  // focus recipe once and reports whether the node could be shown. A null
  // withdraws a waiting request.
  const lastFocusRef = React.useRef<FocusRequest | null>(null)
  const pendingFocusRef = React.useRef<FocusRequest | null>(null)
  const onFocusResultRef = useLatest(onFocusResult)
  React.useEffect(() => {
    if (!namesNode(focus)) { lastFocusRef.current = null; pendingFocusRef.current = null; return }
    if (sameFocusRequest(lastFocusRef.current, focus)) return
    lastFocusRef.current = focus
    pendingFocusRef.current = focus
  }, [focus])
  // A request whose node is in the graph lands on the NEXT commit, not this
  // one: a write the host or its hook queued in this same commit — the
  // re-seed for the graph that brought the node — has reached a controlled
  // filter by then, and the recipe builds on it instead of overwriting it.
  const [landing, setLanding] = React.useState<FocusRequest | null>(null)
  React.useEffect(() => {
    const request = pendingFocusRef.current
    if (!request || !graphIndex.has(request.id)) return
    pendingFocusRef.current = null
    setLanding(request)
  }, [focus, graphIndex])
  React.useEffect(() => {
    if (!landing) return
    setLanding(null)
    // Withdrawn meanwhile (null, or a newer request): not landed, not reported.
    if (!sameFocusRequest(lastFocusRef.current, landing)) return
    onFocusResultRef.current?.(landing, focusNodeById(landing.id))
  }, [landing]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useImperativeHandle(ref, () => ({
    focusNode: focusNodeById,
    select: requestSelect,
    fit: handleFitToView,
    getPositions: positions,
    setPositions: (next: ReadonlyMap<string, Position>) => {
      const sim = simRef.current
      if (!sim) return
      for (const [id, p] of next) {
        const n = sim.getNode(id)
        if (!n || n.pinned) continue
        n.x = p.x; n.y = p.y; n.vx = 0; n.vy = 0
      }
      sim.reheat(0.1)
      setRunning(true)
    },
    updateFilter: (fn: (filter: FilterState) => FilterState) => {
      const prev = filterRef.current
      const next = fn(prev)
      if (!filterStatesEqual(prev, next)) userWriteFilter(next, changedAxes(prev, next))
    },
  }), [focusNodeById, handleFitToView, setRunning, requestSelect, simRef, filterRef, userWriteFilter])

  // Keyboard, scoped by `keyboard`: on the pane, the focusable root
  // handles the keys that reach it; globally, the window does — a tab shell
  // passes `global` for its active tab and `none` for the hidden one, kept
  // mounted. A control keeps its own keys either way: Space on a button
  // activates the button, not the simulation, and Tab from a control moves
  // focus.
  const handleKey = React.useCallback((e: KeyboardEvent) => {
    // A chord is the browser's or the host's (find, zoom, the host's own
    // shortcuts): never this pane's.
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target instanceof Element ? e.target : null
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    const onControl = target !== null && target !== containerRef.current &&
      target.closest('button, select, a, [contenteditable], [role="tab"]') !== null
    if (onControl && e.key !== 'Escape') return

    switch (e.key) {
      case 'Tab': {
        // Tab cycles nodes only while the pane itself is focused, in either
        // scope; from the page it moves focus as it always does, so a keyboard
        // user can always reach the host's controls.
        if (target !== containerRef.current) return
        e.preventDefault()
        const count = visibleNodes.length
        if (count === 0) return
        if (e.shiftKey) {
          setFocusedIndex(prev => prev > 0 ? prev - 1 : count - 1)
        } else {
          setFocusedIndex(prev => prev < count - 1 ? prev + 1 : 0)
        }
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (focusedNodeId) requestSelect(focusedNodeId)
        break
      }
      case 'Escape': {
        // Cancelled only when something here closes; otherwise the key is the
        // host's. With nothing left to close, the pane gives focus back.
        if (shortcutsOpen) { e.preventDefault(); setShortcutsOpen(false); break }
        if (searchActive) { e.preventDefault(); toggleSearch(); break }
        if (selectedNodeId) { e.preventDefault(); requestSelect(null); break }
        if (keyboard === 'pane') containerRef.current?.blur()
        break
      }
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault()
        const PAN_STEP = 30
        const dx = e.key === 'ArrowLeft' ? PAN_STEP : e.key === 'ArrowRight' ? -PAN_STEP : 0
        const dy = e.key === 'ArrowUp' ? PAN_STEP : e.key === 'ArrowDown' ? -PAN_STEP : 0
        moveViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
        break
      }
      case '+':
      case '=': {
        e.preventDefault()
        moveViewport(prev => zoomAt(prev, (containerRef.current?.clientWidth ?? 400) / 2, (containerRef.current?.clientHeight ?? 400) / 2, 1.15))
        break
      }
      case '-':
      case '_': {
        e.preventDefault()
        moveViewport(prev => zoomAt(prev, (containerRef.current?.clientWidth ?? 400) / 2, (containerRef.current?.clientHeight ?? 400) / 2, 0.85))
        break
      }
      case 'f':
      case 'F': {
        e.preventDefault()
        handleFitToView()
        break
      }
      case '/': {
        if (!show.search) break
        e.preventDefault()
        if (!searchActive) {
          setSearch({ query: searchQuery, active: true })
          setTimeout(() => searchInputRef.current?.focus(), 50)
        } else {
          searchInputRef.current?.focus()
        }
        break
      }
      case ' ': {
        e.preventDefault()
        handleToggleRunning()
        break
      }
      case '?': {
        if (!show.shortcuts) break
        e.preventDefault()
        setShortcutsOpen(prev => !prev)
        break
      }
    }
  }, [keyboard, visibleNodes, focusedNodeId, selectedNodeId, requestSelect, searchActive, searchQuery, setSearch, shortcutsOpen, show.search, show.shortcuts, handleFitToView, handleToggleRunning]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (keyboard !== 'global') return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [keyboard, handleKey])
  const paneKeyDown = React.useCallback((e: React.KeyboardEvent) => handleKey(e.nativeEvent), [handleKey])

  // The host's action for the hovered node — one for every node, or the
  // host's answer per node — handed the host's own node object, never the
  // simulation's copy.
  const actionFor = React.useCallback((node: GraphNode): NodeAction | null => {
    const host = hostIndex.get(node.id) ?? node
    const action = typeof nodeAction === 'function' ? nodeAction(host) : nodeAction ?? null
    return action && { label: action.label, onSelect: () => action.onSelect(host) }
  }, [nodeAction, hostIndex])
  const hostNodeOf = React.useCallback((id: string) => hostIndex.get(id), [hostIndex])

  const nodeCount = visibleNodes.length
  const edgeCount = visibleEdges.length

  return (
    <TaxonomyContext.Provider value={taxonomy}>
    <CanvasErrorBoundary what="graph view">
    <div
      className={`gv-graph-view${className ? ` ${className}` : ''}`}
      ref={containerRef}
      data-gv-theme={theme}
      tabIndex={keyboard === 'pane' ? 0 : undefined}
      onKeyDown={keyboard === 'pane' ? paneKeyDown : undefined}
      style={{ ...schemeStyle, ...(overlayHeight ? { ['--gv-toolbar-height' as string]: `${overlayHeight}px` } : {}), ...style }}
    >
      {/* Canvas fills the full viewport beneath the floating overlay */}
      <div className="gv-graph-canvas-area">
        <CanvasErrorBoundary>
          <GraphCanvas
            nodes={visibleNodes}
            edges={visibleEdges}
            viewport={viewport}
            onViewportChange={moveViewport}
            onNodeDragStart={dragNode}
            onNodeDragMove={handleNodeDragMove}
            onNodeDragEnd={handleNodeDragEnd}
            onDoubleClickNode={handleDoubleClickNode}
            onFitView={handleFitToView}
            onHoverNode={handleHoverNode}
            onSelectNode={requestSelect}
            highlightedNodes={highlightedNodes}
            highlightedEdges={highlightedEdges}
            hoveredNodeId={hoveredNodeId}
            selectedNodeId={selectedNodeId}
            focusedNodeId={focusedNodeId}
            flashNode={flashNode}
            searchMatchIds={visibleMatchIds}
            running={running}
            forceParams={forceParams}
            resolved={resolved}
            overlay={overlay}
            theme={theme}
            edgeStrokes={edgeStrokes}
            edgeOffsets={edgeOffsets}
            undirectedEdges={undirected}
            activeSection={activeSection}
            activePushBucket={activePushBucket}
            activeGravityBucket={activeGravityBucket}
            activePullEdge={activePullEdge}
            nodeScale={nodeScale}
            groupGlows={glowGroups}
            markedEdges={visibleMarked}
          />
        </CanvasErrorBoundary>
        <GraphHoverTooltip
          hoveredNodeId={hoveredNodeId}
          simRef={simRef}
          visibleEdges={visibleEdges}
          undirected={undirected}
          visibleIds={visibleIds}
          viewport={viewport}
          shiftHeld={shiftHeld}
          directionLine={show.directionLine}
          copies={copies}
          nodeSummaries={nodeSummaries}
          nodeAction={actionFor}
          hostNodeOf={hostNodeOf}
          onMouseEnter={cancelHoverClear}
          onMouseLeave={() => handleHoverNode(null)}
        />
      </div>

      {/* Floating overlay: the shared filter bar (with the host's findings), the
          pane's own diagnostics, the search results. Measured whole: its height
          is `--gv-toolbar-height`, where a host control anchors. */}
      <div className="gv-graph-overlay" ref={overlayRef}>
        <div className="gv-graph-toolbar">
          <FilterBar
            chrome={{ search: show.search, locks: show.locks }}
            theme={theme}
            counts={counts}
            values={valuesByAxis}
            filter={filter}
            onFilterChange={userWriteFilter}
            locks={locks}
            onLocksChange={setLocks}
            axes={axes}
            onAxesChange={axesEditable ? setAxes : undefined}
            overriddenLocks={flashLocks}
            recentlyChanged={recentlyChanged}
            search={search}
            onSearchChange={setSearch}
            searchInputRef={searchInputRef}
            searchTitle={searchTitle}
            searchPlaceholder={searchPlaceholder}
            searchExtra={hiddenMatchBadge(hiddenMatchCount)}
            hiddenMatches={hiddenMatches}
            findings={findings}
          />
        </div>

        {show.diagnostics && diagnostics.length > 0 && <GraphDiagnostics diagnostics={diagnostics} />}

        {/* Search results dropdown */}
        {visibleMatchIds && visibleMatchIds.size > 0 && searchActive && (
          <div className="gv-graph-search-results">
            {visibleNodes.filter(n => visibleMatchIds.has(n.id)).map(n => (
              <button
                key={n.id}
                className="gv-graph-search-result"
                onClick={() => handleSelectSearchResult(n.id)}
              >
                <span className="gv-graph-search-result-type">{engineOf(taxonomy).nodeStyleOf(n).label}</span>
                <span className="gv-graph-search-result-name">{n.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>{/* /graph-overlay */}

      {/* Bottom-left: node/edge counts (shifts right when the shortcuts panel
          is open so they don't overlap). */}
      {show.transport && <div className={`gv-graph-bottom-left${shortcutsOpen ? ' shifted' : ''}`}>
        <span className="gv-graph-count">
          {nodeCount} node{nodeCount !== 1 ? 's' : ''}, {edgeCount} edge{edgeCount !== 1 ? 's' : ''}
        </span>
      </div>}

      {/* Bottom-center: simulation controls + live fps. */}
      {show.transport && <div className="gv-graph-bottom-center">
        <button className="gv-graph-toolbar-btn" onClick={handleFitToView} title="Fit to view (F)">Fit</button>
        {show.themeToggle && (
          <button
            className={`gv-graph-toolbar-btn${themeChoice === 'system' ? '' : ' active'}`}
            onClick={() => setThemeChoice(THEME_CHOICES[(THEME_CHOICES.indexOf(themeChoice) + 1) % THEME_CHOICES.length])}
            title={`Colour scheme: ${themeChoice}${themeChoice === 'system' ? ` (${theme})` : ''} — click to change`}
            aria-label="Colour scheme"
          >
            {themeChoice === 'system' ? 'Auto' : themeChoice === 'light' ? 'Light' : 'Dark'}
          </button>
        )}
        <button
          className={`gv-graph-toolbar-btn ${running ? 'active' : ''}`}
          onClick={handleToggleRunning}
          title={running ? 'Pause simulation (Space)' : 'Resume simulation (Space)'}
        >
          {running ? 'Pause' : 'Play'}
        </button>
        {/* Always rendered (reserving its width) so toggling Play/Pause never
            shifts the centred cluster; hidden when the simulation is paused. */}
        <span className={`gv-graph-count-fps${running ? '' : ' hidden'}`} title="Simulation frames per second">{fps} fps</span>
      </div>}

      {show.scrubber && timeWindow && <Scrubber window={timeWindow} playhead={playhead} onPlayheadChange={setPlayhead} />}

      {/* Control panel */}
      {show.controls && <GraphControlPanel
        params={forceParams}
        resolved={resolved}
        onParamChange={handleParamChange}
        onAdjust={handleForceAdjust}
        onRelayout={handleRelayout}
        axes={axisChoices}
        layoutAxes={layoutAxes}
        present={present}
        hiddenBy={hiddenBy}
        onAxisChange={handleAxisChange}
        onActiveSection={setActiveSection}
        onActivePushBucket={setActivePushBucket}
        onActiveGravityBucket={setActiveGravityBucket}
        onActivePullEdge={setActivePullEdge}
        nodeScale={nodeScale}
        onNodeScaleChange={handleNodeScaleChange}
        presets={presetMenu}
        onPreset={choosePreset}
      />}

      {/* The host's control for its groups (top-left), handed the groups as drawn. */}
      {groupsControl?.(activeGroups, groupsHandle)}

      {/* Shortcuts panel */}
      {show.shortcuts && shortcutsOpen && (
        <div className="gv-graph-shortcuts-panel">
          <div className="gv-graph-shortcuts-title">
            Keyboard Shortcuts
            <button className="gv-graph-shortcuts-close" onClick={() => setShortcutsOpen(false)}>&times;</button>
          </div>
          <div className="gv-graph-shortcuts-list">
            <Shortcut keys="Tab / Shift+Tab" desc="Cycle focus" />
            <Shortcut keys="Enter" desc="Select focused node" />
            <Shortcut keys="Escape" desc="Deselect / close" />
            <Shortcut keys="Arrow keys" desc="Pan viewport" />
            <Shortcut keys="+ / -" desc="Zoom in / out" />
            <Shortcut keys="F" desc="Fit to view" />
            {show.search && <Shortcut keys="/" desc="Open search" />}
            <Shortcut keys="Space" desc="Toggle simulation" />
            <Shortcut keys="Shift + hover" desc="Upstream deps" />
            <Shortcut keys="?" desc="This panel" />
          </div>
        </div>
      )}
    </div>
    </CanvasErrorBoundary>
    </TaxonomyContext.Provider>
  )
})

/** The pane's own findings about the host's graph: each with its code; errors name edges the view does not draw. */
function GraphDiagnostics({ diagnostics }: { diagnostics: readonly GraphDiagnostic[] }) {
  const errors = diagnostics.filter(d => d.severity === 'error').length
  const warnings = diagnostics.length - errors
  const parts: string[] = []
  if (errors > 0) parts.push(`${errors} graph error${errors === 1 ? '' : 's'}`)
  if (warnings > 0) parts.push(`${warnings} graph warning${warnings === 1 ? '' : 's'}`)
  return (
    <details className={`gv-graph-diagnostics${errors > 0 ? ' has-errors' : ''}`} role={errors > 0 ? 'alert' : undefined}>
      <summary>{parts.join(', ')}{errors > 0 ? ' — what is named is not drawn' : ''}</summary>
      <ul>
        {diagnostics.map((d, i) => (
          <li key={i} className={`gv-graph-diagnostic ${d.severity}`}><code>{d.code}</code>{d.message}</li>
        ))}
      </ul>
    </details>
  )
}

interface GraphHoverTooltipProps {
  hoveredNodeId: string | null
  simRef: React.RefObject<Simulation | null>
  visibleEdges: GraphEdge[]
  undirected: ReadonlySet<string>
  visibleIds: Set<string>
  viewport: Viewport
  shiftHeld: boolean
  /** Whether the "dependencies / dependents" line is shown. */
  directionLine: boolean
  /** Every node's copies by their shared key, over the whole graph. */
  copies: ReadonlyMap<string, ReadonlySet<string>>
  nodeSummaries: Map<string, string>
  // The host's action for a node, when it offers one.
  nodeAction: (node: GraphNode) => NodeAction | null
  /** The host's own node by id — what the taxonomy's `contextLine` is handed, never the simulation's copy. */
  hostNodeOf: (id: string) => GraphNode | undefined
  // The tooltip is interactive: these keep it open while the pointer is over
  // it (so the cross-view button is clickable).
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function GraphHoverTooltip({ hoveredNodeId, simRef, visibleEdges, undirected, visibleIds, viewport, shiftHeld, directionLine, copies, nodeSummaries, nodeAction, hostNodeOf, onMouseEnter, onMouseLeave }: GraphHoverTooltipProps) {
  // Before the early returns: this is a hook, and the component bails out four
  // different ways below.
  const engine = engineOf(useTaxonomy())
  if (!hoveredNodeId) return null
  const sim = simRef.current
  if (!sim) return null
  const node = sim.getNode(hoveredNodeId)
  if (!node) return null

  // The context under the name is the taxonomy's answer: a host that keys a
  // value's identity on its own metadata says so there, as one line or
  // several; the library's default is the parent's name. The hook is handed
  // the host's own node and parent. The icon is the value's own.
  const parent = node.parentId === undefined ? undefined : hostNodeOf(node.parentId) ?? sim.getNode(node.parentId)
  const context = engine.contextLine(hostNodeOf(node.id) ?? node, parent)
  const contextLines: React.ReactNode[] = context === undefined || context === null ? []
    : Array.isArray(context) ? [...(context as readonly React.ReactNode[])] : [context as React.ReactNode]
  const action = nodeAction(node)
  const icon = engine.nodeStyleOf(node).icon

  // The composition line for a node that summarises its children (counted
  // per style value, named by its abbreviation). Degree nodes are covered by
  // the connection counts row below, so the box does not say it twice.
  const summaryKind = engine.nodeStyleOf(node).summaryKind
  const compositionLine =
    summaryKind === 'children'
      ? nodeSummaries.get(hoveredNodeId) || undefined
      : undefined

  // The node's badges, as the canvas draws them above it, in one line.
  const badgesLine = node.badges && node.badges.length > 0 ? node.badges.join(' ') : undefined

  let outgoing = 0, incoming = 0, both = 0
  for (const e of visibleEdges) {
    if (isContainment(e)) continue
    if (undirected.has(e.id)) {
      if (e.sourceId === hoveredNodeId || e.targetId === hoveredNodeId) both++
      continue
    }
    if (e.sourceId === hoveredNodeId) outgoing++
    if (e.targetId === hoveredNodeId) incoming++
  }

  // Copies indicator: when the same entity has more than one node in the
  // graph, say "copy i of N" so the user knows the halo they're seeing is
  // intentional. Count only copies that survive the current filter — a hidden
  // copy isn't a copy from the user's current point of view.
  const sisters = copies.get(copyKeyOf(node))
  const visibleCopies = sisters
    ? Array.from(sisters).filter(id => visibleIds.has(id))
    : [node.id]
  const copyCount = visibleCopies.length
  const copyIndex = copyCount > 1 ? visibleCopies.indexOf(node.id) + 1 : 0

  const [sx, sy] = worldToScreen(viewport, node.x, node.y)

  return (
    <div
      className="gv-graph-hover-tooltip"
      style={{ left: sx, top: sy }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="gv-tooltip-identity">
        {icon && <span className="gv-tooltip-type-icon">{icon}</span>}
        <span className="gv-tooltip-name">{node.name}</span>
      </div>
      {contextLines.map((line, i) => <div key={i} className="gv-tooltip-parent">{line}</div>)}
      {compositionLine && <div className="gv-tooltip-summary">{compositionLine}</div>}
      {badgesLine && <div className="gv-tooltip-summary">{badgesLine}</div>}
      {copyCount > 1 && (
        <div className="gv-tooltip-duplicates" title="The same entity appears in more than one place. Hovering any copy marks all copies.">
          copy {copyIndex} of {copyCount}
        </div>
      )}
      {summaryKind !== 'none' && (outgoing > 0 || incoming > 0 || both > 0) && (
        <div className="gv-tooltip-connections">
          {outgoing > 0 && <span className="gv-tooltip-conn-out">→{outgoing}</span>}
          {incoming > 0 && <span className="gv-tooltip-conn-in">←{incoming}</span>}
          {both > 0 && <span className="gv-tooltip-conn-both">↔{both}</span>}
        </div>
      )}
      {directionLine && <div className="gv-tooltip-direction">{shiftHeld ? 'dependents' : 'dependencies'}</div>}
      {action && (
        <button
          className="gv-tooltip-cross-view"
          onClick={() => action.onSelect(node)}
          title={action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="gv-graph-shortcut-row">
      <kbd className="gv-graph-shortcut-key">{keys}</kbd>
      <span className="gv-graph-shortcut-desc">{desc}</span>
    </div>
  )
}

