import { describe, expect, it } from 'vitest'
import { createTaxonomy } from './taxonomy'
import { createTuning, tuningFromJSON, tuningToJSON } from './tuning'
import type { TuningJSON } from './tuning'
import { defaultTuningFor, tuningsEqual } from './tuning-internal'

const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [{ id: 'service', label: 'service', color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } } }],
  filterAxes: [{ id: 'kind', label: 'kind', emptyMeans: 'none' }, { id: 'team', label: 'team', emptyMeans: 'all' }],
})

// A host's mistake, as it would arrive from JavaScript or parsed JSON.
const mistaken = (json: unknown) => json as TuningJSON

describe('createTuning', () => {
  it('answers the taxonomy\'s default tuning for {}', () => {
    expect(tuningsEqual(createTuning({}, taxonomy), defaultTuningFor(taxonomy))).toBe(true)
  })

  it('reads every part it is given over the defaults', () => {
    const json: TuningJSON = {
      forces: {
        pair: { axis: 'team', push: { a: { charge: 5, coreRadius: 2 } } },
        bandX: { axis: 'team', overrides: { a: { min: 0.1, max: 0.2 } } },
        bandY: { scalar: 'depth', span: { zero: 1, one: 0 } },
        gravityTopological: 0.4,
        radial: true,
      },
      nodeScale: { baseMul: 2 },
    }
    const out = tuningToJSON(createTuning(json, taxonomy))
    expect(out.forces).toMatchObject(json.forces!)
    expect(out.nodeScale?.baseMul).toBe(2)
  })

  it.each([
    ['tuning: not an object', []],
    ['forces: not an object', { forces: 1 }],
    ['forces.bandy: no such field', { forces: { bandy: { axis: 'kind' } } }],
    ['forces.topologicalEnabled: no such field', { forces: { topologicalEnabled: true } }],
    ['forces.gravityX: not a finite number', { forces: { gravityX: 'strong' } }],
    ['forces.radial: not a boolean', { forces: { radial: 1 } }],
    ['forces.pair.axis: no axis "teem"', { forces: { pair: { axis: 'teem' } } }],
    ['forces.pair.push.a.charge: not a finite number', { forces: { pair: { axis: 'kind', push: { a: { charge: null, coreRadius: 1 } } } } }],
    ['forces.bandX.axis: not an axis id', { forces: { bandX: {} } }],
    ['forces.bandX.overrides.a.max: not a finite number', { forces: { bandX: { axis: 'kind', overrides: { a: { min: 0 } } } } }],
    ['forces.bandY.scalar: no scalar "credit"', { forces: { bandY: { scalar: 'credit' } } }],
    ['forces.bandY.span.one: not a finite number', { forces: { bandY: { scalar: 'depth', span: { zero: 0 } } } }],
    ['nodeScale.baseMul: not a finite number', { nodeScale: { baseMul: Infinity } }],
  ])('throws "%s"', (message, json) => {
    expect(() => createTuning(mistaken(json), taxonomy)).toThrow(message)
  })
})

describe('tuningFromJSON', () => {
  it('reads back what tuningToJSON wrote', () => {
    const tuning = createTuning({ forces: { bandY: { scalar: 'reach' }, gravityTopological: 0.3 } }, taxonomy)
    const back = tuningFromJSON(JSON.parse(JSON.stringify(tuningToJSON(tuning))), taxonomy)
    expect(back && tuningsEqual(back, tuning)).toBe(true)
  })

  it.each([
    ['not an object', 'tuning'],
    ['a part not its shape', { forces: { gravityX: 'strong' } }],
    ['a layout axis with neither axis nor scalar', { forces: { bandX: {} } }],
    ['a node scale not its shape', { nodeScale: { baseMul: null } }],
  ])('answers undefined, never a throw, for %s', (_, value) => {
    expect(tuningFromJSON(value, taxonomy)).toBeUndefined()
  })

  it('passes over a field it has no place for and an axis or scalar the taxonomy does not name, for the view to retune', () => {
    const value = { forces: { topologicalEnabled: true, pair: { axis: 'teem' }, bandY: { scalar: 'credit' } } }
    expect(tuningFromJSON(value, taxonomy)).toBeDefined()
  })
})
