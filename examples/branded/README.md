# Branded — an example host

A host's brand on the pane and its bar, in light and dark: surface, canvas,
text, accent, fonts, and the focus and selection rings, redeclared in
`brand.css` on the pane's root by its `className` and its `data-gv-theme`.

## Run

From the repository root:

```sh
npx vite --config examples/branded/vite.config.ts        # http://localhost:5181
node_modules/.bin/tsc --noEmit -p examples/branded/tsconfig.json
```

Add `?theme=dark` (or `light`) to the URL to start the pane in that theme.
