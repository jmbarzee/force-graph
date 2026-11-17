// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { edgeAt, GraphCanvas } from './GraphCanvas'
import { TaxonomyContext } from './graph-view/useTaxonomy'
import { createTaxonomy } from '../graph/taxonomy'
import type { GraphEdge } from '../graph/model'
import type { EdgeStroke } from '../graph/scheme'
import { NEUTRAL_STROKE } from '../graph/shapes'

const at = new Map([['a', { x: 0, y: 0 }], ['b', { x: 100, y: 0 }], ['c', { x: 0, y: 10 }], ['d', { x: 100, y: 10 }]])
const vp = { x: 0, y: 0, scale: 1 }
const ab: GraphEdge = { id: 'ab', sourceId: 'a', targetId: 'b' }
const cd: GraphEdge = { id: 'cd', sourceId: 'c', targetId: 'd' }
const none = new Map<string, number>()
const drawn = new Map<GraphEdge, EdgeStroke>()

describe('edgeAt', () => {
  it('takes the nearest of the edges in reach', () => {
    expect(edgeAt(50, 4, [ab, cd], at, vp, none, drawn)).toBe(ab)
    expect(edgeAt(50, 6, [ab, cd], at, vp, none, drawn)).toBe(cd)
  })

  it('reaches 4 screen pixels from the stroke, and no further', () => {
    expect(edgeAt(50, 4, [ab], at, vp, none, drawn)).toBe(ab)
    expect(edgeAt(50, 4.5, [ab], at, vp, none, drawn)).toBeNull()
    expect(edgeAt(104.5, 0, [ab], at, vp, none, drawn)).toBeNull()
    expect(edgeAt(100, 5, [ab], at, { x: 0, y: 0, scale: 2 }, none, drawn)).toBeNull()
  })

  it('passes over an edge stroked at alpha 0, which is not drawn', () => {
    const unplayed = new Map([[ab, { ...NEUTRAL_STROKE, alpha: 0 }]])
    const near = new Map([...at, ['e', { x: 0, y: 4 }], ['f', { x: 100, y: 4 }]])
    const ef: GraphEdge = { id: 'ef', sourceId: 'e', targetId: 'f' }
    expect(edgeAt(50, 1, [ab, ef], near, vp, none, drawn)).toBe(ab)
    expect(edgeAt(50, 1, [ab, ef], near, vp, none, unplayed)).toBe(ef)
    expect(edgeAt(50, 0, [ab], near, vp, none, unplayed)).toBeNull()
  })

  it('hits an edge in its lane, not on the line between its ends', () => {
    const ba: GraphEdge = { id: 'ba', sourceId: 'b', targetId: 'a' }
    const lanes = new Map([['ab', 7], ['ba', -7]])
    expect(edgeAt(50, 7, [ab, ba], at, vp, lanes, drawn)).toBe(ab)
    expect(edgeAt(50, -7, [ab, ba], at, vp, lanes, drawn)).toBe(ba)
    expect(edgeAt(50, 0, [ab, ba], at, vp, lanes, drawn)).toBeNull()
  })
})

describe('GraphCanvas', () => {
  it('clears node and edge hover when the pointer leaves it', () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
    const onHoverNode = vi.fn()
    const onHoverEdge = vi.fn()
    const props = { nodes: [], edges: [], onHoverNode, onHoverEdge } as unknown as React.ComponentProps<typeof GraphCanvas>
    const el = document.body.appendChild(document.createElement('div'))
    const root = createRoot(el)
    act(() => root.render(React.createElement(TaxonomyContext.Provider, { value: createTaxonomy({ styleAxis: 'kind', styles: [] }) },
      React.createElement(GraphCanvas, props))))
    act(() => { el.querySelector('canvas')!.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })) })
    expect(onHoverNode).toHaveBeenCalledWith(null)
    expect(onHoverEdge).toHaveBeenCalledWith(null)
    act(() => root.unmount())
  })
})
