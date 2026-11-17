import { describe, expect, it } from 'vitest'
import { createTaxonomy } from './taxonomy'
import { createTuning } from './tuning'
import { defaultTuningFor, makeTuning, openTuning, tuningsEqual } from './tuning-internal'
import { presetChoices, presetIndex, presetTarget, tweenTuning, TUNING_PRESETS } from './presets'
import type { PresetChoice } from './presets'
import { DEFAULT_NODE_SCALE } from './node-scale'

const bare = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [{ id: 'kind', label: 'kind', emptyMeans: 'none' }] })
const empty = { nodes: [], edges: [] }

const readable = (c: PresetChoice) => {
  if (!('tuning' in c)) throw new Error(`${c.label}: ${c.reason}`)
  return c
}

describe('the library presets', () => {
  it('read on a bare taxonomy', () => {
    for (const p of TUNING_PRESETS) expect(() => createTuning(p.tuning, bare), p.label).not.toThrow()
  })
})

describe('presetChoices', () => {
  it('lists a preset naming an axis or scalar the taxonomy lacks with createTuning\'s message', () => {
    const choices = presetChoices([
      { label: 'By team', tuning: { forces: { pair: { axis: 'teem' } } } },
      { label: 'By credit', tuning: { forces: { bandY: { scalar: 'credit' } } } },
      { label: 'Plain', tuning: {} },
    ], bare)
    expect(choices).toEqual([
      { label: 'By team', reason: 'forces.pair.axis: no axis "teem"' },
      { label: 'By credit', reason: 'forces.bandY.scalar: no scalar "credit"' },
      expect.objectContaining({ label: 'Plain', keepsScale: true }),
    ])
  })

  it('lists a malformed preset with why', () => {
    const [c] = presetChoices([{ label: 'Broken', tuning: { forces: { gravityX: 'strong' } } as never }], bare)
    expect(c).toEqual({ label: 'Broken', reason: 'forces.gravityX: not a finite number' })
  })
})

describe('presetIndex', () => {
  const choices = presetChoices(TUNING_PRESETS, bare)
  const index = (t: ReturnType<typeof defaultTuningFor>) => presetIndex(choices, t, bare, empty)

  it('finds the preset the tuning is, whatever the node scale when the preset leaves it out', () => {
    const base = defaultTuningFor(bare)
    expect(index(base)).toBe(0)
    expect(index(makeTuning(base.forces, { ...DEFAULT_NODE_SCALE, baseMul: 2 }))).toBe(0)
    expect(index(openTuning(presetTarget(readable(choices[1]), base, bare, empty)))).toBe(1)
  })

  it('is -1, custom, once a control moves', () => {
    const base = defaultTuningFor(bare)
    expect(index(makeTuning({ ...base.forces, pushMultiplier: 0.7 }, base.nodeScale))).toBe(-1)
  })

  it('keeps the node scale unless the preset names it', () => {
    const current = makeTuning(defaultTuningFor(bare).forces, { ...DEFAULT_NODE_SCALE, baseMul: 2 })
    const [kept, named] = presetChoices([{ label: 'a', tuning: {} }, { label: 'b', tuning: { nodeScale: { baseMul: 0.5 } } }], bare)
    expect(openTuning(presetTarget(readable(kept), current, bare, empty)).nodeScale.baseMul).toBe(2)
    expect(openTuning(presetTarget(readable(named), current, bare, empty)).nodeScale).toEqual({ ...DEFAULT_NODE_SCALE, baseMul: 0.5 })
  })
})

describe('tweenTuning', () => {
  const from = defaultTuningFor(bare)
  const to = openTuning(createTuning({ forces: { pushMultiplier: 1.4, radial: true }, nodeScale: { baseMul: 2 } }, bare))
  const at = (t: number) => openTuning(tweenTuning(from, to, t))

  it('starts at the numbers it is from and lands on the tuning it goes to', () => {
    expect(at(0).forces.pushMultiplier).toBe(from.forces.pushMultiplier)
    expect(at(0).nodeScale).toEqual(from.nodeScale)
    expect(tuningsEqual(at(1), to)).toBe(true)
  })

  it('interpolates every number', () => {
    expect(at(0.5).forces.pushMultiplier).toBeCloseTo((from.forces.pushMultiplier + 1.4) / 2)
    expect(at(0.5).nodeScale.baseMul).toBeCloseTo((from.nodeScale.baseMul + 2) / 2)
  })

  it('jumps every other part to the tuning it goes to', () => {
    expect(at(0).forces.radial).toBe(true)
    expect(at(0).forces.pair).toBe(to.forces.pair)
    expect(at(0).forces.bandY).toBe(to.forces.bandY)
  })
})
