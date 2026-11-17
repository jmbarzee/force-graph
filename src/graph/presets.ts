// Named tunings: the control panel's preset row. A preset is a label over a
// `TuningJSON`; here is what each reads as on a taxonomy, which one the
// tuning now is, and the tween that carries one tuning to another. Like
// `tuning.ts`, its declaration names only the public tuning types: the
// opening is by value.

import type { Graph } from './model'
import { retunedFor } from './simulation'
import type { Taxonomy } from './taxonomy'
import { createTuning } from './tuning'
import type { Tuning, TuningJSON } from './tuning'
import { makeTuning, openTuning, tuningsEqual, TuningJSONError } from './tuning-internal'

/**
 * A named tuning the control panel offers. Chosen, the tuning becomes
 * `createTuning(tuning, taxonomy)`: a part it leaves out returns to the
 * taxonomy's default, except the node scale, kept unless it names `nodeScale`.
 */
export interface TuningPreset {
  /** What the preset row lists. */
  label: string
  /** The tuning, read over the taxonomy's defaults. */
  tuning: TuningJSON
}

/** The library's presets, `GraphView`'s `presets` default. None names an axis or a scalar, so every taxonomy reads them. */
export const TUNING_PRESETS: readonly TuningPreset[] = [
  { label: 'Balanced', tuning: {} },
  { label: 'Tight clusters', tuning: { forces: { pullMultiplier: 1.2, distanceMultiplier: 0.05, pushMultiplier: 0.2, gravityCenter: 0.08 } } },
  { label: 'Spread out', tuning: { forces: { pushMultiplier: 0.9, distanceMultiplier: 0.2, pullMultiplier: 0.4, gravityCenter: 0.02 } } },
  { label: 'Free form', tuning: { forces: { gravityX: 0, gravityY: 0, gravityCenter: 0.06 } } },
  { label: 'Rings', tuning: { forces: { radial: true, gravityY: 0.2 } } },
]

/** A preset as the panel lists it: its reading on the taxonomy, forces retuned for the graph, or why it has none. */
export type PresetChoice =
  | { label: string; tuning: Tuning; keepsScale: boolean }
  | { label: string; reason: string }

/** Each preset read on the taxonomy, its forces retuned for the graph; one `createTuning` refuses carries its message instead. */
export function presetChoices(presets: readonly TuningPreset[], taxonomy: Taxonomy, graph: Graph): PresetChoice[] {
  return presets.map(({ label, tuning }) => {
    try {
      const read = openTuning(createTuning(tuning, taxonomy))
      return { label, tuning: makeTuning(retunedFor(read.forces, taxonomy, graph), read.nodeScale), keepsScale: tuning.nodeScale === undefined }
    } catch (e) {
      if (e instanceof TuningJSONError) return { label, reason: e.message }
      throw e
    }
  })
}

/** Where choosing a preset takes `current`: its forces, and its node scale or `current`'s. */
export function presetTarget(choice: Extract<PresetChoice, { tuning: Tuning }>, current: Tuning): Tuning {
  const read = openTuning(choice.tuning)
  return makeTuning(read.forces, (choice.keepsScale ? openTuning(current) : read).nodeScale)
}

/** The index of the preset `current` is, or -1: custom. */
export function presetIndex(choices: readonly PresetChoice[], current: Tuning): number {
  return choices.findIndex(c => 'tuning' in c && tuningsEqual(presetTarget(c, current), current))
}

/** The tuning `t` of the way from `from` to `to`: every number interpolated, every other part `to`'s. */
export function tweenTuning(from: Tuning, to: Tuning, t: number): Tuning {
  const mix = <T extends object>(a: T, b: T): T => {
    const out = { ...b }
    for (const key of Object.keys(b) as (keyof T)[]) {
      const u = a[key], v = b[key]
      // Weighted, not u + (v − u)·t, so each endpoint is exact.
      if (typeof u === 'number' && typeof v === 'number') out[key] = (u * (1 - t) + v * t) as T[keyof T]
    }
    return out
  }
  const a = openTuning(from), b = openTuning(to)
  return makeTuning(mix(a.forces, b.forces), mix(a.nodeScale, b.nodeScale))
}
