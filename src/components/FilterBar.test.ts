import { describe, expect, it } from 'vitest'
import { axesOpenedBy, firstLine } from './FilterBar'
import type { FilterState } from '../filter/types'

describe('firstLine', () => {
  it('counts the items that wrap past the first line, and measures to its lowest', () => {
    // A centred label, then chips 25 high on lines 31 apart.
    const items = [{ top: 4, bottom: 21 }, { top: 0, bottom: 25 }, { top: 0, bottom: 25 }, { top: 31, bottom: 56 }, { top: 62, bottom: 87 }]
    expect(firstLine(items)).toEqual({ height: 25, rest: 2 })
  })

  it('has nothing to collapse in an empty row', () => {
    expect(firstLine([])).toEqual({ height: 0, rest: 0 })
  })
})

describe('axesOpenedBy', () => {
  const before: FilterState = new Map([['team', new Set(['a'])], ['region', new Set()]])
  const after: FilterState = new Map([['team', new Set(['a', 'b'])], ['region', new Set(['north'])]])

  it('opens every axis a change from outside the bar touched', () => {
    expect(axesOpenedBy(before, after, [])).toEqual(['team', 'region'])
  })

  it('leaves the axis the bar clicked as the user has it', () => {
    expect(axesOpenedBy(before, after, ['team'])).toEqual(['region'])
  })

  it('opens nothing when the selections are unchanged', () => {
    expect(axesOpenedBy(before, new Map(before), [])).toEqual([])
  })
})
