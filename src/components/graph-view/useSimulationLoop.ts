// useSimulationLoop — drives the simulation each frame and reacts to filter
// changes. Owns the requestAnimationFrame physics loop (tick + the held
// framings' tick + fps + stability stop), the hover tooltip re-render
// tick, and the seed-on-type-change / reheat-on-file-change effects. It consumes
// the sim instance, the visible subgraph, and the camera's framing as
// inputs (the explicit data links) rather than owning any of them.

import type { FilterState } from '../../filter/types'
import { selectionFor, selectionsEqual } from '../../filter/types'
import { foldReheatPolicy } from '../../graph/axis'
import type { ResolvedAxisDescriptor } from '../../graph/axis'
import { passesFilter } from './visibleGraph'
import React from 'react'
import type { Simulation } from '../../graph/simulation'
import type { FrameRequest } from './frame'
import type { Taxonomy } from '../../graph/taxonomy'

export interface SimulationLoopParams {
  simRef: React.MutableRefObject<Simulation | null>
  running: boolean
  setRunning: React.Dispatch<React.SetStateAction<boolean>>
  visibleIds: Set<string>
  downstreamScores: Map<string, number>
  filter: FilterState
  /** The axes the view filters on — its chain; a change elsewhere in the filter moves nothing here. */
  axes: readonly ResolvedAxisDescriptor[]
  hoveredNodeId: string | null
  selectedNodeId: string | null
  requestFrame: (request: FrameRequest) => void
  tickFrame: (alpha: number) => void
  releaseFrame: () => void
  taxonomy: Taxonomy
}

export function useSimulationLoop({
  simRef, running, setRunning,
  visibleIds, downstreamScores,
  filter, axes,
  hoveredNodeId, selectedNodeId,
  requestFrame, tickFrame, releaseFrame, taxonomy,
}: SimulationLoopParams): { fps: number } {
  // Frame-rate indicator. Updated ~2×/sec from the loop.
  const [fps, setFps] = React.useState(0)
  const fpsTrackRef = React.useRef({ frames: 0, lastStamp: 0 })

  // Physics animation loop. Decoupled from React rendering: the canvas has its
  // own RAF draw loop reading live SimNode.x/.y through a ref, so the physics
  // tick does NOT trigger a React re-render each frame. We only touch React state
  // for one-shot events (a held framing, stability, FPS).
  React.useEffect(() => {
    if (!running) return
    let frameId = 0
    fpsTrackRef.current = { frames: 0, lastStamp: 0 }

    const loop = () => {
      const sim = simRef.current
      if (!sim) return

      sim.tick(visibleIds, downstreamScores)

      tickFrame(sim.alpha)

      // FPS meter — recompute ~2×/sec; setFps only fires on change.
      const now = performance.now()
      const track = fpsTrackRef.current
      track.frames++
      if (track.lastStamp === 0) track.lastStamp = now
      const elapsed = now - track.lastStamp
      if (elapsed >= 500) {
        const measured = Math.round((track.frames * 1000) / elapsed)
        setFps(prev => (prev === measured ? prev : measured))
        track.frames = 0
        track.lastStamp = now
      }

      if (sim.isStable()) {
        releaseFrame()
        setRunning(false)
        return
      }

      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => { if (frameId) cancelAnimationFrame(frameId) }
  }, [running, visibleIds, selectedNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // While hovering a node during a running sim, re-render at ~10fps so the DOM
  // tooltip tracks the moving node (canvas nodes update at 60fps via refs).
  const [, setTooltipTick] = React.useState(0)
  React.useEffect(() => {
    if (!running || !hoveredNodeId) return
    const id = window.setInterval(() => setTooltipTick(t => t + 1), 100)
    return () => window.clearInterval(id)
  }, [running, hoveredNodeId])

  // React to a filter change, per axis, using that axis's declared reheat policy.
  //
  // This was two hand-written effects — one for types, one for files — and their
  // differences were the trap. They differ on three of four fields, and the
  // one they AGREE on is the one a careless generalisation drops: both call
  // `setRunning(true)`, and omitting it leaves the canvas frozen after every
  // toggle. Writing `resume` out per axis is what keeps that a decision rather
  // than an omission.
  //
  // "Newly revealed" is now asked of the whole filter rather than of one axis:
  // a node counts as revealed if it passes now and did not before. The old
  // version tested only the type axis, so a node revealed by a *file* change was
  // never seeded even when the type axis had also moved in the same commit.
  const prevFilter = React.useRef(filter)
  React.useEffect(() => {
    const prev = prevFilter.current
    if (prev === filter) return
    const sim = simRef.current
    if (!sim) { prevFilter.current = filter; return }

    const { alpha, seedRevealed, refit, resume } = foldReheatPolicy(
      axes.filter(
        dim => !selectionsEqual(selectionFor(prev, dim.id), selectionFor(filter, dim.id)),
      ),
    )

    if (alpha > 0) {
      if (seedRevealed) {
        for (const node of sim.nodes) {
          if (!passesFilter(node, filter, taxonomy, axes)) continue
          if (passesFilter(node, prev, taxonomy, axes)) continue
          let ancestorId = node.parentId
          while (ancestorId) {
            const ancestor = sim.getNode(ancestorId)
            if (!ancestor) break
            if (passesFilter(ancestor, filter, taxonomy, axes)) {
              sim.seedAt(node.id, ancestor.x, ancestor.y)
              break
            }
            ancestorId = ancestor.parentId
          }
        }
      }
      sim.reheat(alpha)
      if (resume) setRunning(true)
      if (refit) requestFrame({ ids: sim.nodes.map(n => n.id), when: 'warm', hold: true })
    }
    prevFilter.current = filter
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  return { fps }
}
