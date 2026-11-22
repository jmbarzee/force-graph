# Many axes — an example host

Five filter axes of thirty values each, on a graph with no edges: the filter
bar at its busiest. It opens with every axis on one row of chips, and the
canvas in view. A second bar starts hidden behind a toggle. The groups follow
one axis, chosen by a picker the host puts inside the `ColorLegend`: thirty
fill keys and thirty glow keys, which scroll under the picker. Every axis is
past the push/pull ceiling, so the taxonomy folds the regions into thirds, a
mapping the push/pull axis dropdown offers. The nodes fill by Team, whose chips and
the hover box wear the same colours. The counts under the canvas are in
German, one of the pane's `strings`.

## Run

From the repository root:

```sh
npx vite --config examples/many-axes/vite.config.ts        # http://localhost:5180
node_modules/.bin/tsc --noEmit -p examples/many-axes/tsconfig.json
```
