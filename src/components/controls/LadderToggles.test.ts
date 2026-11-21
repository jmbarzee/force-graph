// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PushPullControls } from '../PushPullControls'
import { GravityControls } from '../GravityControls'
import { TaxonomyContext } from '../graph-view/useTaxonomy'
import { computeVisibleGraph } from '../graph-view/visibleGraph'
import { presentSetsOf } from '../graph-view/present'
import { createTaxonomy } from '../../graph/taxonomy'
import { resolvePhysics } from '../../graph/forces'
import { axisOptions, defaultParamsFor, layoutAxisOptions, sprungEdges } from '../../graph/simulation'
import type { SimNode } from '../../graph/simulation'
import { initialFilter } from '../../filter/types'
import type { ValueSpec } from '../../graph/shapes'
import type { Graph } from '../../graph/model'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const style = (id: string, ladder?: string): ValueSpec => ({
  id, label: id, abbreviation: id, ladder,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
})
const graph: Graph = { nodes: ['a', 'b', 'c'].map(kind => ({ id: kind, name: kind, values: { kind } })), edges: [] }

/** Both force tabs over every node, mounted, with `a` and `c` a ladder when `ladder` is given. */
async function forceTabs(ladder?: string): Promise<HTMLElement> {
  const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [style('a', ladder), style('b'), style('c', ladder)] })
  const nodes = graph.nodes as SimNode[]
  const getNode = (id: string) => nodes.find(n => n.id === id)
  const params = defaultParamsFor(taxonomy)
  const resolved = resolvePhysics(params, taxonomy)
  const axes = axisOptions(taxonomy, graph)
  const { visibleNodes, visibleIds } = computeVisibleGraph({ nodes, edges: graph.edges, getNode }, initialFilter(taxonomy, graph), taxonomy)
  const present = presentSetsOf(visibleNodes, sprungEdges(graph.edges, visibleIds), resolved, getNode)
  const noop = () => {}
  const el = document.createElement('div')
  await act(async () => createRoot(el).render(React.createElement(TaxonomyContext.Provider, { value: taxonomy },
    React.createElement(PushPullControls, {
      params, resolved, axes, present, onParamChange: noop, onAxisChange: noop, onActiveSection: noop,
      hoveredPushBucket: null, onHoverPushBucket: noop, hoveredEdge: null, onHoverEdge: noop,
    }),
    React.createElement(GravityControls, {
      params, resolved, axes: layoutAxisOptions(axes, taxonomy), present,
      onParamChange: noop, onRelayout: noop, hovered: null, onHover: noop,
    }),
  )))
  return el
}
const all = (el: HTMLElement, selector: string) => el.querySelectorAll(selector).length
const LADDERED = ['.gv-spring-chain', '.gv-ctl-ladder-backdrop', '.gv-ctl-ladder-toggle']

describe('a ladder on the force tabs', () => {
  it('draws nothing of ladders where none is declared', async () => {
    const el = await forceTabs()
    for (const s of LADDERED) expect(all(el, s)).toBe(0)
  })

  it('joins its rungs on the push map, backs their columns on each band plot, and offers a toggle under each', async () => {
    const el = await forceTabs('pair')
    expect(all(el, '.gv-spring-chain')).toBe(1)
    expect(all(el, '.gv-ctl-ladder-backdrop')).toBe(2)
    expect(all(el, '.gv-ctl-ladder-toggle[aria-pressed="false"]')).toBe(3)
  })

  it('collapses to one row on its own surface', async () => {
    const el = await forceTabs('pair')
    const columns = all(el, '.gv-gravity-band-col')
    const tokens = all(el, '.gv-spring-map-svg .gv-spring-token')
    const [push, x] = el.querySelectorAll<HTMLButtonElement>('.gv-ctl-ladder-toggle')
    await act(async () => { push!.click(); x!.click() })
    expect(all(el, '.gv-ctl-ladder-toggle[aria-pressed="true"]')).toBe(2)
    expect(all(el, '.gv-spring-chain')).toBe(0)
    expect(all(el, '.gv-spring-map-svg .gv-spring-token')).toBe(tokens - 1)
    expect(el.querySelector('.gv-spring-token title')?.textContent).toMatch(/pair ladder/)
    expect(all(el, '.gv-ctl-ladder-backdrop')).toBe(1)
    expect(all(el, '.gv-gravity-band-col')).toBe(columns - 1)
    // The collapsed column keeps a sub-stripe per rung.
    expect(all(el, '.gv-gravity-band-stripe')).toBe(6)
  })
})
