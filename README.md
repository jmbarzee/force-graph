# @jmbarzee/force-graph

A force-directed graph view with composable axes, as a React component.

A host declares what its graph is made of — the **axes** its nodes carry values on,
the **values** on each, and for the style axis a colour per value — through
`createTaxonomy(spec)`. It builds a `Graph` of nodes and edges carrying
their values on those axes, and mounts `GraphView`. The view lays the graph out (push and
pull on any axis the nodes carry, two layout axes keyed on an axis or a
computed scalar), filters it on any declared axis, highlights it, and lets the
user tune the forces — without knowing what any node or edge means. The host's
vocabulary never enters this package. What the user sees and does is
[SPEC.md](SPEC.md).

## Install

```bash
npm install @jmbarzee/force-graph
```

`react` and `react-dom` are peer dependencies (`^18 || ^19`). The package is
ESM only. Import the stylesheet once — it carries the design tokens and every
component's rules.

## Quick start

The smallest host: a taxonomy of two values and two edge types, a graph of
three nodes, the view. The block below is the whole of it; a full host is
[`examples/course-catalog/`](examples/course-catalog/).

```tsx
import { createTaxonomy, GraphView } from '@jmbarzee/force-graph'
import type { Graph, GraphNode } from '@jmbarzee/force-graph'
import '@jmbarzee/force-graph/styles.css'

const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [
    { id: 'team', label: 'Team', icon: '⌂', summaryKind: 'children',
      color: { light: { fill: '#475569', border: '#1E293B' }, dark: { fill: '#94A3B8', border: '#475569' } }, size: { r: 18 } },
    { id: 'service', label: 'Service', icon: '◆',
      color: { light: { fill: '#0F766E', border: '#134E4A' }, dark: { fill: '#2DD4BF', border: '#0F766E' } } },
  ],
  edgeTypes: [
    { id: 'owns', sourceValue: 'service', targetValue: 'team', relation: 'containment' },
    { id: 'calls', sourceValue: 'service', targetValue: 'service', relation: 'dependency',
      style: { color: { light: '#0F766E', dark: '#5EEAD4' }, width: 1.5 } },
  ],
})

const nodes: GraphNode[] = [
  { id: 'payments', name: 'Payments', values: { kind: 'team' } },
  { id: 'checkout', name: 'Checkout', values: { kind: 'service' }, parentId: 'payments' },
  { id: 'ledger', name: 'Ledger', values: { kind: 'service' }, parentId: 'payments' },
]
const graph: Graph = {
  nodes,
  edges: [{ id: 'checkout→ledger', sourceId: 'checkout', targetId: 'ledger' }],
}

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <GraphView graph={graph} taxonomy={taxonomy} />
    </div>
  )
}
```

The containment edges from each service to its team are derived from
`parentId`; the edge between the services is a dependency unless it says
otherwise, and is classified as `'calls'` because that is the one declared type
between two services; the filter axis is the style axis unless others are
declared; the filter, the locks, the axes shown, the search, the theme, the
selection and the tuning are the view's own until the host asks for them.

## The taxonomy

`createTaxonomy(spec: TaxonomySpec): Taxonomy`. An incoherent spec — a value
declared twice, an edge type between values nobody declares, a colour no reader
can parse, a band whose ends cross — is refused at construction, loudly. To
derive a variant, build one from the spec (`createTaxonomy({ ...spec, … })`),
never by spreading the built object.

- **The style axis and its values.** `styleAxis` names the axis every
  node is styled on; `styles` lists its values' styles, top of the hierarchy
  first.
  A `NodeStyle` needs its `id`, `label` and `color` (fill and border, per
  theme: hex, `rgb()` or `hsl()`); everything else has a default, and a
  value that restates one says nothing:

  | field | default |
  |---|---|
  | `abbreviation` | the label's first two characters |
  | `icon` | none |
  | `size.r` / `size.iconSize` | 12 / nine tenths of `r`, rounded, at least 9 |
  | `physics.charge` / `physics.coreRadius` | −40 r / 4 r |
  | `physics.band.y` | the value's slice of the stack, by its position in the order |
  | `physics.band.x` | 0 to 380 (`BAND_FRAME.x`) |
  | `whenHidden` | `'ascend'`: a dependency edge touching a hidden node re-points to its nearest visible ancestor; `'splice'` follows the node's own edges through |
  | `summaryKind` | `'degree'` (`→3 ←2` in the hover box); `'children'` counts what the node contains; `'none'` shows neither |
  | `ladder` | none: the value is a rung of no ladder |

  `fallbackStyle` draws a value nobody declared; `styleLabel` names the axis
  in the controls.
- **Edge types.** Each `EdgeType` has an `id`, the `sourceValue` and
  `targetValue` it runs between — a style value, several (the type runs
  between every source value and every target value), or left out for any
  declared value — its `relation` (`'containment'` or `'dependency'`), and
  optionally a `match`, values the edge itself must carry on the host's edge
  axes (a call and a signal between two services, by the edge's `kind`);
  `direction` defaults to `'directed'`, and `'undirected'` marks a
  symmetric relation: no arrowhead, a highlight from either end, and its
  own `↔n` in the hover box (a containment type is refused one);
  `label` defaults to the id, `style` (colour per theme, alpha, dash, width)
  field by field to the relation's stroke (`NEUTRAL_STROKE`, a quiet solid
  grey; `CONTAINMENT_STROKE`, the same grey faint and dashed, for a
  containment type), `physics` (a spring's strength and rest length) to a
  middling spring, `tooltip` to the label. Resolved, in `Taxonomy.edgeTypes`,
  a type carries `sources` and `targets`, every value each end claims (every
  declared value for an end left out), and `swatch`, the two halves of its
  spring-control token: each end's first value, `null` for an end left out,
  drawn as a neutral "any". Which type an edge is:
  [Classifying an edge](#classifying-an-edge).
- **Filter axes.** `filterAxes` defaults to the style axis as an
  allow-list. Each `AxisDescriptor` is an `id`, a `label` (default the id)
  and what an empty selection means: `'none'` (an allow-list: nothing selected
  shows nothing) or `'all'` (a narrowing axis: nothing selected shows
  everything). The policies follow — a node with no value on the axis
  (`absentMeans`), how a focus widens it (`widens`: `'always'`, or `'whenActive'`
  — only while a selection is active), whether a change keeps the camera
  (`keepCamera`: a narrowing axis does, an allow-list refits) — and may be
  overridden. `chipsFor(values)` groups values into chips (default one per
  value; on the style axis they wear the value's icon and tint; a chip none
  of whose values the data presents is not offered), `order` lists the
  values `chipsFor` receives first, in its order, the rest after them in
  first-encounter order (default: the `styles` order on the style axis;
  elsewhere, first encounter alone), `labelFor`,
  `abbreviationFor`, `iconFor` and `tooltipFor` name and adorn values
  (defaults: the style's names and icon on the style axis, the value itself
  and no icon elsewhere, the abbreviation from the label, no tooltip),
  `initialSelection(values)` is the first open's selection (default every
  value on an allow-list, none on a narrowing axis), `presentation` is
  `'chip'` or `'tag'`.
- **Scalars and hooks.** `scalars` adds computed axes (`id`, `label` and
  `tooltip` — defaults the id and the label — and `compute(graph)` answering a
  number per node; `normalize` maps
  the answers onto [0, 1]: `'max'` divides by the largest and refuses a
  negative, `'range'` puts the smallest at 0 and the largest at 1, `'none'`
  trusts them) to the built-in
  reach, degree and depth. `contextLine(node, parent)` is the hover box's
  line or lines under the name, text or elements (default the parent's
  name); `searchText(node)` is
  what the search matches on (default the name); `highlight(active, base,
  graph, direction)` may widen or replace the transitive walk; `collapse(kept,
  candidate)` picks which of two graduated edges on one visible pair survives.
  Every hook is handed the host's own node objects, never the view's copies,
  so a host may key them by identity.

### Classifying an edge

An edge is classified once, on the style values of its original endpoints,
and keeps its type when graduation re-points it (see Collapse rules). Each
step narrows the types the one before it left:

| Step | Leaves |
|---|---|
| relation | the types of the edge's relation |
| pair | those running between its endpoints' values, either way round, whose `match` (if any) the edge's `values` satisfy |
| ends named | those naming both ends, else one, else neither |
| `match` | those declaring a `match`, else those declaring none |
| orientation | those declared in the edge's direction, else the reverse |
| declaration order | the first declared |
| `classifyEdge(edge, sourceValue, targetValue, declared)` | its answer: an id replaces `declared`, `null` leaves the edge untyped, undefined keeps `declared` |

Two types on one pair naming as many ends, in the same orientation, with the
same `match`, are refused at construction unless the host gives
`classifyEdge`. An untyped edge draws in its relation's stroke, springs
with the middling spring, tuned on its relation's "untyped" token in the
spring map, and `validateGraph` says so.

## The graph

`Graph` is `nodes` (an array, in layout order; the view indexes it, and
`nodesById` does the same for a host) and `edges`. Both carry `values`, a map
from axis to value, and an opaque `payload` the view never reads
(`payloadString` and `payloadNumber` read it for you). Ids are opaque: the
engine compares them and never parses one.

- **Containment is a tree.** A node's `parentId` names its container; the view
  derives the containment edge from it. `validateGraph` names a cycle of
  parents (`parent-cycle`), and the view clears the parent of its first node
  in graph order. An entity that sits in two containers is two nodes sharing
  a `copyKey`: the library indexes the copies (`copyGroups`), draws their halo
  and counts them in the hover box. A host may list containment edges of its
  own between any two nodes.
- **An edge's `relation`** is `'containment'` or `'dependency'` (the default;
  `isContainment(edge)` reads it). A containment edge from a node to its
  `parentId` is derived; one a host lists itself, to any node, is drawn in
  the containment stroke and sprung as its type says, but never walked as
  the parent, and
  `validateGraph` names one that contradicts `parentId`. A host adds axes of
  its own to edges and nodes alike through `values`; any axis the nodes
  carry can be pushed, pulled and laid out on.
- **Adornments.** A node may carry `badges` (short texts drawn as chips above
  it) and a `ring` (`'dashed'`, for a node set apart). An edge may carry a
  `weight`, 0..1, which widens its stroke up to double; the spring does not
  read it.
- **Identity.** Keep one `graph` object until something in it changes: a new
  object equal to the last rebuilds the layout for nothing, and the view says
  so once. The same for the taxonomy — build it once, outside render; the
  view warns when its identity churns. The filter, locks and axes are
  compared by content, so a host may rebuild those each render. A changed
  graph keeps the positions of the nodes it still has.
- **Validation.** `validateGraph(graph, taxonomy)` names every defect — a
  dangling endpoint, an unknown relation, a type the rule returns that the
  table lacks, a duplicate node or edge id, a parent not in the graph, a
  weight outside 0..1 or not finite (`'edge-weight-invalid'`, a warning: the
  view clamps it, and draws one not finite as no weight). The
  view runs it, lists the diagnostics under the bar, hands them to
  `onDiagnostics` and draws what remains — adding three warnings of its own:
  `'containment-untyped'`, when a containment edge it derived from `parentId`
  has no declared type, `'key-undeclared'`, once per key a derived
  group's `of` answers that its `keys` do not declare, and
  `'key-color-invalid'`, once per group or key whose `color` is not hex,
  `rgb()` or `hsl()`, which takes a palette colour instead. A host that wants
  to refuse a bad graph calls it first.

## The view

`GraphView` needs the `graph`, a taxonomy (the `taxonomy` prop, or a
`TaxonomyContext.Provider` above; `useTaxonomy()` reads it in a host's own
component inside the pane), and a parent with a height: a flex column (the
pane takes the remaining space) or a block with a height (the pane fills it).
A parent with no height gives the pane none, and the pane says so once on
the console. Everything else is optional.

- **State.** The filter, the locks, the axes shown, the search control
  (`{ query, active }`), the theme choice, the selection and the tuning each
  follow the React convention: pass the value and its callback to control it,
  neither to let the view keep it, the callback alone to be told; and each
  has a `default*` prop for where the view's own starts (`defaultFilter`,
  `defaultLocks`, `defaultAxes`, `defaultSearch`, `defaultTheme`,
  `defaultSelectedId`, `defaultTuning`), read once. A controlled value is the
  host's: the view never rewrites it, and warns once if the prop flips
  between defined and undefined. `initialFilter(taxonomy, graph)` is the
  filter the view starts from — an `initialSelection` that splits a chip is
  snapped to the whole chip, with a warning. `reseedFilter(filter, taxonomy,
  graph, touched)` is what the view does to its own filter when the graph
  changes — every axis the user has not touched takes the new graph's
  opening selection — for a host that controls the filter to call from its
  own data effect; `onFilterChange(next, touched)` names the axes the user
  changed in each write, so the host can keep that set. A host that writes
  only one axis need not control the filter: the handle's `updateFilter`
  writes it, and the view keeps re-seeding the rest.
- **Save and restore.** An axis's selection is a set, "only these", or
  `{ except }`, "all but these". An allow-list opens as an exclusion and the
  bar keeps an axis's kind, so a value the data gains after a chip was turned
  off shows; a set the host writes stays exactly its values. `filterToJSON`
  / `filterFromJSON` and `locksToJSON` / `locksFromJSON` carry a filter and
  its locks to a URL or a store and back, and a restored filter is the
  user's on every axis where it differs from the opening one. Which groups
  are shown rides along as the `GROUPS` entry, `'@groups'`, an exclusion
  of the groups turned off:

  ```tsx
  localStorage.setItem('filter', JSON.stringify(filterToJSON(filter)))
  // { "team": { "except": ["ops"] }, "region": ["north"], "@groups": { "except": ["cs"] } }
  const saved = filterFromJSON(JSON.parse(localStorage.getItem('filter') ?? 'null'))
  <GraphView graph={graph} taxonomy={taxonomy} defaultFilter={saved} />
  ```
- **Selection and focus.** `selectedId` controls the selection: while it is
  defined the view shows it and nothing else, `onSelectionChange` reports the
  selections the user makes (never one the host made), and the host answers
  by setting the prop, or not. Absent, the view keeps the selection and still
  reports. `focus={{ id, key }}` reveals, centres and selects a node — the
  declarative form of the handle's `focusNode`, for a pane that mounts lazily
  or whose data arrives late. It is compared by value, so a new `id` or `key`
  is a new request; it waits until its node is in the graph; and
  `onFocusResult(request, shown)` says whether the filter could show the
  node. Null, or a newer request, withdraws a waiting one unreported.
  `useFocusRequest()` gives a host the request and a `requestFocus(id)` that
  makes each ask new.
- **Tuning.** `tuning` is the forces and the node scale as the user set
  them: which axis push and pull key on and the buckets they changed, the
  two layout axes (an axis's bands, or a computed scalar's span), the
  multipliers, gravities and dynamics. `onTuningChange` hears every change —
  the control panel's and the view's own retune for a new graph or taxonomy
  (a tuning on an axis the graph no longer carries returns to the style
  axis). The `Tuning` itself is opaque: keep it and hand it back.
  `createTuning(json, taxonomy)` is how a host writes one: the JSON form
  (`TuningJSON`) fills whatever it leaves out from the taxonomy's defaults,
  so `createTuning({}, taxonomy)` is the default tuning, and
  `defaultTuning={createTuning({ forces: { bandY: { scalar: 'credits' } } },
  taxonomy)}` opens the view laid out on a scalar. It throws on a mistake
  and names its path (`forces.bandY.scalar: no scalar "credit"`).
  `tuningToJSON(tuning)` carries a tuning to a store and
  `tuningFromJSON(json, taxonomy)` back, answering undefined, never a throw,
  for stored data that is not its shape.
- **Inputs.** `counts` (chip badges; the graph's entity counts unless given,
  the copies of one `copyKey` once; `'faceted'` counts each axis under the
  other axes' selections),
  `findings` under the bar, `groups` to glow (derived from the data as
  `{ keys, of }` — the `LegendKey`s, `{ id, label, color?, weight? }`, and a
  function answering each node's keys — or listed as `NodeGroup`s, each an id
  and the node ids it covers; membership is settled once per graph and
  groups, a `color` is one string for both themes or a `ThemedHue`,
  `{ light, dark }`, a key or group with none takes a palette slot no earlier group
  joined to it by an edge holds, so a filter that hides one recolours no
  other, and `weight`, 0..1, swells its glow, up to double; the filter's
  `GROUPS` entry hides a group's glow and every node no shown group holds, a
  node in no group always passing, and `passesGroups(filter, groupIds)`
  judges one), `groupCohesion`
  (a multiplier, default 1, on the stiffness of every edge whose ends share a
  visible group, so members drift together), `groupsControl` for a legend
  inside the pane (anchor it under `--gv-toolbar-height`), handed the groups
  as drawn and a `GroupsControl` — `shown(id)`, `toggle(id)` while the filter
  is writable, which writes `GROUPS` as the bar writes an axis, and
  `emphasize(id | null)`; `GroupLegend` is one — `items`, the `active`
  groups and the `control`), `markedEdges` (edge ids drawn with a dashed
  band behind their stroke, a graduated edge when the edge it stands for
  is), a `nodeAction`
  for the hover box (`{ label, onSelect }`, or a function of the node
  answering one or null), `chrome` to turn parts of
  the pane off — `controls` (the control panel), `themeToggle` (the theme
  button), `search`, `locks` (the lock toggles; off until the host controls
  `locks` with `onLocksChange`), `transport` (the Fit / theme / Play / count
  cluster, which takes the theme button with it), `diagnostics`,
  `shortcuts`, `directionLine` (the hover box's) and `activateZoom` (the
  double-click zoom) — `searchTitle` and `searchPlaceholder` for the host's
  own words, `systemTheme` (what `'system'` means, for a host that knows its
  own theme), `className`, `style`, and `defaultPositions` (kept positions,
  read whenever the simulation is built; a node the live layout already
  holds keeps its place).
- **Outputs.** `onSelectionChange(node | null)`, `onNodeActivate(node)` on a
  double-click, `onHover(node | null)`, `onThemeResolved(theme)`,
  `onDiagnostics(diagnostics)` whenever the graph's defects are recomputed
  (the first graph's included), `onTuningChange(tuning)`,
  `onSettled(positions)` each time the simulation comes to rest on its own
  (not on a pause). Every node handed out is the host's own object. The
  resolved theme is for the host's own chrome beside the pane; a host that
  writes it as a `data-theme` on an ancestor of the pane passes `systemTheme`
  too, so `'system'` follows the host's answer and not the pane's own echo.
- **The handle.** Through a ref, `focusNode(id)` reveals, centres and selects
  a node in one call — it widens the filter on the axes shown and the groups
  it belongs to when the group filter hides it, flashes a lock
  it overrides, and centres once the layout has settled — and answers
  whether the node ended visible (a value absent on a hiding axis cannot be
  revealed); `select(id | null)` sets or clears the selection; `fit()` frames
  the visible set; `getPositions()` and `setPositions()` carry a layout out
  and back in, as `onSettled` and `defaultPositions` do across a reload;
  `updateFilter(fn)` rewrites the filter, the axes `fn` changes counting as
  the user's.
- **What to know.** The view's own filter re-seeds on a graph change for
  every axis the user has not touched — a controlled filter never does — and
  `onFilterChange` hears it. `onHover(null)` arrives 150 ms after the pointer
  leaves, so a tooltip can be reached. Removing an axis in the bar resets its
  selection to "match everything" and fires `onFilterChange` before
  `onAxesChange`; an axis the taxonomy does not declare renders as a header
  with its remove control and filters nothing. Derived containment edges are
  `in:<id>` (numbered on a collision) and reach `highlight` and `collapse`.
  An error diagnostic drops the edge, or the later node of a duplicated id,
  or clears the `parentId`, it names. The pane's theme observer watches every
  `data-theme` in the document unless `systemTheme` is given.
- **Keyboard.** `keyboard` scopes the shortcuts: `'pane'` (the default — the
  focusable root handles the keys that reach it, so a page keeps Tab and
  Space for its own controls), `'global'` (the window — a page that is the
  pane, or a tab shell's active tab) or `'none'` (a hidden tab). The keys are
  [SPEC § Keyboard](SPEC.md#keyboard).

## Two views sharing a bar

A host with a second view gives both views one state through `useLinkedViews`
and renders `FilterBar` in the view that is not a `GraphView`. The hook owns
each view's filter, locks and axes, the view shown and the search they share,
hands each view its props, reconciles on a switch, records the locks a focus
overrode so the bar flashes them, and asks the graph view to centre on a node
a focus names:

```tsx
import React from 'react'
import { FilterBar, GraphView, passesSelection, useLinkedViews } from '@jmbarzee/force-graph'
import type { Graph, Taxonomy } from '@jmbarzee/force-graph'

export function TwoViews({ taxonomy, graph }: { taxonomy: Taxonomy; graph: Graph }) {
  const linked = useLinkedViews({ taxonomy, views: ['list', 'graph'], graph: { list: graph, graph } })
  const list = linked.of('list')
  const shown = graph.nodes.filter(node => passesSelection({ filter: list.filter, taxonomy, axes: list.axes, node }))
  // `linked.focus` switches to the view, widens its filter to show the node
  // and, for the graph view, asks it to centre on and select the node.
  return linked.active === 'graph'
    ? <GraphView graph={graph} taxonomy={taxonomy} {...linked.of('graph')} nodeAction={{ label: 'Show in list', onSelect: node => linked.focus('list', node) }} />
    : (
      <div>
        <FilterBar taxonomy={taxonomy} graph={graph} {...list} records={graph.nodes} matches={(n, query) => n.name.includes(query)} />
        <ul>{shown.map(n => <li key={n.id} onDoubleClick={() => linked.focus('graph', n)}>{n.name}</li>)}</ul>
      </div>
    )
}
```

`linked.of(view)` is the view's `filter`, `locks`, `axes`, their callbacks,
`overriddenLocks`, the shared `search` with its callback, and the `focus` the
last `linked.focus` asked of it with `onFocusResult` (a `FilterBar` ignores
those two); it throws for a view the hook was not given (`views` is read
once). `linked.active` is the view shown.
`linked.switchTo(to, transition?)` switches from the active view and makes
`to` active, reconciling as [SPEC § Linked views](SPEC.md#linked-views) says
(a manual switch is the default). `linked.focus(view, target)` is the focus
switch and the request in one, for a node or a `FocusTarget` — the values a
record of the host's names, which `matchesFocus(record, target)` finds.
`linked.updateFilter(view, fn)` rewrites one view's filter and
`linked.updateFilters(fn)` every view's (a stale value pruned when the data
changes — `reseedFilter` is the rule the hook itself applies to a view when
its `graph` changes, on the axes the user has not touched); `linked.state`,
`linked.active` and `linked.search` are everything,
for a host that persists them. The bar carries its own theme and scheme
(`theme`, default `'system'`; `systemTheme` says what that means), so it needs
no wrapper; give it the `graph` (or the `values` per axis — `valuesOn(records,
axis)` reads them off any subjects carrying `values`) and, if the host reads
its own data, the `counts` (or `'faceted'`, with the `graph`). Given every
record the view holds as `records` and `matches(record, query)`, the bar
badges each chip with the search matches it hides and the search with their
"+N". A shown bar binds `/` to its search while focus is not in an editable
field; a host that binds its own
passes `searchInputRef`. The lock toggles appear only when `locks` is
controlled with its callback — `useLinkedViews` does — or `chrome.locks` asks.
The bar tracks the values that just turned on for its chip flash
(`RecentlyChanged`, a set per axis); a host with its own rule passes
`recentlyChanged`. `refreshFlash` flashes the bar each time the host bumps
it.

What the pane computes for its own bar is exported for the second view:
`passesSelection({ filter, taxonomy, axes, node })` decides visibility on the
axes the view shows (`valueOn(node, axis)` for a record that carries its
values under other names), `countsOn(nodes, axes, { filter, taxonomy })`
the badges (without the third argument, unfaceted),
`hiddenMatchesOf({ nodes, filter, taxonomy, axes, visibleIds, matches })` the
search's hidden-match badges. `reconcileFilter({ destination, source, locks,
transition, taxonomy, axes, graph })` is the switch the hook makes; `axes`
are ids, and with the `graph` a focus widens to the whole chip holding its
target's value. `selectionFor`, `withSelection`, `withLock`, `toggleGroup` and
`filterStatesEqual` are the filter operations the bar itself uses;
`toggleValue` flips one value for a host's own control. A focus into the graph
is `focusNode(id)` or the `focus` prop.

## Theming

The pane resolves its theme from its own choice (Auto / Light / Dark) or, for
`'system'`, from `systemTheme` when the host gives it, else the nearest
ancestor's `data-theme` and then the OS — `useHostTheme(ref)` is that same
read, for a host's own chrome, and `themeChoiceOf(value)` reads a stored
choice back (`'system'` for anything else). A server render knows neither
ancestors nor OS, so a server-rendered pane paints light until it hydrates; a
host that wants no flash resolves the theme on the server (a cookie, say) and
passes `systemTheme`.

The pane and the bar mark the theme they resolved as `data-gv-theme` on their
own roots, and declare their tokens there, not on `:root`; the bar inside a
pane takes the pane's. Every rule in the
stylesheet sits in `@layer gv`, so a host's unlayered rule wins whatever its
specificity: a host restyles the pane by redeclaring a token on its root,
through the `className` it passes or an ancestor, and in one theme only by
naming its `data-gv-theme`:

```css
.my-pane { --gv-accent: #0f766e; }                          /* className="my-pane": both themes */
.host [data-gv-theme="dark"] { --gv-color-surface: #111; }  /* an ancestor: dark only */
```

| Token | Role | Light | Dark |
|---|---|---|---|
| `--gv-color-surface` | Panels, the bar, tooltips | `#ffffff` | `#252526` |
| `--gv-color-bg` | Canvas background | `#f8fafc` | `#1e1e1e` |
| `--gv-color-text` | Text | `#1e293b` | `#d4d4d4` |
| `--gv-color-text-muted` | Muted text | `#64748b` | `#9ca3af` |
| `--gv-color-border` | Borders | `#e2e8f0` | `#3c3c3c` |
| `--gv-accent` | Accent | `#8B7EC8` | `#A89BD8` |
| `--gv-focus-ring-color` | Focus ring | `#4A90D9` | `#6CB0F0` |
| `--gv-selection-ring-color` | Selected node's ring | `#ffffff` | `#ffffff` |
| `--gv-color-graph-label` | Node labels | `#334155` | `#cbd5e1` |
| `--gv-badge-fill` | Node badge fill | `#7C3AED` | `#7C3AED` |
| `--gv-badge-text` | Node badge text | `#ffffff` | `#ffffff` |
| `--gv-on-accent` | On the accent: the switch's knob | `#ffffff` | `#ffffff` |
| `--gv-color-attention` | An overridden lock, a search's hidden matches | `#F59E0B` | `#F59E0B` |
| `--gv-panel-shadow` | Panels' shadow | `0 2px 8px rgba(0, 0, 0, 0.1)` | `0 2px 8px rgba(0, 0, 0, 0.4)` |
| `--gv-bar-shadow` | The bar's shadow | `0 1px 4px rgba(0, 0, 0, 0.06)` | `0 1px 4px rgba(0, 0, 0, 0.3)` |
| `--gv-font-sans` | Sans font | `inherit` | `inherit` |
| `--gv-font-mono` | Mono font | `inherit` | `inherit` |
| `--gv-radius` | Corner radius | `6px` | `6px` |

Every colour the stylesheet draws is a token: `make check` refuses a hex,
`rgb()` or `hsl()` literal in it outside `tokens.css`. A brand applied to both
themes in a host's own CSS is [`examples/branded/`](examples/branded/).

The typed path produces the same variables: `createTheme({ light, dark })`
takes, per theme, the tokens to override, each by its role — the token
without `--gv-`, camel-cased (`--gv-focus-ring-color` → `focusRingColor`) —
and refuses an unknown role at compile time. `GraphView` and `FilterBar` take
its result as `tokens` and carry the resolved theme's on their roots:

```tsx
const tokens = createTheme({ light: { accent: '#0f766e' }, dark: { colorSurface: '#111' } })
<GraphView graph={graph} tokens={tokens} />
```

A host's own chrome takes the same scope from `useScheme(taxonomy, { choice?,
systemTheme?, tokens? })`: its `theme`, and `scopeProps` — `data-gv-theme`
and a `style` with the scheme's colours and `tokens` — to spread on the
chrome's root, which then reads the tokens above. `system` resolves from
`systemTheme`, else `<html>`'s `data-theme`, else the OS, in a layout effect,
so a dark host's chrome never paints light:

```tsx
const { scopeProps } = useScheme(taxonomy, { choice, tokens })
<aside {...scopeProps}>…</aside>
```

Every class is `gv-*`. Each style value's fill and border are
published on the pane under the name `taxonomy.colorVar(value)` answers —
`--gv-node-` and the value id in kebab case (a value id such as
`teachingLab` → `--gv-node-teaching-lab`), or a numbered name when the id kebab-cases to
nothing or to another value's — and `-border` for the border. A host's own
chrome beside the pane reads the same tints through `useScheme`, or
`schemeStylesheet(taxonomy, darkSelector?)` mounted once (its dark block under
`[data-theme="dark"]`, or the host's own selector). Default rest
bands are laid in `BAND_FRAME` (world units: the hierarchy axis from −300 to
400, x from 0 to 380); a band a host declares is read in the same units.

## Collapse rules

A dependency edge whose end is hidden is **graduated**: re-pointed to the
nearest visible ancestor (`'ascend'`) or followed through the hidden node's own
edges (`'splice'`). Two graduated edges landing on one visible pair collapse to
one, the host's `collapse` hook choosing which original it stands for; an
original edge between two visible nodes stands for every projection landing
on its pair; two original edges between visible nodes never collapse, and
draw in lanes.

## Limits

The charge force is O(n²) over the visible nodes: a few hundred draw
smoothly, a few thousand do not (Barnes-Hut,
[#30](https://github.com/jmbarzee/force-graph/issues/30)). The push/pull and
layout controls bound their tokens by a ceiling
([SPEC § The control panel](SPEC.md#the-control-panel)).
What is not built is filed as issues:

- **The graph and taxonomy** — colour by another axis
  ([#9](https://github.com/jmbarzee/force-graph/issues/9)), an opaque
  `Taxonomy` ([#10](https://github.com/jmbarzee/force-graph/issues/10)),
  undirected edges ([#11](https://github.com/jmbarzee/force-graph/issues/11)),
  an edge time series played back
  ([#33](https://github.com/jmbarzee/force-graph/issues/33)), host-declared
  pair-axis mappings ([#32](https://github.com/jmbarzee/force-graph/issues/32)),
  a node drawn as a stack of ghosts
  ([#19](https://github.com/jmbarzee/force-graph/issues/19)).
- **Interaction** — selecting several nodes
  ([#28](https://github.com/jmbarzee/force-graph/issues/28)), edge hover and
  its outputs ([#16](https://github.com/jmbarzee/force-graph/issues/16)), a
  focus that frames the neighbourhood
  ([#21](https://github.com/jmbarzee/force-graph/issues/21)), a neighbourhood
  frame that leaves hidden neighbours out
  ([#26](https://github.com/jmbarzee/force-graph/issues/26)), the keyboard and
  accessibility model ([#7](https://github.com/jmbarzee/force-graph/issues/7)),
  positions, viewport and selection kept across a live reload
  ([#5](https://github.com/jmbarzee/force-graph/issues/5)), animated reveals
  ([#8](https://github.com/jmbarzee/force-graph/issues/8)), an empty state
  when the filter hides every node
  ([#6](https://github.com/jmbarzee/force-graph/issues/6)).
- **The control panel** — named presets
  ([#29](https://github.com/jmbarzee/force-graph/issues/29)).
- **The package** — the pane's strings in other languages
  ([#13](https://github.com/jmbarzee/force-graph/issues/13)), the React 19
  types gate ([#14](https://github.com/jmbarzee/force-graph/issues/14)).

`src/index.ts` names the whole surface.
