import React from 'react'
import './ColorLegend.css'
import type { ChannelKey, ColorChannels } from '../graph/coloring'
import type { GroupsHandle } from './GraphView'

/** The legend's inputs: each channel's keys as drawn and the view's control over the glow's, both from `legend`. */
export interface ColorLegendProps {
  /** Each channel's keys as drawn. */
  channels: ColorChannels
  /** Which glow keys are shown, a checkbox per glow key when the filter is writable, and hover emphasis. */
  control: GroupsHandle
  /** A section's heading, by channel; absent, "Fill", "Glow" or "Ring". */
  titles?: Partial<Record<keyof ColorChannels, string>>
  /** The host's own controls, such as a picker for what the glow follows: above the sections, and still while they scroll. */
  children?: React.ReactNode
  /** A class on the legend's root, for the host's styling. */
  className?: string
}

const TITLES = { fill: 'Fill', glow: 'Glow', ring: 'Ring' } as const
const CHANNELS = ['fill', 'glow', 'ring'] as const

/**
 * A legend for every colour on the canvas: a section per channel, each key's
 * swatch and label. Glow rows carry a checkbox that shows or hides the key in
 * the view's filter, and hover emphasis.
 */
export function ColorLegend({ channels, control, titles, children, className }: ColorLegendProps) {
  // A legend that goes away under the pointer takes its emphasis with it.
  const controlRef = React.useRef(control)
  controlRef.current = control
  React.useEffect(() => () => controlRef.current.emphasize(null), [])
  return (
    <div className={`gv-color-legend${className ? ` ${className}` : ''}`}>
      {children}
      <div className="gv-color-legend-items">
        {CHANNELS.map(channel => channels[channel] && (
          <div key={channel} className="gv-color-legend-section" onMouseLeave={channel === 'glow' ? () => control.emphasize(null) : undefined}>
            <div className="gv-color-legend-title">{titles?.[channel] ?? TITLES[channel]}</div>
            {channels[channel]!.map(key => <KeyRow key={key.id} item={key} control={channel === 'glow' ? control : undefined} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A key's swatch and label; under a glow's `control`, its checkbox and hover emphasis too. */
function KeyRow({ item, control }: { item: ChannelKey; control?: GroupsHandle }) {
  const on = control?.shown(item.id) ?? true
  const toggle = control?.toggle
  const Row = toggle ? 'label' : 'div'
  return (
    <Row className={`gv-color-legend-row${on ? '' : ' off'}`} onMouseEnter={control && (() => control.emphasize(item.id))}>
      {toggle && <input type="checkbox" checked={on} onChange={() => toggle(item.id)} />}
      <span className="gv-color-legend-swatch" style={{ background: item.color }} />
      <span className="gv-color-legend-label">{item.label}</span>
      {on && !item.visible && <span className="gv-color-legend-note">not shown</span>}
    </Row>
  )
}
