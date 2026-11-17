// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from './GraphView'
import type { FilterState } from '../filter/types'
import { createTaxonomy } from '../graph/taxonomy'
import type { Graph } from '../graph/model'

vi.mock('./GraphCanvas', () => ({ GraphCanvas: () => null }))

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  window.requestAnimationFrame = () => 0
  window.cancelAnimationFrame = () => {}
})

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [{ id: 'team', emptyMeans: 'none' }] })
const staff: Graph = { nodes: ['a', 'b'].map(team => ({ id: team, name: team, values: { team } })), edges: [] }
const hiding = (...teams: string[]): FilterState => new Map([['team', { except: new Set(teams) }]])

function pane(graph: Graph) {
  const el = document.createElement('div')
  const root = createRoot(el)
  return async (filter: FilterState) => {
    await act(async () => { root.render(React.createElement(GraphView, { graph, taxonomy, filter })) })
    return el.querySelector('.gv-graph-empty')?.textContent
  }
}

it('says so when the filter draws no node, and stops once it draws one', async () => {
  const lineUnder = pane(staff)
  expect(await lineUnder(hiding('a', 'b'))).toBe('No nodes match the filter.')
  expect(await lineUnder(hiding('a'))).toBeUndefined()
})

it('leaves an empty graph to the host', async () => {
  expect(await pane({ nodes: [], edges: [] })(hiding())).toBeUndefined()
})
