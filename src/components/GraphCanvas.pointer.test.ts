// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GraphCanvas } from './GraphCanvas'
import { TaxonomyContext } from './graph-view/useTaxonomy'
import { createTaxonomy } from '../graph/taxonomy'
import { DEFAULT_NODE_SCALE } from '../graph/node-scale'
import type { SimNode } from '../graph/simulation'

// One node at world (0, 0), drawn at screen (100, 100); (300, 300) is empty.
const node: SimNode = { id: 'a', name: 'a', values: {}, x: 0, y: 0, vx: 0, vy: 0, pinned: false }
const viewport = { x: 100, y: 100, scale: 1 }

let root: Root
let canvas: HTMLCanvasElement
let props: Record<string, ReturnType<typeof vi.fn>>

beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  HTMLCanvasElement.prototype.getContext = () => null
  HTMLCanvasElement.prototype.setPointerCapture = () => {}
  HTMLCanvasElement.prototype.releasePointerCapture = () => {}
  props = Object.fromEntries(['onViewportChange', 'onNodeDragStart', 'onNodeDragMove', 'onNodeDragEnd', 'onDoubleClickNode',
    'onFitView', 'onHoverNode', 'onSelectNode', 'onLassoSelect', 'onHoverEdge'].map(name => [name, vi.fn()]))
  const el = document.body.appendChild(document.createElement('div'))
  root = createRoot(el)
  await act(async () => root.render(React.createElement(TaxonomyContext.Provider, { value: createTaxonomy({ styleAxis: 'kind', values: [], filterAxes: [] }) },
    React.createElement(GraphCanvas, {
      ...props, nodes: [node], edges: [], viewport, nodeScale: DEFAULT_NODE_SCALE,
      selectedNodeIds: new Set(), highlightedNodes: null, highlightedEdges: null, hoveredNodeId: null, hoveredEdgeId: null,
      focusedNodeId: null, flashNode: null, searchMatchIds: null, running: false, edgeStrokes: new Map(), edgeOffsets: new Map(),
      undirectedEdges: new Set(), activeSection: null, activePushBucket: null, activeGravityBucket: null, activePullEdge: null,
      groupGlows: [], markedEdges: new Set(),
      // No forceParams, resolved, overlay or theme: only the draw loop reads
      // them, and a canvas with no context never runs it.
    } as unknown as React.ComponentProps<typeof GraphCanvas>))))
  canvas = el.querySelector('canvas')!
})
afterEach(() => act(() => root.unmount()))

const fire = (type: string, x: number, y: number, ctrlKey = false) =>
  act(async () => { canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, ctrlKey })) })
async function drag(ctrlKey: boolean, ...path: [number, number][]) {
  await fire('pointerdown', ...path[0]!, ctrlKey)
  for (const at of path.slice(1)) await fire('pointermove', ...at, ctrlKey)
  await fire('pointerup', ...path[path.length - 1]!, ctrlKey)
}

it('lassoes on a Ctrl+drag over the background, and leaves the viewport be', async () => {
  await drag(true, [50, 50], [150, 50], [150, 150], [50, 150])
  expect(props.onLassoSelect).toHaveBeenCalledWith(['a'])
  expect(props.onViewportChange).not.toHaveBeenCalled()
})

it('pans on a plain drag', async () => {
  await drag(false, [300, 300], [320, 300])
  expect(props.onViewportChange).toHaveBeenCalled()
  expect(props.onLassoSelect).not.toHaveBeenCalled()
})

it('drags a node on a Ctrl+drag that starts on it', async () => {
  await drag(true, [100, 100], [140, 100])
  expect(props.onNodeDragStart).toHaveBeenCalledWith('a', 0, 0)
  expect(props.onNodeDragEnd).toHaveBeenCalled()
  expect(props.onLassoSelect).not.toHaveBeenCalled()
})

it('selects nothing when a lasso or a node drag is cancelled', async () => {
  await fire('pointerdown', 50, 50, true)
  for (const [x, y] of [[150, 50], [150, 150], [50, 150]] as const) await fire('pointermove', x, y, true)
  await fire('pointercancel', 50, 150, true)
  await fire('pointerup', 50, 150, true)
  await fire('pointerdown', 100, 100)
  await fire('pointercancel', 100, 100)
  await fire('pointerup', 100, 100)
  expect(props.onLassoSelect).not.toHaveBeenCalled()
  expect(props.onSelectNode).not.toHaveBeenCalled()
  expect(props.onNodeDragEnd).toHaveBeenCalledTimes(1)
})

it('keeps the context menu shut on Ctrl+click only', () => {
  const menu = (ctrlKey: boolean) => !canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ctrlKey }))
  expect(menu(true)).toBe(true)
  expect(menu(false)).toBe(false)
})
