// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it } from 'vitest'
import { useSimulation } from './useSimulation'
import type { SimulationController } from './useSimulation'
import { defaultParamsFor } from '../../graph/simulation'
import { createTaxonomy } from '../../graph/taxonomy'
import type { Taxonomy } from '../../graph/taxonomy'
import type { Graph } from '../../graph/model'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const taxonomyOf = () => createTaxonomy({ styleAxis: 'kind', values: [], filterAxes: [] })
const graphOf = (...ids: string[]): Graph => ({ nodes: ids.map(id => ({ id, name: id, values: {} })), edges: [] })
const kept = new Map([['a', { x: 0, y: 0 }], ['b', { x: 100, y: 0 }]])

/** Mount the hook; `render` re-renders it over a new graph or taxonomy. */
async function mount(graph: Graph, positions?: ReadonlyMap<string, { x: number; y: number }>, strict = false) {
  const out: { sim?: SimulationController } = {}
  function Harness({ graph, taxonomy }: { graph: Graph; taxonomy: Taxonomy }) {
    const [forces, setForces] = React.useState(() => defaultParamsFor(taxonomy))
    out.sim = useSimulation(graph, taxonomy, positions, undefined, forces, setForces)
    return null
  }
  const root = createRoot(document.createElement('div'))
  const render = (graph: Graph, taxonomy: Taxonomy) => act(async () => {
    const harness = React.createElement(Harness, { graph, taxonomy })
    root.render(strict ? React.createElement(React.StrictMode, null, harness) : harness)
  })
  const taxonomy = taxonomyOf()
  await render(graph, taxonomy)
  const sim = () => out.sim!.simRef.current!
  return { sim, render, taxonomy }
}

it('starts a first build cool when every node has a position', async () => {
  const { sim } = await mount(graphOf('a', 'b'), kept)
  expect(sim().alpha).toBe(sim().params.alphaMin)
})

it('starts a first build cool under StrictMode, which replays its effects', async () => {
  const { sim } = await mount(graphOf('a', 'b'), kept, true)
  expect(sim().alpha).toBe(sim().params.alphaMin)
})

it('starts a first build warm when a node has no position', async () => {
  const { sim } = await mount(graphOf('a', 'b', 'c'), kept)
  expect(sim().alpha).toBe(1)
})

it('starts a later build warm, though every node keeps a position', async () => {
  const { sim, render, taxonomy } = await mount(graphOf('a', 'b'), kept)
  await render(graphOf('a'), taxonomy)
  expect(sim().alpha).toBe(1)
  await render(graphOf('a'), taxonomyOf())
  expect(sim().alpha).toBe(1)
})
