import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MiscControls } from './GraphControlPanel'
import { createTaxonomy } from '../graph/taxonomy'
import { defaultParamsFor } from '../graph/simulation'
import type { ForceParams } from '../graph/simulation'
import { DEFAULT_NODE_SCALE } from '../graph/node-scale'
import type { NodeScaleParams } from '../graph/node-scale'

const params = defaultParamsFor(createTaxonomy({ styleAxis: 'kind', styles: [] }))
const noop = () => {}

function misc(p: Partial<ForceParams> = {}, s: Partial<NodeScaleParams> = {}): string {
  return renderToStaticMarkup(React.createElement(MiscControls, {
    params: { ...params, ...p }, nodeScale: { ...DEFAULT_NODE_SCALE, ...s },
    onParamChange: noop, onNodeScaleChange: noop, onActiveSection: noop,
  }))
}
const curves = (html: string) => [...html.matchAll(/<polyline points="([^"]*)"/g)].map(m => m[1])
const popIds = (html: string) => [...html.matchAll(/data-pop-id="([^"]+)"/g)].map(m => m[1]).sort()

describe('the Misc tab', () => {
  const html = misc()

  it('marks every symbol in its equations with the slider it names', () => {
    expect(html.split('gv-ctl-formula-value').length - 1).toBe(6)
    expect(popIds(html)).toEqual(
      ['alphaDecay', 'alphaMin', 'baseMul', 'maxZoomMul', 'minZoomMul', 'velocityDecay'])
  })

  it('marks the tick the simulation stops at', () => {
    expect(html).toContain('200 ticks')
    expect(misc({ alphaDecay: 0.01 })).toContain('100 ticks')
  })

  it('moves the dynamics curve with cooling and the scaling curve with the grow cap', () => {
    const [dynamics, scaling] = curves(html)
    const [cooled] = curves(misc({ alphaDecay: 0.01 }))
    const [, capped] = curves(misc({}, { maxZoomMul: 1 }))
    expect(cooled).not.toBe(dynamics)
    expect(capped).not.toBe(scaling)
  })

  it('draws node scale flat below the shrink floor and above the grow cap', () => {
    const ys = curves(html)[1].split(' ').map(p => Number(p.split(',')[1]))
    expect(ys[0]).toBe(ys[1])
    expect(ys[2]).toBe(ys[3])
    expect(ys[2]).toBeLessThan(ys[1])
  })
})
