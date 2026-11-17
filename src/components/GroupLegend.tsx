// A legend for the group overlay: every group the host offers, with the
// colour the view drew it in, a toggle that writes the view's group filter,
// and hover emphasis, all through the view's own control. Both hosts had
// written this one; it sits where `groupsControl` renders it, under the bar.

import React from 'react'
import './GroupLegend.css'
import type { ActiveGroup } from '../graph/groups'
import type { GroupsControl } from './GraphView'

/** The legend's inputs: the items, and the groups as drawn and the view's control over them, both from `groupsControl`. */
export interface GroupLegendProps {
  /** Every group the host offers, in order, with its label. */
  items: readonly { id: string; label: string }[]
  /** The groups as drawn — their colours. An item shown but not among them has no node the view draws. */
  active: readonly ActiveGroup[]
  /** Which items are shown, a checkbox per item when the filter is writable, and hover emphasis. */
  control: GroupsControl
  /** The legend's heading. */
  title?: string
  /** A class on the legend's root, for the host's styling. */
  className?: string
}

/**
 * A legend for the group overlay: every group the host offers with the colour
 * the view drew it in, a checkbox that shows or hides it in the view's
 * filter, and hover emphasis.
 */
export function GroupLegend({ items, active, control, title, className }: GroupLegendProps) {
  const colorById = React.useMemo(() => new Map(active.map(g => [g.id, g.color] as const)), [active])
  // A legend that goes away under the pointer takes its emphasis with it.
  const controlRef = React.useRef(control)
  controlRef.current = control
  React.useEffect(() => () => controlRef.current.emphasize(null), [])
  const { toggle } = control
  return (
    <div className={`gv-group-legend${className ? ` ${className}` : ''}`} onMouseLeave={() => control.emphasize(null)}>
      {title && <div className="gv-group-legend-title">{title}</div>}
      {items.map(item => {
        const on = control.shown(item.id)
        const color = colorById.get(item.id)
        const Row = toggle ? 'label' : 'div'
        return (
          <Row key={item.id} className={`gv-group-legend-row${on ? '' : ' off'}`} onMouseEnter={() => control.emphasize(item.id)}>
            {toggle && <input type="checkbox" checked={on} onChange={() => toggle(item.id)} />}
            <span className="gv-group-legend-swatch" style={{ background: color ?? 'transparent' }} />
            <span className="gv-group-legend-label">{item.label}</span>
            {on && color === undefined && <span className="gv-group-legend-note">not shown</span>}
          </Row>
        )
      })}
    </div>
  )
}
