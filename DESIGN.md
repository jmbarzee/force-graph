# force-graph — design notes

What a maintainer needs that the README — the host's contract — and
[SPEC](SPEC.md) — the view's behaviour — do not say: the invariants the
library holds and why.

## The model

- **One axis per feature.** Colour, push and pull, each layout axis and each
  filter axis elect exactly one axis; nothing sums, ranks or composes across
  axes. It is what keeps the model explainable, and what gives every control a
  bounded surface.
- **A node is a map of axis to value.** Values are interned strings — `Set`
  and `Map` keys dedupe by value, and a composite value would silently become
  one entry per node. The style axis is one axis among them, named once
  (`styleAxis()`); a projection of another axis is written by the host when it
  builds the node, never derived by the engine.
- **The library knows no domain.** No word of a host's vocabulary enters it;
  the taxonomy is injected, and every consumer resolves through the container
  it is handed.
- **Resolution never throws and allocates nothing in the draw loop.** A miss
  resolves to a declared fallback and is said once per taxonomy; every keyed
  lookup on a host string goes through `hasOwn`, because a value named
  `constructor` is a value.
- **The absent-value physics is finite and bounded, not inert.** A node with no
  value on the push axis still repels; the guard's job is to keep a number
  finite, not to invent a non-participant.
- **Containment is a tree the host declares** (`parentId`); the view derives
  the edge. A hidden end graduates as
  [README § Collapse rules](README.md#collapse-rules) says.

## The forces

- **`ForceParams` and the force kernels are not part of any surface.** The
  layout a host holds (`LayoutState`) is opaque, and its plain-data form
  (`LayoutJSON`) spells every field out, so the shipped declarations never
  reach the engine's types.
- **Per-bucket tuning is one constructed value, and sparse**: the mapping with
  only the overrides the user set. Everything else resolves to the taxonomy's
  declared physics at read time, so there is no dense table to go stale after
  a taxonomy swap.
- **Two symmetric layout axes**, each a node axis — rest bands re-centred on
  the median of the bands present — or a computed scalar over a span. One
  frame seeds, ticks and draws the overlay, so they cannot disagree.
- **A spring left out is the middling spring**, on any push axis, so no
  type's declared spring moves another's.
- **The random source is injected.** Production uses `Math.random`; a seeded
  source is for a test that wants the same layout twice.

## The state

- **Every piece of state follows the React convention** of
  [README § The view](README.md#the-view).
- **The filter is axis-keyed, copy-on-write and compared by content.**
  Removing an axis from the bar unfilters it. Re-seeding on a new graph follows
  the axes the user has not touched — explicit state the bar reports with
  every write, never an inference from the previous graph's opening selection.
- **Each axis's reheat follows from `keepCamera`**: an axis that refits (an
  allow-list's default) seeds revealed nodes at their ancestors; one that
  keeps the camera reheats in place.
- **A focus request is a value** (`{ id, key }`): it waits for its node, lands
  on the commit after the graph that brought it, and widens by whole chips.
- **The colour scheme is the taxonomy's, both themes at once.** One resolver
  decides the theme ([README § Theming](README.md#theming)), and the scheme
  rides inline as custom properties, so a host's chrome reads the same tints
  the canvas draws with.

## The surface

- **`src/index.ts` names every export**; nothing is `export *`. A name on it is
  a contract, and a change to it is a breaking change to every host.
- **Every shipped declaration carries a doc comment that states the contract,
  not the history.**
- **The course catalog keeps it honest.** `examples/course-catalog` is written
  against the public entry alone, and CI typechecks it: the check that the
  README suffices.
