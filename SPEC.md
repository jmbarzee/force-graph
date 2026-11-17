# force-graph — the view

What the pane shows and how it behaves for the person using it. The
[README](README.md) is the host's contract and names every prop and hook used
here; [DESIGN](DESIGN.md) holds the invariants and why. Examples are the
[course catalog](examples/course-catalog/).

The filter is the source of truth: search, hover, halos and glow work on what
is visible and never reveal a hidden node; a focus that must reveal one widens
the filter visibly.

## Layout

The layout is a force simulation: each tick the forces move the visible nodes,
the energy (alpha) cools, and ticking pauses below a threshold.

| Force | Acts on | Behaviour |
|---|---|---|
| Push | every pair of visible nodes | `F = charge / (d² + r²)^exp`, a charge and a core radius `r` per bucket of the push axis |
| Pull | every sprung edge | `F = α × stiffness × Δ^exp / d`, `Δ = d − length` (signed), a stiffness and a rest length per spring category; `groupCohesion` multiplies the stiffness of an edge whose ends share a visible group |
| Band | every node, on X and on Y | none inside its rest band; outside it, `strength × dᵉˣᵖ` back toward it |
| Topological | every node | an inward pull scaled by reach, the depth of its dependency chain, propagated up containment so no node is pulled above its container |
| Center | every node | a pull to the origin, only while no band axis and no topological pull acts |

- **Push and pull key on one axis**, the push axis: the style axis unless the
  user picks another the nodes carry, or one of the host's `pairMappings`,
  which buckets an axis's values as the host declares. On the style axis a
  bucket starts from the mean of its values' declared physics, its own
  value's when bucketed by identity; on any other axis, from the taxonomy's
  typical physics. The spring categories are the declared edge types only on
  the style axis bucketed by identity; otherwise there is one per unordered
  bucket pair per relation. A sprung edge is an original edge with
  both ends visible; a graduated edge is drawn and never sprung.
- **Two layout axes**, X and Y, each keyed on a node axis — every bucket rests
  in a band — or on a computed scalar, read across a span from where 0 rests to
  where 1 rests (built in: reach, degree, depth; the catalog adds credits and
  level). A strength of zero turns an axis off; a node with no value on it
  rests at its centre. A filter change moves no band.
- **Radial**, a switch on Y: Y's buckets become rings about the origin, the
  lowest innermost; X is ignored; the topological pull draws to the centre
  instead of the top. Charge spreads a ring's nodes; nothing acts on angle.
- **Seeding.** A node starts inside its bands, low in its Y band and at its
  parent's X (in radial, on its ring near its parent's angle). A node with a
  kept position (`defaultPositions`, or the last graph's layout) starts there.
  A changed graph keeps the camera and the tuning.
- **Reheat.** A changed graph, a filter change, a force edit, a changed
  `groupCohesion` and a dragged node each re-energise the layout; there is no
  Reheat button. A node scaling edit only redraws.

## Which nodes are visible

A node is visible when it passes every filter axis shown, each by its own
`emptyMeans` and `absentMeans`. In the catalog, Show is an allow-list (no chip
on shows nothing) and Campus narrows (no chip on shows every campus;
faculties and departments carry no campus and always show).

Edges follow the visible set ([README § Collapse rules](README.md#collapse-rules)):
a dependency edge with a hidden end graduates, and a containment edge skips
hidden tiers, attaching a visible child to its nearest visible ancestor —
with departments hidden, courses cluster round their faculty. A hidden
child's containment edge is dropped.

A filter that hides every node of a graph that has some says so, centred in
the canvas below the overlay: "No nodes match the filter." An empty graph
draws no line; it is the host's to explain.

## Revealing a bucket

Revealing a bucket opens its containers: each revealed node starts at its
nearest visible ancestor, snapped onto the edge of its own band (in radial, on
its own ring at the ancestor's angle), and the layout spreads it from there —
showing labs while courses are visible, each lab emerges from its course.
An axis that refits (`keepCamera` off, an allow-list's default) seeds this
way; one that keeps the camera reheats in place. The fades and force ramps
that would animate a reveal or a hide are
[#8](https://github.com/jmbarzee/force-graph/issues/8).

## Viewport

| Input | Action |
|---|---|
| Scroll or pinch | Zoom about the pointer, 0.1× to 40×; the page behind never scrolls |
| Drag the background | Pan |
| Drag a node | Move it, held in place until release; the layout reheats around it |
| Click a node / the background | Select it / clear the selection |
| Double-click a node | Frame it and its neighbours (`chrome.activateZoom`), and `onNodeActivate` |
| Double-click the background | Frame the visible set |

**Fit** (the button, `fit()`) frames every visible node. A layout that
follows a drawing of no node — the first, or a graph after an empty one — is
framed from when its warm-up cools until it settles, and so is a refitting
filter change; a pan, zoom, drag or newer frame lets go at once. Any other new
graph keeps the viewport, and a frame still holding carries on over the nodes
it names that the new graph draws.
Every frame lands in the canvas below the filter bar.
Resizing the pane keeps
the world point at its centre fixed.

## The pane's chrome

The filter bar floats over the top of the canvas, which fills the pane behind
it: translucent, blurred and capped in height, its controls alone taking the
pointer, so zoomed content bleeds visibly under it. The bar is one row of chips
per axis shown, each with its lock and a `×` on hover that removes it; a `+`
adds a declared axis not shown; then the search. The host's `findings` fill a
slot at its bottom, and the bar can flash on a host's refresh. A host's
`groupsControl` anchors under it, at `--gv-toolbar-height`; a `GroupLegend`
ends above the pane's foot, its items scrolling under the host's controls.

An axis whose chips overflow its row shows the row and a count of the rest;
the count opens it and **Less** closes it. Every axis starts closed, and which
are open is not remembered. A change to an axis's selection from outside the
bar — a focus, a view switch, the host — opens it, so the chips that turned on
are in view when they flash; so does the keyboard reaching a chip past the row.
A click in the bar leaves its axis as the user has it, and a re-seed — the pane
following new values on the axis as the host's graph arrives or changes —
leaves it as it is.

At the bottom, out of the bar's way:

- **bottom left** — `N nodes, M edges`, the visible and graduated set, moved
  aside while the shortcuts panel is open;
- **bottom centre** — Fit; the theme button, cycling Auto → Light → Dark
  ([README § Theming](README.md#theming) says how Auto resolves); Play / Pause;
  and the frame rate while the simulation runs;
- **bottom right** — the control panel.

`chrome` turns each part off.

## The control panel

Collapsed by default behind **Controls**. Three tabs — **Push/Pull**,
**Gravity**, **Misc** — one shown at a time, in a body sized to the tallest so
switching never resizes the panel. A force tab shows its equation in a card,
then the controls for every term in it; hovering a symbol in the equation
lights the global slider it names. Every control is live.

**Presets** sit above the tabs, a dropdown styled as the axis dropdowns:
the library's `TUNING_PRESETS` (Balanced, Tight clusters, Spread out, Free
form, Rings), or a host's own through `presets` — beside them, in place of
them, or `[]` for no row. Choosing one carries every control to its values
over 400 ms, ease-out (at once under `prefers-reduced-motion`), the axes
and switches on the first frame; any other edit stops it. What a preset
leaves out returns to its default, except the node scale, kept unless it
names one. The dropdown shows the preset the tuning is, else `custom`. A
preset naming an axis or scalar the taxonomy lacks is listed disabled with
why, as an axis past the ceiling is, and said once on the console.

**A control offers what the visible set holds**: a push token per bucket a
visible node falls in, a pull token per spring category a sprung edge falls in,
a column per bucket on each layout axis. Hiding a chip removes its tokens and
keeps their tuning for when they return. A push or pull map, or a layout axis's
band plot, that the visible set leaves empty gives way to one line, "Nothing
visible on this axis — turn a chip on.", and a push or pull map's curves to
their `exp` slider; the equation and every slider stay. When the legend's
groups hide every node, chips or no, the line is "Nothing visible — turn a
group on in the legend." instead. The axis dropdowns
alone measure the whole graph, so an axis's availability never flips with a
filter.

**The token ceiling is 24** push tokens and 24 pull tokens. The push axis
dropdown shows an axis's push and pull token counts beside its name, a layout
axis dropdown its column count; an axis past the ceiling is listed
disabled with the count that disqualifies it. Switching axes starts
from the declared or typical physics on the new buckets. The push axis
dropdown lists the style axis, then the host's pair mappings, then each axis
bucketed by its observed values; the layout axis dropdowns list no host
mapping. When the graph changes, an axis bucketed by observed values is
rebuilt and keeps the tuning of the values that survive, and a host mapping
keeps all of its; an axis that vanishes or outgrows the ceiling, or a mapping
a new taxonomy drops, returns the forces to the style axis, said once on the
console.

### Push/Pull

The push axis dropdown sits above both sub-tabs. Each sub-tab is its equation,
a 2D map and a curve:

- **Push map** — y is charge magnitude (0 to 1000), x is core radius (0 to
  100). One solid token per bucket; dragging it sets both values. Tokens that
  coincide, as every bucket does on a freshly picked axis, fan out on a small
  ring; a drag still writes the token's own value. The `push` and
  `coreRadiusMultiplier` sliders run along the axes they scale. On the style
  axis, two or more shown rungs of a ladder (values sharing a `ladder` id) are
  joined by a faint line in declaration order; its toggle under the map
  collapses them to one ringed token at their centroid, which moves every shown
  rung alike, as far as all stay in range, and links no hover.
- **Push curve** — each bucket's falloff against distance, its core radius
  marked; the `exp` slider (0.5 to 1.0, default 0.7) beneath.
- **Pull map** — x is rest length, y is stiffness. One token per spring
  category some edge falls in, split into its two buckets' colours, its outline
  dashed for containment and solid for dependency. The stiffness and length
  sliders run along the axes they scale.
- **Pull curve** — each spring's response around its rest length; the `exp`
  slider beneath.

On the style axis a token or a column wears its value's `--gv-node-*` colour; on any other
axis, one neutral tone until colour by another axis lands
([#9](https://github.com/jmbarzee/force-graph/issues/9)). Hovering a token
brightens its curve and dims the rest, and the reverse.

### Gravity

Sub-tabs **X Axis**, **Y Axis** (carrying the Radial switch) and
**Topological**. Each force is off at a strength of 0, with no switch of its
own. The Radial switch never changes which body shows.

- **X Axis / Y Axis** — `F = strength × dᵉˣᵖ`, an axis dropdown (a node axis
  within the ceiling, or a scalar), a plot with one column per bucket and its
  rest band drawn as a stripe with two drag handles, the axis's strength
  slider, its response curve (normalised to the stronger axis) and the `exp`
  slider shared by both axes. On a scalar axis the plot is a gradient whose two
  ends are the handles, and dragging them past each other flips the axis; until
  the user drags, the span follows the taxonomy. 1 sits at the top of both
  plots. On the style axis a ladder's shown rungs stand side by side on a faint
  backdrop under its id; its toggle under the plot collapses them to one
  column of their stripes, whose handles shift every min, or every max, alike,
  as far as none leaves the plot or inverts its band, and which links no hover.
  Each plot collapses on its own.
- **Topological** — `F = strength × depthᵉˣᵖ × d`, a depth-to-pull curve, and
  its strength and `exp` sliders.

A body whose force does nothing — zero strength, X in radial — stays shown,
dimmed. Center gravity has no control.

### Misc

Each section is its equation, a curve and its sliders; as on a force tab,
hovering a symbol lights the slider it names.

- **Dynamics** — `friction` (velocity damping per tick), `cooling` (energy
  lost per tick), `threshold` (the energy below which ticking pauses). The
  curve plots α against ticks, from 1 down to `threshold`, marking the tick
  the simulation stops at.
- **Node scaling** — on-screen size is `r × size × clamp(zoom, shrink floor,
  grow cap)`, defaults 0.6, 0.4 and 1.65; lowering the grow cap makes nodes
  shrink sooner as the user zooms out. The curve plots that scale against
  zoom: flat below the shrink floor and above the grow cap.

## Force-field visualisation

While a control is hovered the canvas draws what it governs, between the edges
and the nodes, and drops it when the pointer leaves. There is no toggle.

| Hovered | Canvas |
|---|---|
| Push | Charge rings round every visible node, outlines only, in its style colour, where its force falls below fixed thresholds; a threshold a charge cannot reach draws no ring |
| a push token | That bucket's rings, the rest faded |
| Pull | Every edge coloured by tension: `--gv-tension-rest` near rest length, `--gv-tension-stretch` stretched, `--gv-tension-compress` compressed |
| a pull token | That category's edges only, in a tension-coloured casing under their own stroke |
| Gravity | While an axis acts, a stripe per band some node of the whole graph falls in, median-centred like the force (in radial, a ring per Y band); a scalar axis draws one gradient stripe, and a scalar Y in radial draws nothing |
| an axis-plot column | That bucket's stripe or ring, the rest faded; a bucket no visible node falls in dims nothing |
| Misc | Nothing |

## Search

A query matches, case-insensitively, the text `searchText` gives — the name
by default. Matching visible nodes stay at full opacity and the rest dim to
20%. A match a filter hides badges the chip hiding it, on the first axis shown that it fails, and the
search control carries the total (`+N`). The dropdown lists the visible
matches; picking one centres on it and selects it.

## Hover and selection

The active node — the hovered one, else the selected one — highlights its
transitive chain over visible dependency edges, graduated ones included:
downstream by default, upstream while Shift is held. Containment is never
walked. The chain stays at full opacity, its edges and arrowheads reinforced;
everything else dims to 20% (50% while groups glow). `highlight` may widen or
replace the walk — a catalog department highlights the courses and labs it
contains and what they require.

The hover box, beside the node, holds:

1. the value's icon and the name;
2. the context line (`contextLine`; default the parent's name);
3. for a `children` value, its visible children counted per style value in
   the taxonomy's order (`1 Dp · 4 Co`);
4. the node's badges;
5. `copy N of M`, when more than one copy of it is visible;
6. its visible dependency degree (`→3 ←2`), when it has any and its
   `summaryKind` is not `none`;
7. `dependencies` or `dependents`, the walk's direction;
8. the host's `nodeAction` button.

The box stays open while the pointer travels onto it and over it, so its
button can be clicked.

The selected node wears a ring. A graph that no longer holds the view's own selection
clears it.

## Copies

When the active node has sister copies — nodes sharing its `copyKey` — every
visible one wears a halo in its own colour. A sister is not added to the
highlight: one off the chain dims with the rest, and the halo marks it.
Hovering one listing of a cross-listed course (Biochemistry, CHEM 310 and
BIOL 310) halos every listing.

## Group glow

`groups` glow behind everything else on the canvas: derived, as keys the host
declares and a function answering each node's keys, or listed, as node ids per
group. Membership is settled once per graph and groups; a key the function
answers that the keys do not declare is ignored and reported, and so is a
`color` that is not hex, `rgb()` or `hsl()`, which falls back to the palette.
Which groups are shown is the filter's `GROUPS` entry, saved and controlled
with the axes: a hidden group draws no glow and hides every node no shown
group holds, a node in no group always passing. Each visible
member gets a radial halo in its group's colour that fuses with its
neighbours' into one blob; an edge glows when both ends are in one group. A
group without a `color` takes a small cycling palette's slot, settled in list
or key order over the whole graph: its own place, or the next slot no earlier
group joined to it by an edge holds — so touching groups differ in hue while
the palette has a slot free, and hiding one group recolours no other. A
group's `weight` (0..1) swells its halo and corridor, up to double; hue and
brightness stay. A focused group — the one `emphasize` names, or the one
holding the active node — brightens and swells. In the catalog each degree
programme is a group, and its legend's checkboxes write the group filter.

## Appearance

- **Nodes.** A disc of the value's `size.r` in its fill and border for the
  resolved theme, its icon inside and its name below, in
  `--gv-color-graph-label`, semibold and slightly translucent. Names over 15
  characters show 12 and an ellipsis. Badges sit above the node; a `dashed`
  ring circles it. Size follows Node scaling.
- **Labels by density.** Below a zoom of 0.25 labels and icons hide, except
  the active node's. Above it, a label is drawn only where it overlaps no
  label already placed and no node body, greedily in node order, so a settled
  layout does not flicker; the active node always wins.
- **Detail by zoom.** Below a zoom of 0.1 the decorative rings drop. A node
  stays hoverable and clickable at every zoom.
- **Edges.** Stroked by their resolved type (`EdgeType.style`), widened by
  `weight`, up to double — a graduated edge keeps the type and weight of the
  edge it stands for. Dependency edges carry an
  8 px arrowhead toward the dependency, at every zoom; containment is
  undirected. Parallel edges between one pair draw in lanes. A `markedEdges`
  edge gets a dashed band in the label ink behind its own stroke, so it keeps
  its type's colour and dash.

## Linked views

A host with a second view links them through `useLinkedViews`
([README § Two views sharing a bar](README.md#two-views-sharing-a-bar)).

- **The search query** is shared by every view.
- **A switch reconciles.** A manual switch adopts the source view's selection
  on every axis the destination shows, except where the destination is locked;
  its group filter stays its own. A focus widens the destination only as far
  as its target needs, by each axis's `widens` and by whole chips, turns on
  every group of a target the group filter hides, and overrides a lock for
  that switch alone; the bar flashes the overridden lock and the chips that
  turned on.
  There is no switch that copies one view's filter onto another past its
  locks.
- **`/`** opens the search of the bar on screen, unless focus is in a field
  the key types into.
- **A lock** holds one view's axis against manual switches. Unlocking resumes
  adoption from the next switch.
- **Focus into the graph** is `focusNode`
  ([README § The view](README.md#the-view)). Its frame of the node and its
  neighbours holds as the first layout's does; when a settled layout, a pan,
  zoom or drag lets it go, a ring round the node fades over 600 ms, and a
  newer frame lets it go without one.

## Keyboard

Where the keys listen is the `keyboard` prop. A key with a modifier (Ctrl,
Meta, Alt) is never the pane's, nor is a key typed into an input; a button
keeps its own keys, Escape aside.

| Key | Action |
|---|---|
| Tab / Shift+Tab | Move the focus ring to the next or previous visible node, in graph order, while the pane itself has focus |
| Enter | Select the focused node |
| Escape | Close the shortcuts panel, else the search, else clear the selection, else (on the pane) give focus back |
| Arrows | Pan |
| `+` / `-` | Zoom about the centre |
| `F` | Fit |
| `/` | Open the search and focus it, while `chrome.search` offers it |
| Space | Play / Pause |
| `?` | Toggle the shortcuts panel, which also lists Shift+hover, while `chrome.shortcuts` offers it |
| Shift (held) | Reverse the walk ([§ Hover and selection](#hover-and-selection)) |

Nodes are not DOM elements: the pane keeps a virtual focus over the canvas.
The ordering, an accessible name per node and the hover box following the
focus are
[#7](https://github.com/jmbarzee/force-graph/issues/7).
