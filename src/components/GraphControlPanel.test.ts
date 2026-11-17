import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MiscControls, PresetRow } from './GraphControlPanel'
import { presetChoices, TUNING_PRESETS } from '../graph/presets'
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

/** Each curve's points and marks as fractions of its frame: x from the left, y from the bottom. */
function plots(html: string) {
  return [...html.matchAll(/viewBox="0 0 (\S+) (\S+)".*?<\/svg>/g)].map(([svg, w, h]) => {
    const fx = (v: string) => Number(v) / Number(w)
    const fy = (v: string) => 1 - Number(v) / Number(h)
    const points = svg.match(/<polyline points="([^"]*)"/)![1].split(' ').map(p => p.split(','))
    return {
      points: points.map(([x, y]) => [fx(x), fy(y)] as const),
      marks: [...svg.matchAll(/<line x1="([^"]+)"/g)].map(m => fx(m[1])),
    }
  })
}
type Drawn = ReturnType<typeof plots>[number]
const popIds = (html: string) => [...html.matchAll(/data-pop-id="([^"]+)"/g)].map(m => m[1]).sort()
const inMiddleHalf = (f: number) => expect(f >= 0.25 && f <= 0.75, `${f} in [0.25, 0.75]`).toBe(true)
const movesVisibly = (a: number, b: number) => expect(Math.abs(a - b)).toBeGreaterThan(0.05)

describe('the Misc tab', () => {
  const html = misc()
  const [dynamics, scaling] = plots(html)
  const foot = (p: Drawn) => p.points[p.points.length - 1][1]
  const capRun = (p: Drawn) => p.points[3][1]

  it('marks every symbol in its equations with the slider it names', () => {
    expect(html.split('gv-ctl-formula-value').length - 1).toBe(6)
    expect(popIds(html)).toEqual(
      ['alphaDecay', 'alphaMin', 'baseMul', 'maxZoomMul', 'minZoomMul', 'velocityDecay'])
    expect(html).toMatch(/clamp\(zoom, <span[^>]*>shrink floor<\/span>, <span/)
  })

  it('marks the tick the simulation stops at', () => {
    expect(html).toContain('200 ticks')
    expect(misc({ alphaDecay: 0.01 })).toContain('100 ticks')
  })

  it('lands the defaults in the middle half of each plot', () => {
    inMiddleHalf(dynamics.marks[0])
    inMiddleHalf(foot(dynamics))
    scaling.marks.forEach(inMiddleHalf)
    inMiddleHalf(scaling.points[0][1])
    inMiddleHalf(capRun(scaling))
  })

  it('moves the stop with cooling, its foot with threshold, and the top run with the grow cap', () => {
    movesVisibly(plots(misc({ alphaDecay: 0.01 }))[0].marks[0], dynamics.marks[0])
    movesVisibly(foot(plots(misc({ alphaMin: 0.001 }))[0]), foot(dynamics))
    movesVisibly(capRun(plots(misc({}, { maxZoomMul: 1 }))[1]), capRun(scaling))
  })

  it('draws node scale flat below the shrink floor and above the grow cap', () => {
    const ys = scaling.points.map(([, y]) => y)
    expect(ys[0]).toBe(ys[1])
    expect(ys[2]).toBe(ys[3])
    expect(ys[2]).toBeGreaterThan(ys[1])
  })
})

describe('the preset row', () => {
  const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [] })
  const choices = presetChoices([...TUNING_PRESETS, { label: 'By credit', tuning: { forces: { bandY: { scalar: 'credit' } } } }], taxonomy)
  const row = (selected: number) => renderToStaticMarkup(React.createElement(PresetRow, { menu: { choices, selected }, onPreset: noop }))
  const options = (html: string) => [...html.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(([, attrs, text]) => ({ text, disabled: attrs.includes('disabled'), selected: attrs.includes('selected') }))

  it('lists every preset in order, one the taxonomy refuses disabled with why', () => {
    expect(options(row(0)).map(o => [o.text, o.disabled])).toEqual([
      ...TUNING_PRESETS.map(p => [p.label, false]),
      ['By credit — forces.bandY.scalar: no scalar &quot;credit&quot;', true],
    ])
    expect(row(0)).toContain('title="forces.bandY.scalar: no scalar &quot;credit&quot;"')
  })

  it('selects the preset the tuning is, else a disabled custom', () => {
    expect(options(row(2)).filter(o => o.selected).map(o => o.text)).toEqual(['Spread out'])
    expect(options(row(-1))[0]).toEqual({ text: 'custom', disabled: true, selected: true })
  })

  it('is not drawn without presets', () => {
    expect(renderToStaticMarkup(React.createElement(PresetRow, { menu: { choices: [], selected: -1 }, onPreset: noop }))).toBe('')
  })
})
