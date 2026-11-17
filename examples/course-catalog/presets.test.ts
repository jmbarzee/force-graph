import { describe, expect, it } from 'vitest'
import { createTuning, tuningToJSON } from '@jmbarzee/force-graph'
import { PRESETS } from './App'
import { taxonomy } from './taxonomy'

describe('the catalog presets', () => {
  it('each read on the catalog taxonomy, and each but Balanced retunes it', () => {
    const read = PRESETS.map(p => JSON.stringify(tuningToJSON(createTuning(p.tuning, taxonomy))))
    expect(read[0]).toBe(JSON.stringify(tuningToJSON(createTuning({}, taxonomy))))
    expect(new Set(read).size).toBe(PRESETS.length)
  })
})
