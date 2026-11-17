# Course catalog — an example host

A university course catalog drawn with `@jmbarzee/force-graph`:
faculties contain departments, departments contain courses, courses contain
labs. Prerequisite, co-requisite and recommended links cross the hierarchy, and
only the edge's own `requirement` tells them apart. A cross-listed course
(Biochemistry is both CHEM 310 and BIOL 310) is one node per listing, glowing
together. Degree programmes are glow groups, and catalog errors are findings.

The example imports only the package's public entry.

## Run

From the repository root:

```sh
npx vite --config examples/course-catalog/vite.config.ts        # http://localhost:5179
node_modules/.bin/tsc --noEmit -p examples/course-catalog/tsconfig.json
```

Add `?theme=dark` (or `light`) to the URL to pin the pane's theme, and
`?focus=lab:CHEM%20101L` to open framed on a lab, which the opening filter
hides.

## What each file exercises

| File | Library seam |
|---|---|
| `data.ts` | None. This is the domain data in its own shape. |
| `taxonomy.ts` | `createTaxonomy`. It declares a style axis (`entity`, which is also the allow-list filter), node styles by label, glyph, colour and size (the physics and the rest bands are the library's defaults), edge types (containment classified by its declared pairs and left to the library's stroke, the three requirement kinds by `match` on the `requirement` axis over one pair declared with array ends, a course or a lab on each side, the co-requisite `undirected`), two filter axes with opposite `emptyMeans` (one with `chipsFor` and an `initialSelection` naming whole chips), payload scalars that answer raw numbers for the frame to normalise (`normalize: 'range'` for the level), `contextLine` and `highlight`. |
| `graph.ts` | `Graph`. It writes `parentId` and no containment edge (the library derives it), sets its own `requirement` axis on every dependency edge (no relation: a dependency is the default) and weights it by its target's credits over the heaviest's, declares a twelve-week `window` and gives every requirement a weekly `series`, one profile shifted by its target's level and scaled by its credits, so its total over the heaviest total is its weight (`series.test.ts`), gives a cross-listed course's nodes one `copyKey`, rings a listing no department owns, and carries each course's and lab's programmes in its payload, which `programmeGroups` reads as `{ keys, of }` groups. |
| `App.tsx` | `labels` beside the graph, naming the campus values on their chips and the band legend. `GraphView` state props by need: `filter` controlled (the details panel narrows it), `selectedId`/`onSelectionChange` controlled (closing the panel clears the selection), the axes, the locks (none: one view has nothing to lock against, so no toggles) and `search` left to the view, `theme` controlled, the details panel resolving the same choice through `useScheme`. Also `TaxonomyContext`, `initialFilter`, `counts="faceted"` (each chip counts what the other axis leaves visible, a cross-listed course once), `findings`, `groups` derived from the payload with `groupsControl` rendering a `GroupLegend` over their `keys` and handing it the view's `control` (its checkboxes write the controlled filter's group entry, so the host keeps no group state, and its hover emphasis rebuilds nothing), `nodeAction` and `onNodeActivate` (details), `focus` through `useFocusRequest` (Reveal: a keyed request the view honours once its node is in the graph — widen the filter, frame, select), `withSelection`, `nodesById`/`copyGroups` and `payloadString`/`payloadNumber` for the details panel's listings, and `onSettled` into `defaultPositions` through `positions.ts`. |
| `positions.ts` | `Position`. It keeps the positions `onSettled` hands over in `localStorage`, and reads them back for `defaultPositions`, so a reload opens where the nodes came to rest. |
| `main.tsx` | `themeChoiceOf`. |
| `app.css` | The pane's and the panel's `data-gv-theme`, the library's tokens on both, and the scheme's `--gv-node-<value>`. |
