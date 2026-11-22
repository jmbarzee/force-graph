// The playhead's control: play/pause, a seek over the window's buckets, a
// reset to the whole window, and the time at the playhead.

import React from 'react'
import './Scrubber.css'
import type { TimeWindow } from '../graph/model'
import { useLatest } from './graph-view/useControllable'
import { useStrings } from './graph-view/strings'

/** How long play takes from the playhead to the window's end. */
const PLAY_MS = 10_000
const DAY_MS = 86_400_000

interface ScrubberProps {
  window: TimeWindow
  /** A fractional bucket index in `[0, buckets − 1]`, or null for the whole window. */
  playhead: number | null
  onPlayheadChange: (next: number | null) => void
}

export function Scrubber({ window: span, playhead, onPlayheadChange }: ScrubberProps) {
  const s = useStrings()
  const [playing, setPlaying] = React.useState(false)
  const latest = useLatest({ playhead, onPlayheadChange })
  const end = span.buckets - 1

  // Play runs from the playhead (the start, from the whole window or the
  // end) to the end, then pauses.
  React.useEffect(() => {
    if (!playing) return
    const from = latest.current.playhead
    const p0 = from === null || from >= end ? 0 : from
    let t0: number | undefined
    let id = requestAnimationFrame(function step(t) {
      t0 ??= t
      const f = Math.min(1, (t - t0) / PLAY_MS)
      latest.current.onPlayheadChange(p0 + (end - p0) * f)
      if (f < 1) id = requestAnimationFrame(step)
      else setPlaying(false)
    })
    return () => cancelAnimationFrame(id)
  }, [playing, end, latest])

  const format = React.useMemo(() => {
    const bucket = (span.until - span.since) / span.buckets
    const f = new Intl.DateTimeFormat(undefined, bucket >= DAY_MS ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' })
    return (p: number) => f.format(span.since + p * bucket)
  }, [span.since, span.until, span.buckets])

  const seek = (next: number | null) => {
    setPlaying(false)
    onPlayheadChange(next)
  }

  return (
    <div className="gv-scrubber">
      <button
        className="gv-scrubber-btn"
        onClick={() => setPlaying(p => !p)}
        aria-label={playing ? s.scrubberPause : s.scrubberPlay}
        title={playing ? s.scrubberPause : s.scrubberPlay}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M2 1h3v10H2zM7 1h3v10H7z" /> : <path d="M2 1l9 5-9 5z" />}
        </svg>
      </button>
      <input
        className="gv-scrubber-seek"
        type="range"
        min={0}
        max={end}
        step="any"
        value={playhead ?? 0}
        onChange={e => seek(Number(e.target.value))}
        aria-label={s.scrubberPlayhead}
      />
      <button
        className={`gv-scrubber-btn${playhead === null ? ' active' : ''}`}
        onClick={() => seek(null)}
        aria-label={s.scrubberWhole}
        title={s.scrubberWhole}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M1 2v8M11 2v8M3 6h6" />
        </svg>
      </button>
      <output className="gv-scrubber-time">
        {playhead === null ? `${format(0)} – ${format(span.buckets)}` : format(playhead)}
      </output>
    </div>
  )
}
