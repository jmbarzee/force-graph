import { describe, expect, it } from 'vitest'
import { hueOf, pairOf, PALETTE } from './scheme'

describe('hueOf', () => {
  it('serves a string in both themes, a hue as given, and absent its palette slot', () => {
    expect(hueOf('#123456', 0)).toEqual({ light: '#123456', dark: '#123456' })
    expect(hueOf({ light: '#000000', dark: '#ffffff' }, 0)).toEqual({ light: '#000000', dark: '#ffffff' })
    expect(hueOf(undefined, 12)).toBe(PALETTE[2])
  })
})

describe('pairOf', () => {
  it('fills with the hue and borders it darker in both themes', () => {
    expect(pairOf({ light: '#ff8000', dark: 'rgb(100, 200, 50)' })).toEqual({
      light: { fill: '#ff8000', border: '#994d00' },
      dark: { fill: 'rgb(100, 200, 50)', border: '#3c781e' },
    })
  })
})
