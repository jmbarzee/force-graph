// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import { createTuning } from '../graph/tuning'
import type { Graph } from '../graph/model'
import type { GraphDiagnostic } from '../graph/validate'

vi.mock('./GraphCanvas', () => ({ GraphCanvas: () => null }))

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  window.requestAnimationFrame = () => 0
  window.cancelAnimationFrame = () => {}
})

class HostBoundary extends React.Component<{ children?: React.ReactNode; onCatch: (e: Error) => void }, { caught: boolean }> {
  state = { caught: false }
  static getDerivedStateFromError() { return { caught: true } }
  componentDidCatch(e: Error) { this.props.onCatch(e) }
  render() { return this.state.caught ? null : this.props.children }
}

const graph: Graph = { nodes: [{ id: 'a', name: 'a', values: {} }, { id: 'b', name: 'b', values: {} }], edges: [] }
const scored = (answer: number) => createTaxonomy({
  styleAxis: 'kind', values: [],
  scalars: [{ id: 'rank', compute: g => new Map([...g.nodes].map(n => [n.id, n.id === 'b' ? answer : 0.5])) }],
})

it('keeps a refused scalar answer inside the pane, and recovers when the scalar does', async () => {
  const caught: Error[] = []
  let reported: readonly GraphDiagnostic[] = []
  const host = document.createElement('div')
  const root = createRoot(host)
  const render = (answer: number) => act(async () => {
    const taxonomy = scored(answer)
    root.render(React.createElement(HostBoundary, { onCatch: e => caught.push(e) },
      React.createElement(GraphView, { graph, taxonomy, onDiagnostics: d => { reported = d }, defaultTuning: createTuning({ forces: { bandY: { scalar: 'rank' } } }, taxonomy) })))
  })
  await render(NaN)
  expect(caught.map(e => e.message)).toEqual([])
  expect(host.textContent).toContain('scalar "rank" answered NaN for node "b"')
  expect(reported.map(d => [d.code, d.nodeId])).toEqual([['scalar-answer-refused', 'b']])
  await render(1)
  expect(host.textContent).not.toContain('answered')
  expect(reported).toEqual([])
  expect(host.querySelector('.gv-graph-view')).not.toBeNull()
})
