// Collapsible control panel for graph force parameters and simulation controls.
// Organized by force equation — each section shows its equation, then relevant sliders.

import React from 'react'
import './GraphControlPanel.css'
import type { ForceParams } from '../graph/simulation'
import type { ResolvedPhysics } from '../graph/forces'
import { nodeSizeMul } from '../graph/node-scale'
import type { NodeScaleParams } from '../graph/node-scale'
import { PushPullControls } from './PushPullControls'
import { GravityControls } from './GravityControls'
import type { GravityHover } from './GravityControls'
import { Slider } from './controls/Slider'
import { EquationSection } from './controls/EquationSection'
import { PopProvider, FormulaValue } from './controls/PopContext'
import { HiddenByContext } from './controls/NothingVisible'
import type { HiddenBy } from './controls/NothingVisible'
import { Curve } from './controls/Curve'
import type { Span } from './controls/Curve'
import type { AxisOption, LayoutAxisOption } from '../graph/simulation'
import type { AxisMapping } from '../graph/axis'

export type ForceSection = 'push' | 'pull' | 'gravity' | 'dynamics' | null

// The three control tabs. Unlike ForceSection, a tab is always one of these —
// there is no "null" tab; exactly one section is shown at a time. The "forces"
// tab holds both pair forces under one axis (push and pull are its sub-tabs,
// and still drive their own ForceSection previews); the "misc" tab groups
// non-force controls (simulation dynamics + render-time node scaling), its
// dynamics sub-section driving the 'dynamics' preview.
type ControlTab = 'forces' | 'gravity' | 'misc'

const CONTROL_TABS: { id: ControlTab; label: string }[] = [
  { id: 'forces', label: 'Push/Pull' },
  { id: 'gravity', label: 'Gravity' },
  { id: 'misc', label: 'Misc' },
]

export type { PresentSets } from './graph-view/present'
import type { PresentSets } from './graph-view/present'

interface GraphControlPanelProps {
  params: ForceParams
  /** The dense tables the kernels read, resolved once by the view. */
  resolved: ResolvedPhysics
  // Patch-based: a control emits the subset of params it changed. (handleGravityChange
  // already used this shape; unifying lets nested map params be written too.)
  onParamChange: (patch: Partial<ForceParams>) => void
  // Shared "keep the simulation warm while tuning" signal. Fired alongside
  // every force-control edit so the layout responds live. See GraphView's
  // handleForceAdjust.
  onAdjust: () => void
  // Edits that relocate nodes — gravity's mode and toggles, the push/pull axis.
  // Routed through GraphView so the simulation params update and the layout
  // reheats harder than a numeric nudge.
  onRelayout: (partial: Partial<ForceParams>) => void
  /** Every axis push/pull may key on for this graph, with its measured cost. */
  axes: readonly AxisOption[]
  /** Every axis X or Y may key on: those mappings, and the computed scalars. */
  layoutAxes: readonly LayoutAxisOption[]
  /** What the post-filter visible set holds, per control: the only buckets and categories worth a token or a column. */
  present: PresentSets
  /** The control a force tab names when nothing is visible. */
  hiddenBy: HiddenBy
  onAxisChange: (mapping: AxisMapping) => void
  onActiveSection: (section: ForceSection) => void
  onActivePushBucket: (bucket: string | null) => void
  onActiveGravityBucket: (hover: GravityHover | null) => void
  // The hovered/active pull edge category (its k-field key), forwarded to the
  // canvas so only that edge category is highlighted while tuning it.
  onActivePullEdge: (key: string | null) => void
  // Render-time node sizing (Misc → Node scaling). Separate from ForceParams
  // because it never touches the simulation — it only affects how big nodes
  // are drawn at a given zoom.
  nodeScale: NodeScaleParams
  onNodeScaleChange: (patch: Partial<NodeScaleParams>) => void
}

// Keys of ForceParams whose value is a number (ForceParams now also has the
// boolean toggles and the string mode, which sliders must not target).
type NumericForceKey = {
  [K in keyof ForceParams]: ForceParams[K] extends number ? K : never
}[keyof ForceParams]

// Shared shape for a labelled range row. Key types differ per param family
// (force params vs. node-scale params), so the key lives on the extending
// interfaces and SliderRow itself only needs the range/label/tooltip.
interface RangeDef {
  label: string
  min: number
  max: number
  step: number
  tooltip: string
}

interface SliderDef extends RangeDef {
  key: NumericForceKey
}

interface NodeScaleSliderDef extends RangeDef {
  key: keyof NodeScaleParams
}

// --- PUSH/PULL section ---
//
// The pair forces live in PushPullControls: the shared axis dropdown, then Push
// (ChargeControls: a 2D charge map + a charge-falloff read-out) and Pull
// (SpringControls: a 2D spring map + a force-curve read-out) as sub-tabs.

// --- GRAVITY section ---
//
// The Gravity tab's controls live in GravityControls: X Axis and Y Axis (the
// same per-axis surface, Y carrying the Radial switch) and Topological. Center
// gravity is the unexplained baseline.

const FRICTION: SliderDef = { key: 'velocityDecay', label: 'friction', min: 0.05, max: 0.95, step: 0.05,
  tooltip: 'Fraction of velocity kept per tick. Higher = coasts longer' }
const COOLING: SliderDef = { key: 'alphaDecay', label: 'cooling', min: 0.0005, max: 0.02, step: 0.0005,
  tooltip: 'Energy lost per tick. Higher = settles faster' }
const THRESHOLD: SliderDef = { key: 'alphaMin', label: 'threshold', min: 0, max: 0.005, step: 0.0001,
  tooltip: 'Energy level below which simulation pauses' }

// The stop and α's run follow Simulation.tick.
const TICKS: Span = [10, 4000]
const ALPHA: Span = [1e-8, 1]
const TICK_SAMPLES = 48

const DYNAMICS_EQUATION = (
  <>
    <div className="gv-eq-line">v ×= <FormulaValue id={FRICTION.key}>friction</FormulaValue></div>
    <div className="gv-eq-line">
      α −= <FormulaValue id={COOLING.key}>cooling</FormulaValue>, stop at <FormulaValue id={THRESHOLD.key}>threshold</FormulaValue>
    </div>
  </>
)

const SIZE: NodeScaleSliderDef = { key: 'baseMul', label: 'size', min: 0.3, max: 2.0, step: 0.05,
  tooltip: 'Overall node + label size. 1 = default.' }
const GROW_CAP: NodeScaleSliderDef = { key: 'maxZoomMul', label: 'grow cap', min: 0.5, max: 3.0, step: 0.05,
  tooltip: 'Zoom past which nodes stop growing. Lower = nodes start shrinking sooner as you zoom out.' }
const SHRINK_FLOOR: NodeScaleSliderDef = { key: 'minZoomMul', label: 'shrink floor', min: 0.1, max: 1.0, step: 0.05,
  tooltip: 'Smallest nodes may get when zoomed all the way out.' }

// Log axes: zoom a decade either side of 1, past every floor and cap, and
// scale across every value the sliders reach. On them the clamp's three runs are
// straight, so its corners are the curve's only points.
const ZOOM: Span = [0.1, 10]
const SCALE: Span = [SIZE.min * SHRINK_FLOOR.min, SIZE.max * GROW_CAP.max]

const NODE_SCALE_EQUATION = (
  <div className="gv-eq-line">
    scale = <FormulaValue id={SIZE.key}>size</FormulaValue> × clamp(zoom,{' '}
    <FormulaValue id={SHRINK_FLOOR.key}>shrink floor</FormulaValue>,{' '}
    <FormulaValue id={GROW_CAP.key}>grow cap</FormulaValue>)
  </div>
)

export function GraphControlPanel({
  params, resolved, onParamChange, onAdjust, onRelayout, axes, layoutAxes, present, hiddenBy, onAxisChange,
  onActiveSection,
  onActivePushBucket, onActiveGravityBucket, onActivePullEdge,
  nodeScale, onNodeScaleChange,
}: GraphControlPanelProps) {
  const [open, setOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<ControlTab>('forces')
  // Links the spring map and the force-curve viz: hovering a token in one
  // brightens the matching curve in the other. The key (an edge category's
  // k-field) is also forwarded to the canvas so only that category's edges
  // highlight while tuning.
  const [hoveredPullEdge, setHoveredPullEdge] = React.useState<string | null>(null)
  const handleHoverPullEdge = React.useCallback((key: string | null) => {
    setHoveredPullEdge(key)
    onActivePullEdge(key)
  }, [onActivePullEdge])

  // Links the charge map and the charge-falloff viz: hovering a token in one
  // brightens the matching curve in the other. The bucket is also forwarded to
  // the canvas so only that bucket's charge field rings highlight while tuning.
  const [hoveredPushBucket, setHoveredPushBucket] = React.useState<string | null>(null)
  const handleHoverPushBucket = React.useCallback((b: string | null) => {
    setHoveredPushBucket(b)
    onActivePushBucket(b)
  }, [onActivePushBucket])

  // Links the band pseudo-plot to the canvas band/ring highlight (and dims the
  // other columns/stripes).
  const [hoveredGravityBucket, setHoveredGravityBucket] = React.useState<GravityHover | null>(null)
  const handleHoverGravityBucket = React.useCallback((h: GravityHover | null) => {
    setHoveredGravityBucket(h)
    onActiveGravityBucket(h)
  }, [onActiveGravityBucket])

  // Single funnel for every force control's edits. Routing all controls
  // through one wrapper means the "nudge the simulation" behaviour is
  // defined once and inherited by every present and future control
  // (sliders, axis-plot handles, the 2D maps) — no per-control wiring,
  // no chance of a control forgetting to keep the layout warm.
  const emitParamChange = React.useCallback((patch: Partial<ForceParams>) => {
    onParamChange(patch)
    onAdjust()
  }, [onParamChange, onAdjust])

  return (
    <div className={`gv-graph-control-panel ${open ? 'open' : ''}`}>
      <button
        className="gv-graph-control-panel-toggle"
        onClick={() => setOpen(!open)}
        title="Toggle control panel"
      >
        {open ? '▼ Controls' : '▶ Controls'}
      </button>

      {open && (
        <PopProvider>
        <HiddenByContext.Provider value={hiddenBy}>
        <div className="gv-graph-control-panel-body">
          {/* Control tabs — only one section is shown at a time. */}
          <div className="gv-graph-control-tabs" role="tablist">
            {CONTROL_TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                className={`gv-graph-control-tab${activeTab === t.id ? ' active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* All four sections are always mounted and stacked in the same grid
              cell; only the active one is visible. The grid auto-sizes to the
              tallest/widest tab, so the panel never resizes when switching
              tabs — the browser computes the "max required space" for us. */}
          <div className="gv-graph-control-sections">
            {/* PUSH/PULL section */}
            <SectionSlot active={activeTab === 'forces'}>
              <PushPullControls
                params={params}
                resolved={resolved}
                axes={axes}
                present={present}
                onParamChange={emitParamChange}
                onAxisChange={onAxisChange}
                onActiveSection={onActiveSection}
                hoveredPushBucket={hoveredPushBucket}
                onHoverPushBucket={handleHoverPushBucket}
                hoveredEdge={hoveredPullEdge}
                onHoverEdge={handleHoverPullEdge}
              />
            </SectionSlot>

            {/* GRAVITY section */}
            <SectionSlot active={activeTab === 'gravity'}>
              <EquationSection
                subtitle=""
                equation=""
                onHover={h => { onActiveSection(h ? 'gravity' : null); if (!h) onActiveGravityBucket(null) }}
              >
                <GravityControls
                  params={params}
                  resolved={resolved}
                  axes={layoutAxes}
                  present={present}
                  onParamChange={emitParamChange}
                  onRelayout={onRelayout}
                  hovered={hoveredGravityBucket}
                  onHover={handleHoverGravityBucket}
                />
              </EquationSection>
            </SectionSlot>

            <SectionSlot active={activeTab === 'misc'}>
              <MiscControls
                params={params}
                nodeScale={nodeScale}
                onParamChange={emitParamChange}
                onNodeScaleChange={onNodeScaleChange}
                onActiveSection={onActiveSection}
              />
            </SectionSlot>
          </div>
        </div>
        </HiddenByContext.Provider>
        </PopProvider>
      )}
    </div>
  )
}

// A stacking slot for one force section. All slots share a single grid cell
// (see .gv-graph-control-sections), so the panel sizes to the tallest section and
// never changes size when switching tabs. Inactive slots stay mounted but
// hidden (visibility + pointer-events) so they still contribute to the grid's
// max size and keep their input state.
function SectionSlot({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className={`gv-graph-control-section-slot${active ? ' active' : ''}`} aria-hidden={!active}>
      {children}
    </div>
  )
}

/** The Misc tab: simulation dynamics and render-time node scaling, each an equation over a curve of what its sliders do. */
export function MiscControls({ params, nodeScale, onParamChange, onNodeScaleChange, onActiveSection }: {
  params: ForceParams
  nodeScale: NodeScaleParams
  onParamChange: (patch: Partial<ForceParams>) => void
  onNodeScaleChange: (patch: Partial<NodeScaleParams>) => void
  onActiveSection: (section: ForceSection) => void
}) {
  const { alphaDecay: cooling, alphaMin: threshold } = params
  const stop = (1 - threshold) / cooling
  // Log-spaced ticks from the axis's start to the stop, where α = threshold.
  const ticks = Array.from({ length: TICK_SAMPLES + 1 }, (_, i) => TICKS[0] * (stop / TICKS[0]) ** (i / TICK_SAMPLES))
  const { minZoomMul: floor, maxZoomMul: cap } = nodeScale
  return <>
    <div className="gv-graph-control-subsection">
      <div className="gv-graph-control-subsection-title">Dynamics</div>
      <EquationSection subtitle="" equation={DYNAMICS_EQUATION} onHover={h => onActiveSection(h ? 'dynamics' : null)}>
        <Curve
          points={ticks.map(t => [t, Math.max(1 - cooling * t, threshold)] as const)}
          x={TICKS} y={ALPHA}
          marks={[{ x: stop, label: `${Math.round(stop)} ticks` }]}
          xLabel="ticks" yLabel="α"
          ariaLabel="Energy α against ticks, to the tick the simulation stops at"
        />
        {[FRICTION, COOLING, THRESHOLD].map(s => (
          <SliderRow key={s.key} def={s} value={params[s.key]} onChange={v => onParamChange({ [s.key]: v })} />
        ))}
      </EquationSection>
    </div>
    <div className="gv-graph-control-subsection">
      <div className="gv-graph-control-subsection-title">Node scaling</div>
      <EquationSection subtitle="" equation={NODE_SCALE_EQUATION} onHover={() => {}}>
        <Curve
          points={[ZOOM[0], floor, cap, ZOOM[1]].map(z => [z, nodeSizeMul(z, nodeScale)] as const)}
          x={ZOOM} y={SCALE}
          marks={[{ x: floor }, { x: cap }]}
          xLabel="zoom" yLabel="scale"
          ariaLabel="Node scale against zoom: flat below the shrink floor and above the grow cap"
        />
        {[SIZE, GROW_CAP, SHRINK_FLOOR].map(s => (
          <SliderRow key={s.key} def={s} value={nodeScale[s.key]} onChange={v => onNodeScaleChange({ [s.key]: v })} />
        ))}
      </EquationSection>
    </div>
  </>
}

function SliderRow({ def, value, onChange }: {
  def: RangeDef & { key: string }
  value: number
  onChange: (v: number) => void
}) {
  const display = def.step < 1 ? String(value) : String(Math.round(value))
  return (
    <div className="gv-graph-control-slider" title={def.tooltip}>
      <label className="gv-graph-control-slider-label">{def.label}</label>
      <Slider min={def.min} max={def.max} step={def.step} value={value} onChange={onChange} popId={def.key} />
      <span className="gv-graph-control-slider-value">{display}</span>
    </div>
  )
}
