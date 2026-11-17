import { describe, expect, it } from 'vitest'
import { NEUTRAL_STROKE, weighted } from './shapes'

describe('weighted', () => {
  it('is the same stroke with no weight, or one not finite', () => {
    expect(weighted(NEUTRAL_STROKE, {})).toBe(NEUTRAL_STROKE)
    expect(weighted(NEUTRAL_STROKE, { weight: NaN })).toBe(NEUTRAL_STROKE)
  })

  it('widens by 1 + weight, clamped to double', () => {
    expect(weighted(NEUTRAL_STROKE, { weight: 0.5 }).width).toBeCloseTo(1.8)
    expect(weighted(NEUTRAL_STROKE, { weight: 1.5 }).width).toBeCloseTo(2.4)
  })
})
