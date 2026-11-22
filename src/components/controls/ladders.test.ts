import { describe, expect, it } from 'vitest'
import { alikeShift, laddersOn, rowsOf } from './ladders'
import { createTaxonomy } from '../../graph/taxonomy'
import { styleIdentityMapping } from '../../graph/simulation'
import { createAxisMapping } from '../../graph/axis'
import type { ValueSpec } from '../../graph/shapes'

const style = (id: string, ladder?: string): ValueSpec => ({
  id, label: id, ladder,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
})
// `top` and `bottom` are one ladder with `middle` between them.
const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [style('top', 'tier'), style('middle'), style('bottom', 'tier')] })
const mapping = styleIdentityMapping(taxonomy)
const all = ['top', 'middle', 'bottom']

describe('laddersOn', () => {
  it('keeps the rungs in declaration order, across a value between them', () => {
    expect(laddersOn(taxonomy, mapping, all)).toEqual([{ id: 'tier', rungs: ['top', 'bottom'] }])
    expect(laddersOn(taxonomy, mapping, ['bottom', 'top'])).toEqual([{ id: 'tier', rungs: ['top', 'bottom'] }])
  })

  it('draws no ladder with fewer than two rungs shown', () => {
    expect(laddersOn(taxonomy, mapping, ['top', 'middle'])).toEqual([])
  })

  it('draws none on a mapping that does not bucket the style axis by identity', () => {
    const other = createAxisMapping({ id: 'm', label: 'm', axis: 'team', buckets: all.map(id => ({ id, label: id, abbreviation: id, values: [id] })) })
    expect(laddersOn(taxonomy, other, all)).toEqual([])
    const merged = createAxisMapping({ id: 'm', label: 'm', axis: 'kind', buckets: [
      { id: 'top', label: 'top', abbreviation: 'top', values: ['top', 'middle'] },
      { id: 'bottom', label: 'bottom', abbreviation: 'bottom', values: ['bottom'] },
    ] })
    expect(laddersOn(taxonomy, merged, ['top', 'bottom'])).toEqual([])
  })
})

describe('rowsOf', () => {
  const ladders = laddersOn(taxonomy, mapping, all)

  it('sits a ladder where its first rung would, its later rungs with it', () => {
    expect(rowsOf(all, ladders, new Set())).toEqual([
      { kind: 'ladder', ladder: ladders[0], collapsed: false },
      { kind: 'bucket', id: 'middle' },
    ])
  })

  it('marks a ladder collapsed when its id is', () => {
    expect(rowsOf(all, ladders, new Set(['tier']))[0]).toEqual({ kind: 'ladder', ladder: ladders[0], collapsed: true })
  })

  it('is one row per bucket when no ladder is drawn', () => {
    expect(rowsOf(all, [], new Set())).toEqual(all.map(id => ({ kind: 'bucket', id })))
  })
})

describe('alikeShift', () => {
  const bounds = [{ value: 10, lo: 0, hi: 100 }, { value: 90, lo: 0, hi: 100 }]

  it('passes a shift that keeps every value in range', () => {
    expect(alikeShift(5, bounds)).toBe(5)
  })

  it('stops at the edge the first value reaches, either way', () => {
    expect(alikeShift(30, bounds)).toBe(10)
    expect(alikeShift(-30, bounds)).toBe(-10)
  })

  it('stops a min before it passes its own band’s max', () => {
    // Two bands' mins, each bounded by its own max less a step.
    const mins = [{ value: -100, lo: -600, hi: 0 - 10 }, { value: 50, lo: -600, hi: 80 - 10 }]
    expect(alikeShift(100, mins)).toBe(20)
  })
})
