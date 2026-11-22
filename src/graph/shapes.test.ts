import { describe, expect, it } from 'vitest'
import { NEUTRAL_STROKE, played, weighted } from './shapes'
import { unitWeight } from './model'

describe('weighted', () => {
  it('is the same stroke with no weight, or one not finite', () => {
    expect(weighted(NEUTRAL_STROKE, unitWeight({}))).toBe(NEUTRAL_STROKE)
    expect(weighted(NEUTRAL_STROKE, unitWeight({ weight: NaN }))).toBe(NEUTRAL_STROKE)
  })

  it('widens by 1 + weight, clamped to double', () => {
    expect(weighted(NEUTRAL_STROKE, unitWeight({ weight: 0.5 })).width).toBeCloseTo(1.8)
    expect(weighted(NEUTRAL_STROKE, unitWeight({ weight: 1.5 })).width).toBeCloseTo(2.4)
  })
})

describe('played', () => {
  it('widens by the intensity and scales the alpha by it', () => {
    const at = played(NEUTRAL_STROKE, 0.5)
    expect(at.width).toBeCloseTo(1.8)
    expect(at.alpha).toBeCloseTo(0.35)
  })
})
