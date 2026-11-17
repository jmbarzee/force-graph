// Curve — a read-only line plot on fixed log–log axes, framed by Plot: what a
// section's sliders do, drawn as they move.

import { Plot } from './Plot'
import './controls.css'

const W = 300
const H = 110

/** An axis's [min, max], both positive. */
export type Span = readonly [number, number]
export interface CurveMark { x: number; label?: string }

/** Where `v` falls on a log axis over `span`, from 0 at min to 1 at max, held to the span. */
const at = (v: number, [lo, hi]: Span) => Math.min(1, Math.max(0, Math.log(v / lo) / Math.log(hi / lo)))

export function Curve({ points, x, y, marks, xLabel, yLabel, ariaLabel }: {
  /** Data-unit [x, y] pairs. */
  points: readonly (readonly [number, number])[]
  x: Span
  y: Span
  marks: readonly CurveMark[]
  xLabel: string
  yLabel: string
  ariaLabel: string
}) {
  const px = (v: number) => at(v, x) * W
  const py = (v: number) => H - at(v, y) * H
  return (
    <Plot yLabel={yLabel} bottom={<div className="gv-ctl-plot-xlabel">{xLabel}</div>}>
      <svg className="gv-ctl-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <rect width={W} height={H} className="gv-ctl-curve-frame" />
        {marks.map((m, i) => {
          const mx = px(m.x)
          // A label reads away from the nearer edge, so it stays in the frame.
          const right = mx < W / 2
          return (
            <g key={i}>
              <line x1={mx} y1={0} x2={mx} y2={H} className="gv-ctl-curve-mark" />
              {m.label && (
                <text x={right ? mx + 3 : mx - 3} y={10} textAnchor={right ? 'start' : 'end'} className="gv-ctl-curve-mark-label">
                  {m.label}
                </text>
              )}
            </g>
          )
        })}
        <polyline
          points={points.map(([a, b]) => `${px(a).toFixed(1)},${py(b).toFixed(1)}`).join(' ')}
          className="gv-ctl-curve-line"
        />
      </svg>
    </Plot>
  )
}
