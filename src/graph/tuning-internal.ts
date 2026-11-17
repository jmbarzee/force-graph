// The tuning opened: what the view reads and writes, and the JSON reader that
// builds the engine's tunings. Nothing here is on the surface: `ForceParams`
// and the force kernels are not part of any surface (DESIGN.md, "The
// forces"), and `tuning.ts` — the public half — calls in by value only, so its
// declaration reaches none of this.

import type { AxisId } from './axis'
import { identityMapping } from './axis'
import { isFiniteNumber, isPlainRecord } from '../json'
import type { TuningJSON, Tuning, BandAxisJSON } from './tuning'
import type { NodeScaleParams } from './node-scale'
import { DEFAULT_NODE_SCALE } from './node-scale'
import { isScalarTuning } from './scalar'
import type { SpringPhysics } from './shapes'
import type { BandRange, ForceParams, LayoutTuning, PairTuning, PushPhysics } from './simulation'
import { defaultParamsFor, namerFor, styleIdentityMapping } from './simulation'
import type { Taxonomy } from './taxonomy'
import { engineOf } from './taxonomy'

/** The tuning opened: the forces and the node scale. */
export interface OpenTuning extends Tuning {
  readonly forces: ForceParams
  readonly nodeScale: NodeScaleParams
}

/** A tuning from its parts — the one place the brand is asserted: every `Tuning` a host holds was made here. */
export function makeTuning(forces: ForceParams, nodeScale: NodeScaleParams): OpenTuning {
  return { forces, nodeScale } as OpenTuning
}

/** The tuning opened for the view. Total: every `Tuning` is one `makeTuning` made. */
export function openTuning(tuning: Tuning): OpenTuning {
  return tuning as OpenTuning
}

/** The tuning a view starts from: the taxonomy's default forces and the default node scale. */
export function defaultTuningFor(taxonomy: Taxonomy): OpenTuning {
  return makeTuning(defaultParamsFor(taxonomy), DEFAULT_NODE_SCALE)
}

const NUMBER_FIELDS = [
  'pushMultiplier', 'coreRadiusMultiplier', 'chargeExponent',
  'pullMultiplier', 'distanceMultiplier', 'linkExponent',
  'gravityX', 'gravityY', 'gravityBandExp', 'gravityTopological', 'gravityTopologicalExp', 'gravityCenter',
  'alphaDecay', 'alphaMin', 'velocityDecay',
] as const
const BOOLEAN_FIELDS = ['radial'] as const
const SCALE_FIELDS = ['baseMul', 'minZoomMul', 'maxZoomMul'] as const

/** The forces as plain data: every number and switch, each layout axis by its axis or scalar, each override by its bucket. */
export function forcesToJSON(forces: ForceParams): NonNullable<TuningJSON['forces']> {
  const band = (t: LayoutTuning): BandAxisJSON =>
    isScalarTuning(t)
      ? { scalar: t.scalar, ...(t.span ? { span: { ...t.span } } : {}) }
      : { axis: t.mapping.axis, ...(t.overrides.size > 0 ? { overrides: Object.fromEntries(t.overrides) } : {}) }
  const out: NonNullable<TuningJSON['forces']> = {
    pair: {
      axis: forces.pair.mapping.axis,
      ...(forces.pair.push.size > 0 ? { push: Object.fromEntries(forces.pair.push) } : {}),
      ...(forces.pair.spring.size > 0 ? { spring: Object.fromEntries(forces.pair.spring) } : {}),
    },
    bandX: band(forces.bandX),
    bandY: band(forces.bandY),
  }
  for (const key of NUMBER_FIELDS) out[key] = forces[key]
  for (const key of BOOLEAN_FIELDS) out[key] = forces[key]
  return out
}

/** A part of a tuning's JSON that is not what it should be, by its path: what `createTuning` throws, and `tuningFromJSON` reads as undefined. */
export class TuningJSONError extends Error {
  override name = 'TuningJSONError'
}

/**
 * A tuning's JSON over the taxonomy's defaults. Every reader throws a
 * `TuningJSONError` on a part that is not its shape. Strict, it also throws
 * on a field the JSON has no place for, an axis the taxonomy does not declare
 * and a scalar it does not know — a host's own hand; lenient, those pass, as
 * stored data written before a rename must.
 */
export function readTuning(value: unknown, taxonomy: Taxonomy, strict: boolean): OpenTuning {
  const read = new Reader(taxonomy, strict)
  const json = read.record(value, '', ['forces', 'nodeScale'])
  const base = defaultTuningFor(taxonomy)
  return makeTuning(
    json.forces === undefined ? base.forces : read.forces(json.forces, base.forces),
    json.nodeScale === undefined ? base.nodeScale : read.nodeScale(json.nodeScale, base.nodeScale),
  )
}

const at = (path: string, key: string) => (path ? `${path}.${key}` : key)

class Reader {
  constructor(private readonly taxonomy: Taxonomy, private readonly strict: boolean) {}

  fail(path: string, problem: string): never {
    throw new TuningJSONError(`${path || 'tuning'}: ${problem}`)
  }

  record(value: unknown, path: string, fields?: readonly string[]): Record<string, unknown> {
    if (!isPlainRecord(value)) this.fail(path, 'not an object')
    if (this.strict && fields) for (const key of Object.keys(value)) if (!fields.includes(key)) this.fail(at(path, key), 'no such field')
    return value
  }

  number(value: unknown, path: string): number {
    if (!isFiniteNumber(value)) this.fail(path, 'not a finite number')
    return value
  }

  forces(value: unknown, base: ForceParams): ForceParams {
    const json = this.record(value, 'forces', [...NUMBER_FIELDS, ...BOOLEAN_FIELDS, 'pair', 'bandX', 'bandY'])
    const forces = { ...base }
    for (const key of NUMBER_FIELDS) if (json[key] !== undefined) forces[key] = this.number(json[key], at('forces', key))
    for (const key of BOOLEAN_FIELDS) {
      const v = json[key]
      if (v === undefined) continue
      if (typeof v !== 'boolean') this.fail(at('forces', key), 'not a boolean')
      forces[key] = v
    }
    if (json.pair !== undefined) forces.pair = this.pair(json.pair, 'forces.pair')
    for (const key of ['bandX', 'bandY'] as const) if (json[key] !== undefined) forces[key] = this.band(json[key], at('forces', key))
    return forces
  }

  nodeScale(value: unknown, base: NodeScaleParams): NodeScaleParams {
    const json = this.record(value, 'nodeScale', SCALE_FIELDS)
    const nodeScale = { ...base }
    for (const key of SCALE_FIELDS) if (json[key] !== undefined) nodeScale[key] = this.number(json[key], at('nodeScale', key))
    return nodeScale
  }

  /** The mapping a stored axis names: the style axis's from the taxonomy; another axis's without buckets, for the view to complete from the graph. */
  mapping(value: unknown, path: string) {
    if (typeof value !== 'string') this.fail(path, 'not an axis id')
    const style = this.taxonomy.styleAxis()
    if (value === style) return styleIdentityMapping(this.taxonomy)
    if (this.strict && !this.taxonomy.axisFor(value)) this.fail(path, `no axis "${value}"`)
    return identityMapping(namerFor(this.taxonomy, value as AxisId), [])
  }

  pair(value: unknown, path: string): PairTuning {
    const json = this.record(value, path, ['axis', 'push', 'spring'])
    const mapping = this.mapping(json.axis, at(path, 'axis'))
    const push = new Map<string, PushPhysics>()
    if (json.push !== undefined) {
      for (const [bucket, physics] of Object.entries(this.record(json.push, at(path, 'push')))) {
        const p = at(at(path, 'push'), bucket)
        const entry = this.record(physics, p, ['charge', 'coreRadius'])
        push.set(bucket, { charge: this.number(entry.charge, at(p, 'charge')), coreRadius: this.number(entry.coreRadius, at(p, 'coreRadius')) })
      }
    }
    const spring = new Map<string, SpringPhysics>()
    if (json.spring !== undefined) {
      for (const [id, physics] of Object.entries(this.record(json.spring, at(path, 'spring')))) {
        const p = at(at(path, 'spring'), id)
        const entry = this.record(physics, p, ['strength', 'distance'])
        spring.set(id, { strength: this.number(entry.strength, at(p, 'strength')), distance: this.number(entry.distance, at(p, 'distance')) })
      }
    }
    return { mapping, push, spring }
  }

  band(value: unknown, path: string): LayoutTuning {
    const json = this.record(value, path)
    if (this.strict && json.scalar !== undefined && typeof json.scalar !== 'string') this.fail(at(path, 'scalar'), 'not a scalar id')
    if (typeof json.scalar === 'string') {
      this.record(json, path, ['scalar', 'span'])
      const scalar = json.scalar
      if (this.strict && !engineOf(this.taxonomy).scalars.some(sc => sc.id === scalar)) this.fail(at(path, 'scalar'), `no scalar "${scalar}"`)
      if (json.span === undefined) return { scalar }
      const span = this.record(json.span, at(path, 'span'), ['zero', 'one'])
      return { scalar, span: { zero: this.number(span.zero, at(path, 'span.zero')), one: this.number(span.one, at(path, 'span.one')) } }
    }
    this.record(json, path, ['axis', 'overrides'])
    const mapping = this.mapping(json.axis, at(path, 'axis'))
    const overrides = new Map<string, BandRange>()
    if (json.overrides !== undefined) {
      for (const [bucket, band] of Object.entries(this.record(json.overrides, at(path, 'overrides')))) {
        const p = at(at(path, 'overrides'), bucket)
        const entry = this.record(band, p, ['min', 'max'])
        overrides.set(bucket, { min: this.number(entry.min, at(p, 'min')), max: this.number(entry.max, at(p, 'max')) })
      }
    }
    return { mapping, overrides }
  }
}

/** Whether two tunings say the same thing — every layout axis, override, number and switch — so a host that re-reads its tuning from a store each render is not read as a change. */
export function tuningsEqual(a: Tuning, b: Tuning): boolean {
  if (a === b) return true
  const key = (t: Tuning) => { const o = openTuning(t); return JSON.stringify([forcesToJSON(o.forces), o.nodeScale]) }
  return key(a) === key(b)
}
