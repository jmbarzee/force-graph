// Curve — a read-only line plot over a fixed domain, framed by Plot: what a
// section's sliders do, drawn as they move. A mark is a dashed vertical at an x
// worth naming, with an optional label at its top.

import { Plot } from './Plot'
import './controls.css'

const W = 300
const H = 110

export interface CurveMark { x: number; label?: string }

export function Curve({ points, xMax, yMax, marks, xLabel, yLabel, ariaLabel }: {
  /** Data-unit [x, y] pairs, drawn on [0, xMax] × [0, yMax]. */
  points: readonly (readonly [number, number])[]
  xMax: number
  yMax: number
  marks: readonly CurveMark[]
  xLabel: string
  yLabel: string
  ariaLabel: string
}) {
  const px = (x: number) => (x / xMax) * W
  const py = (y: number) => H - (y / yMax) * H
  return (
    <Plot yLabel={yLabel} bottom={<div className="gv-ctl-plot-xlabel">{xLabel}</div>}>
      <svg className="gv-ctl-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <rect width={W} height={H} className="gv-ctl-curve-frame" />
        {marks.map((m, i) => {
          const x = px(m.x)
          // A label reads away from the nearer edge, so it stays in the frame.
          const right = x < W / 2
          return (
            <g key={i}>
              <line x1={x} y1={0} x2={x} y2={H} className="gv-ctl-curve-mark" />
              {m.label && (
                <text x={right ? x + 3 : x - 3} y={10} textAnchor={right ? 'start' : 'end'} className="gv-ctl-curve-mark-label">
                  {m.label}
                </text>
              )}
            </g>
          )
        })}
        <polyline
          points={points.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ')}
          className="gv-ctl-curve-line"
        />
      </svg>
    </Plot>
  )
}
