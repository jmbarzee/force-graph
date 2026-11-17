// usePresets — the control panel's preset row: each preset's reading on the
// taxonomy, the one the tuning now is, and the tween that carries the tuning
// to a chosen one. The tween's first frame relayouts, as a gravity switch
// does; each later frame is one write, so the host hears every frame as it
// hears a slider drag. Any write the tween did not make — a slider, a retune
// — ends it.

import React from 'react'
import type { Graph } from '../../graph/model'
import { presetChoices, presetIndex, presetTarget, tweenTuning } from '../../graph/presets'
import type { PresetChoice, TuningPreset } from '../../graph/presets'
import type { ForceParams } from '../../graph/simulation'
import type { Taxonomy } from '../../graph/taxonomy'
import type { Tuning } from '../../graph/tuning'
import { makeTuning, openTuning, tuningsEqual } from '../../graph/tuning-internal'

const TWEEN_MS = 400
const easeOut = (t: number) => 1 - (1 - t) ** 3

/** The preset row: every preset as listed, and the index of the one the tuning is, or -1. */
export interface PresetMenu {
  choices: readonly PresetChoice[]
  selected: number
}

export function usePresets(
  presets: readonly TuningPreset[],
  taxonomy: Taxonomy,
  graph: Graph,
  // The tuning as the panel shows it, retuned for this graph.
  current: Tuning,
  // What the last write left, and the writer every frame goes through.
  latest: React.MutableRefObject<Tuning>,
  write: (next: Tuning) => void,
  relayout: (forces: ForceParams) => void,
): { menu: PresetMenu; choose: (index: number) => void } {
  const choices = React.useMemo(() => presetChoices(presets, taxonomy), [presets, taxonomy])
  const selected = React.useMemo(() => presetIndex(choices, current, taxonomy, graph), [choices, current, taxonomy, graph])

  // A preset this taxonomy refuses is said once on the console.
  const warned = React.useRef(new WeakMap<Taxonomy, Set<string>>())
  React.useEffect(() => {
    let seen = warned.current.get(taxonomy)
    if (!seen) warned.current.set(taxonomy, (seen = new Set()))
    for (const c of choices) {
      if (!('reason' in c) || seen.has(c.label)) continue
      seen.add(c.label)
      console.warn(`[graph] the preset "${c.label}" is disabled: ${c.reason}`)
    }
  }, [choices, taxonomy])

  const frame = React.useRef<number | null>(null)
  const stop = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])
  React.useEffect(() => stop, [stop])

  const choose = React.useCallback((index: number) => {
    const choice = choices[index]
    if (!choice || !('tuning' in choice)) return
    stop()
    const from = latest.current
    const to = presetTarget(choice, from, taxonomy, graph)
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      relayout(openTuning(to).forces)
      if (!choice.keepsScale) write(makeTuning(openTuning(latest.current).forces, openTuning(to).nodeScale))
      return
    }
    relayout(openTuning(tweenTuning(from, to, 0)).forces)
    let written = latest.current
    const start = performance.now()
    const step = (now: number) => {
      if (!tuningsEqual(latest.current, written)) { frame.current = null; return }
      const t = Math.min(1, (now - start) / TWEEN_MS)
      written = tweenTuning(from, to, easeOut(t))
      write(written)
      frame.current = t < 1 ? requestAnimationFrame(step) : null
    }
    frame.current = requestAnimationFrame(step)
  }, [choices, taxonomy, graph, latest, write, relayout, stop])

  return { menu: { choices, selected }, choose }
}
