# Many axes — an example host

Five filter axes of thirty values each, on a graph with no edges: the filter
bar at its busiest. It opens with every axis on one row of chips, and the
canvas in view. A second bar starts hidden behind a toggle, as a host keeps
a lens it is not showing.

## Run

From the repository root:

```sh
npx vite --config examples/many-axes/vite.config.ts        # http://localhost:5180
node_modules/.bin/tsc --noEmit -p examples/many-axes/tsconfig.json
```
