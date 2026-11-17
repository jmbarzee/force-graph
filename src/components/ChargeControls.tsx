// Push-section controls: a 2D "charge map" (the control) and a read-only
// charge-falloff visualization (the read-out), linked by a shared hovered-type
// state (the AxisValue). Thin wrappers over the shared ForceMap2D / ForceCurves
// primitives — this file owns only the charge-specific math (one solid token
// per node type, inverse-power falloff curves).

import React from 'react'
import type { ForceParams } from '../graph/simulation'
import { withPushOverride } from '../graph/simulation'
import { pushForKey } from '../graph/forces'
import type { ResolvedPhysics } from '../graph/forces'

import { useTaxonomy } from './graph-view/useTaxonomy'
import { bucketColor } from './controls/bucketColor'
import { alikeShift, laddersOn, rowsOf } from './controls/ladders'
import { LadderToggles, useCollapsed } from './controls/LadderToggles'
import { ForceMap2D, ForceCurves, CURVE_W, CURVE_H, CURVE_SAMPLES } from './ForceMap'
import type { MapToken, CurveItem } from './ForceMap'

// Shared charge / core-radius ranges. The map plots every node type on these
// common axes so their relative repulsion strength and reach are comparable.
// Charge is stored negative (repulsion) but plotted as magnitude.
export const CHARGE_MAG_MIN = 0
export const CHARGE_MAG_MAX = 1000
export const CHARGE_MAG_STEP = 10
export const CORE_RADIUS_MIN_AXIS = 0
export const CORE_RADIUS_MAX_AXIS = 100
export const CORE_RADIUS_STEP = 1

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const snap = (v: number, step: number) => Math.round(v / step) * step

interface ChargeControlProps {
  params: ForceParams
  /** The dense tables the kernels read, resolved once by the view. */
  resolved: ResolvedPhysics
  /** The push buckets some visible node falls in — the only ones worth a token. */
  present: ReadonlySet<string>
  onParamChange: (patch: Partial<ForceParams>) => void
  // The hovered/active bucket on the push axis — links the map, the curves, and the canvas.
  hoveredBucket: string | null
  onHoverBucket: (b: string | null) => void
}

// ── 2D Charge Map ─────────────────────────────────────────────────────────────
//
// y = charge magnitude, x = core radius. One solid token per bucket of the push
// axis. Dragging sets both the (negative) charge and the core radius at once.
// A ladder's rungs are joined by a chain; collapsed, they are one stacked
// token at their centroid, and dragging it shifts every rung alike.
export function ChargeMap({ params, resolved, present, onParamChange, hoveredBucket, onHoverBucket }: ChargeControlProps) {
  const taxonomy = useTaxonomy()
  const { push } = resolved
  const [collapsed, toggle] = useCollapsed()
  // Only the buckets the visible set holds; the tuning keeps the rest.
  const shown = push.mapping.buckets.filter(b => present.has(b.id))
  const ladders = laddersOn(taxonomy, push.mapping, shown.map(b => b.id))
  const rows = rowsOf(shown.map(b => b.id), ladders, collapsed)
  const at = (id: string) => ({ x: pushForKey(push, id).coreRadius, y: Math.abs(pushForKey(push, id).charge) })
  const color = (id: string) => bucketColor(taxonomy, push.mapping, id)
  const bucketToken = (id: string): MapToken => {
    const b = shown.find(s => s.id === id)!
    return {
      id, ...at(id), colorA: color(id), outline: 'solid', label: b.abbreviation,
      tooltip: `${b.label} repulsion charge & core radius`,
    }
  }
  const tokens: MapToken[] = rows.flatMap((row): MapToken[] => {
    if (row.kind === 'bucket') return [bucketToken(row.id)]
    const { id, rungs } = row.ladder
    if (!row.collapsed) return rungs.map(bucketToken)
    const points = rungs.map(at)
    return [{
      id,
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      colorA: color(rungs[0]), outline: 'solid', stacked: true, label: id,
      tooltip: `The ${id} ladder: dragging moves every rung alike`,
    }]
  })
  const chains = rows.flatMap(row => (row.kind === 'ladder' && !row.collapsed ? [row.ladder.rungs] : []))
  const collapsedLadder = (id: string) => ladders.find(l => l.id === id && collapsed.has(id))

  const handleDrag = (id: string, x: number, y: number) => {
    const ladder = collapsedLadder(id)
    if (ladder === undefined) {
      // One override per bucket, carrying both numbers the token encodes;
      // charge is stored negative (repulsion).
      onParamChange({ pair: withPushOverride(params.pair, id, { charge: -y, coreRadius: x }) })
      return
    }
    // A collapsed ladder: every rung moves by the token's snapped, clamped shift.
    const token = tokens.find(t => t.id === id)!
    const points = ladder.rungs.map(at)
    const dx = alikeShift(snap(x - token.x, CORE_RADIUS_STEP), points.map(p => ({ value: p.x, lo: CORE_RADIUS_MIN_AXIS, hi: CORE_RADIUS_MAX_AXIS })))
    const dy = alikeShift(snap(y - token.y, CHARGE_MAG_STEP), points.map(p => ({ value: p.y, lo: CHARGE_MAG_MIN, hi: CHARGE_MAG_MAX })))
    onParamChange({
      pair: ladder.rungs.reduce((pair, rung, i) =>
        withPushOverride(pair, rung, { charge: -(points[i].y + dy), coreRadius: points[i].x + dx }), params.pair),
    })
  }

  return (<>
    <ForceMap2D
      tokens={tokens}
      chains={chains}
      xAxis={{ min: CORE_RADIUS_MIN_AXIS, max: CORE_RADIUS_MAX_AXIS, step: CORE_RADIUS_STEP, label: 'core radius' }}
      yAxis={{ min: CHARGE_MAG_MIN, max: CHARGE_MAG_MAX, step: CHARGE_MAG_STEP, label: 'charge' }}
      onDrag={handleDrag}
      hoveredId={hoveredBucket}
      // A collapsed ladder stands for several buckets; hovering it links none.
      onHover={id => onHoverBucket(id !== null && collapsedLadder(id) ? null : id)}
      ariaLabel="Charge map: core radius versus charge magnitude"
      xSlider={{
        value: params.coreRadiusMultiplier, min: 0.1, max: 3, step: 0.05,
        onChange: v => onParamChange({ coreRadiusMultiplier: v }),
        title: 'Scale every type’s core radius', ariaLabel: 'Scale all core radius',
        popId: 'coreRadiusMultiplier',
      }}
      ySlider={{
        value: params.pushMultiplier, min: 0, max: 3, step: 0.1,
        onChange: v => onParamChange({ pushMultiplier: v }),
        title: 'Scale every type’s charge', ariaLabel: 'Scale all charge',
        popId: 'pushMultiplier',
      }}
    />
    <LadderToggles ladders={ladders} collapsed={collapsed} onToggle={toggle} />
  </>)
}

// ── Charge-falloff visualization (read-only) ──────────────────────────────────
//
// Plots each type's repulsion falloff push·|charge| / (d² + rEff²)^exp vs
// distance (all-positive, baseline at the bottom of the frame), with the core
// radius marked on the distance axis. The global `exp` (chargeExponent) is the
// slider beneath.
export function ChargeCurves({ params, resolved, present, onParamChange, hoveredBucket, onHoverBucket }: ChargeControlProps) {
  const taxonomy = useTaxonomy()
  const { push } = resolved
  // Only the buckets the visible set holds; the tuning keeps the rest.
  const shown = push.mapping.buckets.filter(b => present.has(b.id))
  const pushMul = params.pushMultiplier
  const crMul = params.coreRadiusMultiplier
  const exp = params.chargeExponent

  const { curves, dMax } = React.useMemo<{ curves: CurveItem[]; dMax: number }>(() => {
    const rEffs = shown.map(b => crMul * pushForKey(push, b.id).coreRadius)
    const maxREff = Math.max(0, ...rEffs)
    // Show the falloff out to a few core radii so the plateau-then-drop shape
    // is legible even when the radii are small.
    const dMax = Math.max(150, maxREff * 4)

    let maxMag = 0
    const sampled = shown.map(({ id: t }) => {
      const q = Math.abs(pushForKey(push, t).charge) * pushMul
      const rEff = crMul * pushForKey(push, t).coreRadius
      const soft = rEff * rEff
      const pts: { d: number; v: number }[] = []
      for (let i = 0; i <= CURVE_SAMPLES; i++) {
        const d = (i / CURVE_SAMPLES) * dMax
        const v = q / Math.pow(d * d + soft, Math.max(exp, 0.01))
        if (v > maxMag) maxMag = v
        pts.push({ d, v })
      }
      return { type: t, rEff, pts }
    })

    const norm = maxMag > 0 ? maxMag : 1
    const ampH = CURVE_H * 0.95  // leave a little headroom at the top
    const xFor = (d: number) => (d / dMax) * CURVE_W
    const yFor = (v: number) => clamp(CURVE_H - (v / norm) * ampH, 0, CURVE_H)

    const built = sampled.map(({ type, rEff, pts }) => ({
      id: type,
      color: bucketColor(taxonomy, push.mapping, type),
      markerX: xFor(rEff),
      points: pts.map(p => `${xFor(p.d).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(' '),
    }))
    return { curves: built, dMax }
  }, [params, pushMul, push, crMul, exp, taxonomy, present])

  return (
    <ForceCurves
      curves={curves}
      xMax={dMax}
      hoveredId={hoveredBucket}
      onHover={onHoverBucket}
      xLabel="distance"
      yLabel="force"
      ariaLabel="Charge falloff curves"
      exp={{
        value: exp, min: 0.5, max: 1.0, step: 0.05,
        onChange: v => onParamChange({ chargeExponent: v }),
        title: 'Power of (d² + r²) in the charge falloff. 1 = inverse-square; higher = sharper drop-off.',
        popId: 'chargeExponent',
      }}
    />
  )
}
