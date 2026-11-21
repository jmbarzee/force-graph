import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PushPullControls } from '../../src/components/PushPullControls'
import { GravityControls } from '../../src/components/GravityControls'
import { TaxonomyContext } from '../../src/components/graph-view/useTaxonomy'
import { computeVisibleGraph } from '../../src/components/graph-view/visibleGraph'
import { presentSetsOf } from '../../src/components/graph-view/present'
import { resolvePhysics } from '../../src/graph/forces'
import { axisOptions, defaultParamsFor, layoutAxisOptions, sprungEdges } from '../../src/graph/simulation'
import type { SimNode } from '../../src/graph/simulation'
import { initialFilter, withChosen } from '../../src/filter/types'
import { catalog } from './data'
import { buildGraph } from './graph'
import { ENTITY, taxonomy } from './taxonomy'

const graph = buildGraph(catalog)
const nodes = graph.nodes as SimNode[]
const getNode = (id: string) => nodes.find(n => n.id === id)
const params = defaultParamsFor(taxonomy)
const resolved = resolvePhysics(params, taxonomy)
const axes = axisOptions(taxonomy, graph)
const noop = () => {}

/** Both force tabs over what the opening filter shows, with `entities` shown on the style axis when given. */
function forceTabs(entities?: string[]): (s: string) => number {
  const opening = initialFilter(taxonomy, graph)
  const filter = entities ? withChosen(opening, ENTITY, new Set(entities)) : opening
  const { visibleNodes, visibleIds } = computeVisibleGraph({ nodes, edges: graph.edges, getNode }, filter, taxonomy)
  const present = presentSetsOf(visibleNodes, sprungEdges(graph.edges, visibleIds), resolved, getNode)
  const html = renderToStaticMarkup(React.createElement(TaxonomyContext.Provider, { value: taxonomy },
    React.createElement(PushPullControls, {
      params, resolved, axes, present, onParamChange: noop, onAxisChange: noop, onActiveSection: noop,
      hoveredPushBucket: null, onHoverPushBucket: noop, hoveredEdge: null, onHoverEdge: noop,
    }),
    React.createElement(GravityControls, {
      params, resolved, axes: layoutAxisOptions(axes, taxonomy), present,
      onParamChange: noop, onRelayout: noop, hovered: null, onHover: noop,
    }),
  ))
  return s => html.split(s).length - 1
}

describe('the catalog’s ladders', () => {
  it('set organisation and teaching apart on the push map and both band plots', () => {
    const count = forceTabs(['faculty', 'department', 'course', 'lab'])
    expect(count('class="gv-spring-chain"')).toBe(2)
    expect(count('class="gv-ctl-ladder-backdrop"')).toBe(4)
    expect(count('>organisation</button>')).toBe(3)
    expect(count('>teaching</button>')).toBe(3)
  })

  it('draw teaching only once labs are shown, as the catalog opens without them', () => {
    const count = forceTabs()
    expect(count('class="gv-spring-chain"')).toBe(1)
    expect(count('>organisation</button>')).toBe(3)
    expect(count('>teaching</button>')).toBe(0)
  })
})
