// The tuning as state: the forces and the node scale, as the user set them.
// The view keeps it or the host controls it, like the filter; and it goes to
// a store and back as plain data, like the filter, so a host restores what
// the user tuned and not only where the nodes came to rest.
//
// The state is opaque to a host, and this module's declaration reaches none
// of the engine's types: `ForceParams` and the force kernels are not part of
// any surface (DESIGN.md, "The forces"). The opening is `tuning-internal.ts`,
// called by value from here and the view.

import type { AxisId } from './axis'
import { forcesToJSON, openTuning, readTuning, TuningJSONError } from './tuning-internal'
import type { ScalarSpan } from './scalar'
import type { SpringPhysics } from './shapes'
import type { Taxonomy } from './taxonomy'

declare const TUNING: unique symbol

/**
 * The forces and node scale as the user tuned them: which axis push and pull
 * key on and the per-bucket overrides; the two layout axes with theirs; the
 * multipliers, exponents, gravities and dynamics; the node scale. Opaque to a
 * host: keep it, hand it back as `tuning` or `defaultTuning`, and carry it to
 * a store through `tuningToJSON` and `tuningFromJSON`. The view retunes it
 * for the graph and taxonomy it faces — a tuning on an axis the graph no
 * longer carries returns to the style axis — and reports the result.
 */
export interface Tuning {
  /** Brands the state as the view's: a host keeps one, never builds one. */
  readonly [TUNING]: true
}

/** One layout axis as plain data: a node axis with the bands the user changed, or a computed scalar with the span they dragged. */
export type BandAxisJSON =
  | { axis: AxisId; overrides?: Record<string, { min: number; max: number }> }
  | { scalar: string; span?: ScalarSpan }

/**
 * A tuning as plain data, for a store, a URL or a host's own hand: what
 * `tuningToJSON` writes and `createTuning` and `tuningFromJSON` read. Every
 * part is optional and defaults to the taxonomy's, so a host that wants the
 * view to open on a scalar writes `{ forces: { bandY: { scalar: 'credits' } } }`
 * and nothing else.
 */
export interface TuningJSON {
  /** The forces' tuning. */
  forces?: {
    /** What push and pull key on — an axis, by its values, or one of the taxonomy's `pairMappings` by its id — with the buckets the user changed: each bucket's charge and core radius, each edge type's spring. */
    pair?: ({ axis: AxisId; mapping?: never } | { mapping: string; axis?: never }) & { push?: Record<string, { charge: number; coreRadius: number }>; spring?: Record<string, SpringPhysics> }
    /** The horizontal layout axis. */
    bandX?: BandAxisJSON
    /** The vertical layout axis. */
    bandY?: BandAxisJSON
    /** Scales every charge (repulsion). */
    pushMultiplier?: number
    /** Scales every core radius (the softening of a charge at close range). */
    coreRadiusMultiplier?: number
    /** The power of (distance² + softening) a charge falls off by; 1 is inverse-square. */
    chargeExponent?: number
    /** Scales every spring (attraction). */
    pullMultiplier?: number
    /** Scales every rest length. */
    distanceMultiplier?: number
    /** The power of a spring's displacement; 1 is Hooke's law. */
    linkExponent?: number
    /** The horizontal band gravity; 0 switches it off. */
    gravityX?: number
    /** The vertical band gravity; 0 switches it off. */
    gravityY?: number
    /** The power of the displacement outside a rest band; 1 is linear. */
    gravityBandExp?: number
    /** Radial layout: the vertical axis's bands become rings about the origin. */
    radial?: boolean
    /** The inward pull on a node by its downstream reach; 0 is off. */
    gravityTopological?: number
    /** The power of the reach score; higher makes the biggest hubs pull hardest. */
    gravityTopologicalExp?: number
    /** The pull toward the origin — the baseline when no band axis acts. */
    gravityCenter?: number
    /** How fast the simulation cools per tick. */
    alphaDecay?: number
    /** The temperature the simulation stops at. */
    alphaMin?: number
    /** How much of a node's velocity survives a tick. */
    velocityDecay?: number
  }
  /** The node scale: the size knob, and how small and how large zoom may draw a node. */
  nodeScale?: { baseMul?: number; minZoomMul?: number; maxZoomMul?: number }
}

/** A tuning as plain data — every layout axis by its axis or scalar, every override by its bucket, every number — for a store or a URL. */
export function tuningToJSON(tuning: Tuning): TuningJSON {
  const { forces, nodeScale } = openTuning(tuning)
  return { forces: forcesToJSON(forces), nodeScale: { ...nodeScale } }
}

/**
 * A host's own tuning over the taxonomy's defaults; `createTuning({}, taxonomy)`
 * is the defaults themselves. Throws on a mistake, naming its path: a part
 * that is not its shape or a field the JSON has no place for
 * (`forces.bandy: no such field`), an axis the taxonomy does not declare
 * (`forces.pair.axis: no axis "teem"`), a mapping it does not declare
 * (`forces.pair.mapping: no mapping "rol"`), a scalar it does not know
 * (`forces.bandY.scalar: no scalar "credit"`).
 */
export function createTuning(json: TuningJSON, taxonomy: Taxonomy): Tuning {
  return readTuning(json, taxonomy, true)
}

/**
 * The tuning `tuningToJSON` wrote over the taxonomy's defaults, or undefined
 * when a part present is not its shape: stored data is not trusted to be,
 * and a host falls back to the default rather than to a tuning that means
 * something else. A field it has no place for is passed over, and an axis,
 * mapping or scalar the taxonomy no longer names is the view's to retune. A tuning on an
 * axis other than the style axis is built without buckets and completed by
 * the view when the graph arrives, its overrides kept where their values
 * survive.
 */
export function tuningFromJSON(value: unknown, taxonomy: Taxonomy): Tuning | undefined {
  try {
    return readTuning(value, taxonomy, false)
  } catch (e) {
    if (e instanceof TuningJSONError) return undefined
    throw e
  }
}
