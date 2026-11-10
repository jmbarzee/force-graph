# force-graph — the view

What the pane shows and how it behaves for the person using it. The
[README](README.md) is the host's contract and names every prop and hook used
here; [DESIGN](DESIGN.md) holds the invariants and why. Examples are the
[course catalog](examples/course-catalog/): faculties contain departments,
departments contain courses, courses contain labs, and prerequisite,
co-requisite and recommended edges cross the hierarchy.

## Principles

- **Direct manipulation.** The user moves the thing itself — a node, a token
  on a map, a band's edge — not a proxy for it.
- **Make the invisible visible.** A force is drawn on the canvas while its
  control is touched.
- **Spatial encoding.** Position carries structure; labels confirm it.
- **Tight feedback.** Every change shows at once; nothing waits on Play.
- **Progressive disclosure.** The essential at rest, the detail on hover.
- **The filter is the source of truth.** Search, hover, halos and glow work on
  what is visible and never reveal a hidden node; a focus that must reveal one
  widens the filter visibly.

## Layout

The layout is a force simulation: each tick the forces move the visible nodes,
the energy (alpha) cools, and ticking pauses below a threshold.

| Force | Acts on | Behaviour |
|---|---|---|
| Push | every pair of visible nodes | `F = charge / (d² + r²)^exp`, a charge and a core radius `r` per bucket of the push axis |
| Pull | every sprung edge | `F = α × stiffness × Δ^exp / d`, `Δ = d − length` (signed), a stiffness and a rest length per spring category |
| Band | every node, on X and on Y | none inside its rest band; outside it, `strength × dᵉˣᵖ` back toward it |
| Topological | every node | an inward pull scaled by reach, the depth of its dependency chain, propagated up containment so no node is pulled above its container |
| Center | every node | a pull to the origin, only while no band axis and no topological pull acts |

- **Push and pull key on one axis**, the push axis: the style axis unless the
  user picks another the nodes carry. On the style axis a bucket starts from
  its value's declared physics and the spring categories are the declared edge
  types; on any other axis every bucket starts from the taxonomy's typical
  physics (the mean over its values) and there is one spring category per
  unordered bucket pair per relation. A sprung edge is an original edge with
  both ends visible; a graduated edge is drawn and never sprung.
- **Two layout axes**, X and Y, each keyed on a node axis — every bucket rests
  in a band — or on a computed scalar, read across a span from where 0 rests to
  where 1 rests (built in: reach, degree, depth; the catalog adds credits and
  level). A strength of zero turns an axis off; a node with no value on it
  rests at its centre. A filter change moves no band (DESIGN § The forces).
- **Radial**, a switch on Y: Y's buckets become rings about the origin, the
  lowest innermost; X is ignored; the topological pull draws to the centre
  instead of the top. Charge spreads a ring's nodes; nothing acts on angle.
- **Seeding.** A node starts inside its bands, low in its Y band and at its
  parent's X (in radial, on its ring near its parent's angle). A node with a kept position
  (`defaultPositions`, or the last graph's layout) starts there.
- **Reheat.** A changed graph, a filter change, a force edit and a dragged
  node each re-energise the layout; there is no Reheat button. A node
  scaling edit only redraws.

## Which nodes are visible

A node is visible when it passes every filter axis shown, each by its own
`emptyMeans` and `absentMeans`. In the catalog, Show is an allow-list (no chip
on shows nothing) and Campus narrows (no chip on shows every campus;
faculties and departments carry no campus and always show). Search never
hides.

Edges follow the visible set ([README § Collapse rules](README.md#collapse-rules)):
a dependency edge with a hidden end graduates, and a containment edge skips
hidden tiers, attaching a visible child to its nearest visible ancestor —
with departments hidden, courses cluster round their faculty. A hidden
child's containment edge is dropped. Every filter combination draws a
coherent graph.

## Kind transitions

Revealing a bucket opens its containers: each revealed node starts at its
nearest visible ancestor, snapped onto the edge of its own band (in radial, on
its own ring at the ancestor's angle), and the layout spreads it from there —
showing labs while courses are visible, each lab emerges from its course.
Whether an axis seeds and refits this way or reheats in place follows its
`emptyMeans` (DESIGN § The state). The fades and force ramps that would
animate a reveal or a hide are [#8](https://github.com/jmbarzee/force-graph/issues/8).

## Viewport

| Input | Action |
|---|---|
| Scroll or pinch | Zoom about the pointer, 0.1× to 40×; the page behind never scrolls |
| Drag the background | Pan |
| Drag a node | Move it, held in place until release; the layout reheats around it |
| Click a node / the background | Select it / clear the selection |
| Double-click a node | Frame it and its neighbours (`chrome.activateZoom`), and `onNodeActivate` |
| Double-click the background | Frame the visible set |

**Fit** (the button, `F`, `fit()`) frames every visible node. The first
layout is framed once its warm-up cools, and so is a refitting filter change.
Resizing the pane keeps
the world point at its centre fixed.

## The pane's chrome

The filter bar floats over the top of the canvas, which fills the pane behind
it: translucent, blurred and capped in height, its controls alone taking the
pointer, so zoomed content bleeds visibly under it. The host's `findings` fill a
slot at its bottom. A host's `groupsControl` anchors under it, at
`--gv-toolbar-height`.

At the bottom, out of the bar's way:

- **bottom left** — `N nodes, M edges`, the visible and graduated set, moved
  aside while the shortcuts panel is open;
- **bottom centre** — Fit; the theme button, cycling Auto → Light → Dark
  ([README § Theming](README.md#theming) says how Auto resolves); Play / Pause
  (`Space`); and the frame rate while the simulation runs;
- **bottom right** — the control panel.

`chrome` turns each part off.

## The control panel

Collapsed by default behind **Controls**. Three tabs — **Push/Pull**,
**Gravity**, **Misc** — one shown at a time, in a body sized to the tallest so
switching never resizes the panel. A force tab shows its equation in a card,
then the controls for every term in it; hovering a symbol in the equation
lights the global slider it names. Every control is live and every force edit
reheats.

**A control offers what the visible set holds**: a push token per bucket a
visible node falls in, a pull token per spring category a sprung edge falls in,
a column per bucket on each layout axis. Hiding a chip removes its tokens and
keeps their tuning for when they return. The axis dropdowns alone measure the
whole graph, so an axis's availability never flips with a filter.

**The token ceiling is 24** push tokens and 24 pull tokens. The push axis
dropdown shows an axis's push and pull token counts beside its name, a layout
axis dropdown its column count; an axis past the ceiling is listed
disabled with the count that disqualifies it. Switching axes starts
from the declared or typical physics on the new buckets. When the graph changes,
an axis bucketed by observed values is rebuilt and keeps the tuning of the
values that survive; an axis that vanishes or outgrows the ceiling returns the
forces to the style axis, said once on the console.

### Push/Pull

The push axis dropdown sits above both sub-tabs. Each sub-tab is its equation,
a 2D map and a curve:

- **Push map** — y is charge magnitude (0 to 1000), x is core radius (0 to
  100). One solid token per bucket; dragging it sets both values. Tokens that
  coincide, as every bucket does on a freshly picked axis, fan out on a small
  ring; a drag still writes the token's own value. The `push` and
  `coreRadiusMultiplier` sliders run along the axes they scale.
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
**Topological** (carrying its on/off switch). A switch never changes which
body shows.

- **X Axis / Y Axis** — `F = strength × dᵉˣᵖ`, an axis dropdown (a node axis
  within the ceiling, or a scalar), a plot with one column per bucket and its
  rest band drawn as a stripe with two drag handles, the axis's strength
  slider, its response curve (normalised to the stronger axis) and the `exp`
  slider shared by both axes. On a scalar axis the plot is a gradient whose two
  ends are the handles, and dragging them past each other flips the axis; until
  the user drags, the span follows the taxonomy. 1 sits at the top of both
  plots.
- **Topological** — `F = strength × depthᵉˣᵖ × d`, a depth-to-pull curve, and
  its strength and `exp` sliders.

A body whose force does nothing — zero strength, X in radial, Topological
off — stays shown, dimmed. Center gravity has no control.

### Misc

- **Dynamics** — `friction` (velocity damping per tick), `cooling` (energy
  lost per tick), `threshold` (the energy below which ticking pauses).
- **Node scaling** — on-screen size is `r × size × clamp(zoom, shrink floor,
  grow cap)`, defaults 0.6, 0.4 and 1.65; lowering the grow cap makes nodes
  shrink sooner as the user zooms out.

## Force-field visualisation

While a control is hovered the canvas draws what it governs, between the edges
and the nodes, and drops it when the pointer leaves. There is no toggle.

| Hovered | Canvas |
|---|---|
| Push | Charge rings round every visible node, outlines only, in its style colour, where its force falls below fixed thresholds; a threshold a charge cannot reach draws no ring |
| a push token | That bucket's rings alone |
| Pull | Every edge coloured by tension: `--gv-tension-rest` near rest length, `--gv-tension-stretch` stretched, `--gv-tension-compress` compressed |
| a pull token | That category's edges only, in a tension-coloured casing under their own stroke |
| Gravity | A stripe per band some node of the whole graph falls in, median-centred like the force (in radial, a ring per Y band); a scalar axis draws one gradient stripe, and a scalar Y in radial draws nothing |
| an axis-plot column | That bucket's stripe or ring alone; a bucket no visible node falls in dims nothing |
| Misc | Nothing |

## Search

`/` opens the search. A query matches, case-insensitively, the text
`searchText` gives — the name by default — and hides nothing: matching visible
nodes stay at full opacity and the rest dim to 20%. A match a filter hides
badges the chip hiding it, on the first axis shown that it fails, and the
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
6. its visible dependency degree (`→3 ←2`), unless its `summaryKind` is
   `none`;
7. `dependencies` or `dependents`, the walk's direction;
8. the host's `nodeAction` button.

The box stays open while the pointer travels onto it and over it, so its
button can be clicked.

The selected node wears a ring; the selection drives the highlight while
nothing is hovered. A graph that no longer holds the view's own selection
clears it.

## Copies

When the active node has sister copies — nodes sharing its `copyKey` — every
visible one wears a halo in its own colour. A sister is not added to the
highlight: one off the chain dims with the rest, and the halo marks it.
Hovering one listing of a cross-listed course (Biochemistry, CHEM 310 and
BIOL 310) halos every listing. A hidden copy stays hidden.

## Group glow

`groups` glow behind everything else on the canvas. Each visible member gets a
radial halo in its group's colour that fuses with its neighbours' into one
blob; an edge glows when both ends are in one group. A group without a
`color` takes a small cycling palette's slot for its place in the host's
list, so hiding one group recolours no other. A focused group — the one
`emphasize` names, or the one holding the active node — brightens and swells. Glow covers only visible members and
never changes what is visible. In the catalog each degree programme is a
group.

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
- **Edges.** Stroked by their resolved type (`EdgeType.style`) — a graduated
  edge keeps the type of the edge it stands for. Dependency edges carry an
  8 px arrowhead toward the dependency, at every zoom; containment is
  undirected. Parallel edges between one pair draw in lanes. A `markedEdges`
  edge gets a dashed band in the label ink behind its own stroke, so it keeps
  its type's colour and dash.
- **Colour.** The style values' colours and the edge types' strokes are the
  taxonomy's, per theme; the canvas draws in the pane's resolved theme
  ([README § Theming](README.md#theming)).

## Linked views

A host with a second view links them through `useLinkedViews` (README § Two
views sharing a bar).

- **One bar, every view.** `FilterBar` is one row of chips per axis shown,
  each with its lock and a `×` on hover that removes it; a `+` adds a
  declared axis not shown; then the search, and the findings slot. The search query is shared by every view.
- **A switch reconciles.** A manual switch adopts the source view's selection
  on every axis the destination shows, except where the destination is locked.
  A focus widens the destination only as far as its target needs, by each
  axis's `widens` and by whole chips, and overrides a lock for that switch
  alone; the bar flashes the overridden lock and the chips that turned on.
  There is no switch that copies one view's filter onto another past its
  locks.
- **A lock** holds one view's axis against manual switches. Unlocking resumes
  adoption from the next switch.
- **Focus into the graph** is `focusNode` (README § The view). Framing the
  node's neighbourhood, holding the viewport and flashing the target are
  [#21](https://github.com/jmbarzee/force-graph/issues/21).
- **A changed graph** keeps its layout (README § The graph) and the camera; a
  new node is seeded in its bands. The layout keeps its tuning, the selection
  survives while its node does, and `FilterBar`'s `refreshFlash` flashes the bar for a
  host that bumps it.

A filter that hides every node leaves an empty canvas reading
`0 nodes, 0 edges`; a message is
[#6](https://github.com/jmbarzee/force-graph/issues/6).

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
| Shift (held) | Reverse the walk's direction |

The hover box's direction line says which way the walk runs. Nodes are not DOM
elements: the pane keeps a virtual focus over the canvas. The ordering, an
accessible name per node and the hover box following the focus are
[#7](https://github.com/jmbarzee/force-graph/issues/7).

## Performance

The simulation ticks every visible node; drawing culls what lies outside the
viewport. Push is O(n²) ([README § Limits](README.md#limits)).
