import React from 'react'
import type { Theme } from '../../graph/scheme'
import type { GraphDiagnostic } from '../../graph/validate'
import type { ThemeChoice } from './useTheme'

/**
 * Every string the pane and the bar render, titles and `aria-label`s
 * included, keyed by where it appears: the bar, the pane, the hover box, the
 * shortcuts panel, the diagnostics, the scrubber, the control panel. One that
 * interpolates is a function. The control panel's equations are notation and
 * are not here.
 */
export interface GraphViewStrings {
  /** The search button's title; `key` is the key that opens the search, when one is bound. */
  searchTitle: (key: string | null) => string
  /** The search field's placeholder. */
  searchPlaceholder: string
  /** The search's badge title: matches the filters hide. */
  searchHidden: (count: number) => string
  /** A chip's title while its values are hidden. */
  chipShow: (chip: string) => string
  /** A chip's title while its values are shown. */
  chipHide: (chip: string) => string
  /** A chip's badge title: matches it hides. */
  chipHidden: (count: number) => string
  /** An axis with no values in view, in place of its chips. */
  axisEmpty: (axis: string) => string
  /** The title of `axisEmpty`. */
  axisEmptyTitle: (axis: string) => string
  /** An axis the taxonomy does not declare, in place of its chips. */
  axisUndeclared: string
  /** The title of `axisUndeclared`. */
  axisUndeclaredTitle: (axis: string) => string
  /** An axis's remove button's title. */
  axisRemove: (axis: string) => string
  /** The add button's title when one axis can be added. */
  axisAdd: (axis: string) => string
  /** The add button's title when it opens a menu of axes. */
  axisAddMenu: string
  /** A collapsed axis's button: its chips past the first row. */
  rowMore: (count: number) => string
  /** The title of `rowMore`. */
  rowMoreTitle: (count: number) => string
  /** An opened axis's button. */
  rowLess: string
  /** The title of `rowLess`. */
  rowLessTitle: string
  /** A locked axis's lock title. */
  lockOn: (axis: string) => string
  /** An unlocked axis's lock title. */
  lockOff: (axis: string) => string

  /** The pane's `aria-label`, around `counts`. */
  paneLabel: (counts: string) => string
  /** The visible nodes and edges, under the canvas and in `paneLabel`. */
  counts: (nodes: number, edges: number) => string
  /** The canvas's line when the filter hides every node. */
  paneEmpty: string
  /** The pane's fallback when it throws. */
  paneFailed: string
  /** The canvas's fallback when it throws. */
  canvasFailed: string
  /** The fit button. */
  fit: string
  /** The fit button's title. */
  fitTitle: string
  /** The theme button, by the choice it holds. */
  theme: (choice: ThemeChoice) => string
  /** The theme button's title; `resolved` is what the choice draws in. */
  themeTitle: (choice: ThemeChoice, resolved: Theme) => string
  /** The theme button's `aria-label`. */
  themeLabel: string
  /** The simulation button while paused. */
  play: string
  /** The simulation button while running. */
  pause: string
  /** The title of `play`. */
  playTitle: string
  /** The title of `pause`. */
  pauseTitle: string
  /** The frame rate. */
  fps: (fps: number) => string
  /** The title of `fps`. */
  fpsTitle: string

  /** The hover box's line on a node with visible copies. */
  hoverCopy: (index: number, count: number) => string
  /** The title of `hoverCopy`. */
  hoverCopyTitle: string
  /** The hover box's direction line, without Shift. */
  hoverDependencies: string
  /** The hover box's direction line, with Shift. */
  hoverDependents: string

  /** The shortcuts panel's title. */
  shortcutsTitle: string
  /** A shortcut row: its keys and what they do. */
  shortcutTab: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutEnter: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutEscape: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutArrows: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutZoom: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutFit: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutSearch: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutRun: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutUpstream: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutToggle: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutLasso: readonly [keys: string, action: string]
  /** A shortcut row: its keys and what they do. */
  shortcutHelp: readonly [keys: string, action: string]

  /** The diagnostics list's summary. */
  diagnosticsSummary: (errors: number, warnings: number) => string
  /** One diagnostic's line, after its code. */
  diagnostic: (diagnostic: GraphDiagnostic) => string

  /** The scrubber's play button's label and title. */
  scrubberPlay: string
  /** The scrubber's pause button's label and title. */
  scrubberPause: string
  /** The scrubber's slider's label. */
  scrubberPlayhead: string
  /** The scrubber's reset button's label and title. */
  scrubberWhole: string

  /** The control panel's toggle. */
  controls: string
  /** The control panel's toggle's title. */
  controlsTitle: string
  /** A control panel tab. */
  tabPushPull: string
  /** A control panel tab, and its sub-tabs' label. */
  tabGravity: string
  /** A control panel tab. */
  tabMisc: string
  /** The preset menu's label. */
  preset: string
  /** The preset menu's title. */
  presetTitle: string
  /** The preset menu's entry while the tuning is no preset. */
  presetCustom: string
  /** A force-curve plot's x axis. */
  curveDistance: string
  /** A force-curve plot's y axis. */
  curveForce: string
  /** A force-curve plot's exponent slider. */
  curveExp: string
  /** A ladder's toggle title. */
  ladderToggle: (ladder: string) => string
  /** A collapsed ladder's token title, on a map. */
  ladderToken: (ladder: string) => string
  /** A collapsed ladder's column title, on a band plot. */
  ladderColumn: (ladder: string) => string
  /** A force tab's line when the legend's groups hide every node. */
  nothingVisibleLegend: string
  /** A force tab's line when the chips hide every node. */
  nothingVisibleChips: string

  /** The Push/Pull tab's axis menu's label. */
  pushPullAxis: string
  /** The Push/Pull tab's axis menu's title. */
  pushPullAxisTitle: string
  /** A disabled entry in the Push/Pull tab's axis menu. */
  pushPullTooMany: (axis: string, tokens: number, max: number) => string
  /** The Push/Pull sub-tabs' label. */
  pairForce: string
  /** A Push/Pull sub-tab. */
  push: string
  /** A Push/Pull sub-tab. */
  pull: string
  /** The charge map's x axis. */
  chargeRadius: string
  /** The charge map's y axis. */
  chargeCharge: string
  /** The charge map's `aria-label`. */
  chargeMap: string
  /** A charge token's title. */
  chargeToken: (bucket: string) => string
  /** The charge map's x slider's title. */
  chargeScaleRadiusTitle: string
  /** The charge map's x slider's label. */
  chargeScaleRadius: string
  /** The charge map's y slider's title. */
  chargeScaleChargeTitle: string
  /** The charge map's y slider's label. */
  chargeScaleCharge: string
  /** The charge curves' `aria-label`. */
  chargeCurves: string
  /** The charge curves' exponent slider's title. */
  chargeExpTitle: string
  /** The spring map's x axis. */
  springLength: string
  /** The spring map's y axis. */
  springStiffness: string
  /** The spring map's `aria-label`. */
  springMap: string
  /** The spring map's x slider's title. */
  springScaleLengthTitle: string
  /** The spring map's x slider's label. */
  springScaleLength: string
  /** The spring map's y slider's title. */
  springScaleStiffnessTitle: string
  /** The spring map's y slider's label. */
  springScaleStiffness: string
  /** The spring curves' `aria-label`. */
  springCurves: string
  /** The spring curves' exponent slider's title. */
  springExpTitle: string

  /** A Gravity sub-tab. */
  gravityX: string
  /** A Gravity sub-tab. */
  gravityY: string
  /** A Gravity sub-tab. */
  gravityTopological: string
  /** The radial switch's label and title. */
  gravityRadial: string
  /** The Topological sub-tab's strength slider. */
  topoStrength: string
  /** The Topological sub-tab's exponent slider. */
  topoExp: string
  /** The Topological curve's `aria-label`. */
  topoCurve: string
  /** The Topological curve's x axis. */
  topoDepth: string
  /** The Topological curve's y axis. */
  topoPull: string
  /** A layout axis's menu's label. */
  layoutAxis: string
  /** A layout axis's menu's title. */
  layoutAxisTitle: (axis: string) => string
  /** A computed scalar's entry in a layout axis's menu. */
  layoutComputed: (scalar: string) => string
  /** A disabled entry in a layout axis's menu. */
  layoutTooMany: (mapping: string, columns: number, max: number) => string
  /** The Y axis's note in radial layout. */
  layoutIgnoredRadial: string
  /** A layout axis's strength slider's y axis label. */
  layoutStrength: (axis: string) => string
  /** A band plot's strength slider's label. */
  bandStrength: (axis: string) => string
  /** A band plot's strength slider's title. */
  bandStrengthTitle: (axis: string) => string
  /** A band plot's x axis. */
  bandPosition: (axis: string) => string
  /** A band plot's x axis in radial layout, on Y. */
  bandRing: string
  /** A band plot's `aria-label`. */
  bandPlot: (axis: string) => string
  /** A band curve's `aria-label`. */
  bandCurve: (axis: string) => string
  /** The band curves' exponent slider's title. */
  bandExpTitle: string
  /** A scalar plot's strength slider's title. */
  scalarStrengthTitle: (axis: string) => string
  /** A scalar plot's x axis. */
  scalarPosition: (axis: string, scalar: string) => string
  /** A scalar plot's x axis in radial layout, on Y. */
  scalarRing: string
  /** A scalar plot's `aria-label`. */
  scalarPlot: (axis: string, scalar: string) => string
  /** A scalar plot's handle's title: where a score rests. */
  scalarHandle: (score: 0 | 1, axis: string, at: number) => string

  /** The Misc tab's dynamics section. */
  dynamics: string
  /** The dynamics curve's x axis. */
  dynamicsTicks: string
  /** The dynamics curve's mark at the tick the simulation stops. */
  dynamicsStop: (ticks: number) => string
  /** The dynamics curve's `aria-label`. */
  dynamicsCurve: string
  /** A dynamics slider. */
  friction: string
  /** The title of `friction`. */
  frictionTitle: string
  /** A dynamics slider. */
  cooling: string
  /** The title of `cooling`. */
  coolingTitle: string
  /** A dynamics slider. */
  threshold: string
  /** The title of `threshold`. */
  thresholdTitle: string
  /** The Misc tab's node scaling section. */
  nodeScaling: string
  /** The node scaling curve's x axis. */
  nodeScalingZoom: string
  /** The node scaling curve's y axis. */
  nodeScalingScale: string
  /** The node scaling curve's `aria-label`. */
  nodeScalingCurve: string
  /** A node scaling slider. */
  size: string
  /** The title of `size`. */
  sizeTitle: string
  /** A node scaling slider. */
  growCap: string
  /** The title of `growCap`. */
  growCapTitle: string
  /** A node scaling slider. */
  shrinkFloor: string
  /** The title of `shrinkFloor`. */
  shrinkFloorTitle: string
}

const matches = (n: number) => `${n} match${n === 1 ? '' : 'es'}`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const removesAxis = '0 switches the axis off'

/** The pane's and the bar's strings in English: what a host's `strings` falls back to, key by key. */
export const DEFAULT_STRINGS: GraphViewStrings = {
  searchTitle: key => (key ? `Search (${key})` : 'Search'),
  searchPlaceholder: 'Search…',
  searchHidden: n => `${matches(n)} hidden by filters`,
  chipShow: chip => `Show ${chip.toLowerCase()}`,
  chipHide: chip => `Hide ${chip.toLowerCase()}`,
  chipHidden: n => `${matches(n)} hidden by this filter`,
  axisEmpty: axis => `no ${axis.toLowerCase()} values`,
  axisEmptyTitle: axis => `${axis} has no values in this view`,
  axisUndeclared: 'not declared',
  axisUndeclaredTitle: axis => `${axis} is not an axis the taxonomy declares`,
  axisRemove: axis => `Remove the ${axis} filter`,
  axisAdd: axis => `Add the ${axis} filter`,
  axisAddMenu: 'Add a filter',
  rowMore: n => `+${n}`,
  rowMoreTitle: n => `Show ${n} more`,
  rowLess: 'Less',
  rowLessTitle: 'Show one row',
  lockOn: axis => `${axis} filter locked — held as it is; click to unlock`,
  lockOff: axis => `${axis} filter unlocked — click to lock and hold it as it is`,

  paneLabel: counts => `Graph, ${counts}`,
  counts: (nodes, edges) => `${plural(nodes, 'node')}, ${plural(edges, 'edge')}`,
  paneEmpty: 'No nodes match the filter.',
  paneFailed: 'The graph view failed to render.',
  canvasFailed: 'The graph canvas failed to render.',
  fit: 'Fit',
  fitTitle: 'Fit to view (F)',
  theme: choice => ({ system: 'Auto', light: 'Light', dark: 'Dark' })[choice],
  themeTitle: (choice, resolved) => `Colour scheme: ${choice}${choice === 'system' ? ` (${resolved})` : ''} — click to change`,
  themeLabel: 'Colour scheme',
  play: 'Play',
  pause: 'Pause',
  playTitle: 'Resume simulation (Space)',
  pauseTitle: 'Pause simulation (Space)',
  fps: fps => `${fps} fps`,
  fpsTitle: 'Simulation frames per second',

  hoverCopy: (index, count) => `copy ${index} of ${count}`,
  hoverCopyTitle: 'The same entity appears in more than one place. Hovering any copy marks all copies.',
  hoverDependencies: 'dependencies',
  hoverDependents: 'dependents',

  shortcutsTitle: 'Keyboard Shortcuts',
  shortcutTab: ['Tab / Shift+Tab', 'Next / previous node'],
  shortcutEnter: ['Enter', 'Select focused node'],
  shortcutEscape: ['Escape', 'Deselect / close'],
  shortcutArrows: ['Arrow keys', 'Pan viewport'],
  shortcutZoom: ['+ / -', 'Zoom in / out'],
  shortcutFit: ['F', 'Fit to view'],
  shortcutSearch: ['/', 'Open search'],
  shortcutRun: ['Space', 'Toggle simulation'],
  shortcutUpstream: ['Shift + hover', 'Upstream deps'],
  shortcutToggle: ['Ctrl/Meta + click', 'Add or remove a node'],
  shortcutLasso: ['Ctrl/Meta + drag', 'Lasso nodes into the selection'],
  shortcutHelp: ['?', 'This panel'],

  diagnosticsSummary: (errors, warnings) => [
    ...(errors > 0 ? [plural(errors, 'graph error')] : []),
    ...(warnings > 0 ? [plural(warnings, 'graph warning')] : []),
  ].join(', ') + (errors > 0 ? ' — what is named is not drawn' : ''),
  diagnostic: d => d.message,

  scrubberPlay: 'Play the window',
  scrubberPause: 'Pause playback',
  scrubberPlayhead: 'Playhead',
  scrubberWhole: 'Whole window',

  controls: 'Controls',
  controlsTitle: 'Toggle control panel',
  tabPushPull: 'Push/Pull',
  tabGravity: 'Gravity',
  tabMisc: 'Misc',
  preset: 'preset',
  presetTitle: 'A named tuning: choosing one carries every control to its values',
  presetCustom: 'custom',
  curveDistance: 'distance',
  curveForce: 'force',
  curveExp: 'exp',
  ladderToggle: ladder => `Tune the ${ladder} ladder's rungs as one`,
  ladderToken: ladder => `The ${ladder} ladder: dragging moves every rung alike`,
  ladderColumn: ladder => `The ${ladder} ladder: each handle moves every rung alike`,
  nothingVisibleLegend: 'Nothing visible — turn a group on in the legend.',
  nothingVisibleChips: 'Nothing visible on this axis — turn a chip on.',

  pushPullAxis: 'axis',
  pushPullAxisTitle: "The axis push and pull key on. Tokens are the visible set's: a push token per bucket some visible node falls in, a pull token per spring category some sprung edge falls in; the counts measure the whole graph",
  pushPullTooMany: (axis, tokens, max) => `${axis} — ${tokens} tokens (max ${max})`,
  pairForce: 'Pair force',
  push: 'Push',
  pull: 'Pull',
  chargeRadius: 'core radius',
  chargeCharge: 'charge',
  chargeMap: 'Charge map: core radius versus charge magnitude',
  chargeToken: bucket => `${bucket} repulsion charge & core radius`,
  chargeScaleRadiusTitle: 'Scale every type’s core radius',
  chargeScaleRadius: 'Scale all core radius',
  chargeScaleChargeTitle: 'Scale every type’s charge',
  chargeScaleCharge: 'Scale all charge',
  chargeCurves: 'Charge falloff curves',
  chargeExpTitle: 'Power of (d² + r²) in the charge falloff. 1 = inverse-square; higher = sharper drop-off.',
  springLength: 'length',
  springStiffness: 'stiffness',
  springMap: 'Spring map: rest length versus stiffness',
  springScaleLengthTitle: 'Scale every spring’s rest length',
  springScaleLength: 'Scale all length',
  springScaleStiffnessTitle: 'Scale every spring’s stiffness',
  springScaleStiffness: 'Scale all stiffness',
  springCurves: 'Spring force response curves',
  springExpTitle: 'Power of displacement in the spring force. 1 = linear (Hooke); higher = softer near rest, stiffer far out.',

  gravityX: 'X Axis',
  gravityY: 'Y Axis',
  gravityTopological: 'Topological',
  gravityRadial: 'Radial layout: Y as distance from the centre',
  topoStrength: 'strength',
  topoExp: 'exp',
  topoCurve: 'Depth-to-pull contrast curve',
  topoDepth: 'depth',
  topoPull: 'pull',
  layoutAxis: 'axis',
  layoutAxisTitle: axis => `What the ${axis} axis keys on: one column per bucket of a mapping, or a computed scalar as a gradient`,
  layoutComputed: scalar => `${scalar} — computed`,
  layoutTooMany: (mapping, columns, max) => `${mapping} — ${columns} columns (max ${max})`,
  layoutIgnoredRadial: 'ignored in radial',
  layoutStrength: axis => `${axis} strength`,
  bandStrength: axis => `${axis} band strength`,
  bandStrengthTitle: axis => `${axis} band-pull strength (scale all); ${removesAxis}`,
  bandPosition: axis => `${axis} position`,
  bandRing: 'ring: the band centre, innermost first',
  bandPlot: axis => `${axis} axis: one column per bucket, its rest band as two handles`,
  bandCurve: axis => `${axis} band force-response curve`,
  bandExpTitle: 'Band falloff exponent, shared by both axes. 1 = linear (Hooke); higher = softer just outside the band, stiffer far out.',
  scalarStrengthTitle: axis => `${axis} pull strength (scale all); ${removesAxis}`,
  scalarPosition: (axis, scalar) => `${axis} position: ${scalar}, 0 → 1`,
  scalarRing: 'ring: the span’s low end innermost',
  scalarPlot: (axis, scalar) => `${axis} axis: ${scalar}, a computed scalar; drag the 0 and 1 ends`,
  scalarHandle: (score, axis, at) => `where a score of ${score} rests on ${axis}: ${at}`,

  dynamics: 'Dynamics',
  dynamicsTicks: 'ticks',
  dynamicsStop: ticks => `${ticks} ticks`,
  dynamicsCurve: 'Energy α against ticks, to the tick the simulation stops at',
  friction: 'friction',
  frictionTitle: 'Fraction of velocity kept per tick. Higher = coasts longer',
  cooling: 'cooling',
  coolingTitle: 'Energy lost per tick. Higher = settles faster',
  threshold: 'threshold',
  thresholdTitle: 'Energy level below which simulation pauses',
  nodeScaling: 'Node scaling',
  nodeScalingZoom: 'zoom',
  nodeScalingScale: 'scale',
  nodeScalingCurve: 'Node scale against zoom: flat below the shrink floor and above the grow cap',
  size: 'size',
  sizeTitle: 'Overall node + label size. 1 = default.',
  growCap: 'grow cap',
  growCapTitle: 'Zoom past which nodes stop growing. Lower = nodes start shrinking sooner as you zoom out.',
  shrinkFloor: 'shrink floor',
  shrinkFloorTitle: 'Smallest nodes may get when zoomed all the way out.',
}

/** A host's strings over the defaults. */
export function stringsOf(strings: Partial<GraphViewStrings> | undefined): GraphViewStrings {
  return strings ? { ...DEFAULT_STRINGS, ...strings } : DEFAULT_STRINGS
}

/** The strings the nearest pane or bar renders in; the defaults outside one. */
export const StringsContext = React.createContext<GraphViewStrings>(DEFAULT_STRINGS)

/** The strings the nearest pane or bar renders in. */
export function useStrings(): GraphViewStrings {
  return React.useContext(StringsContext)
}
