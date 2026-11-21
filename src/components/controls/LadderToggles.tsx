import React from 'react'
import { useStrings } from '../graph-view/strings'
import type { Ladder } from './ladders'

/** A surface's collapsed ladders, expanded at first, and the toggle for one. */
export function useCollapsed(): [ReadonlySet<string>, (id: string) => void] {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (!next.delete(id)) next.add(id)
    return next
  })
  return [collapsed, toggle]
}

/** One toggle per drawn ladder, pressed while it is collapsed; nothing when there are none. */
export function LadderToggles({ ladders, collapsed, onToggle }: {
  ladders: readonly Ladder[]
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
}) {
  const s = useStrings()
  if (ladders.length === 0) return null
  return (
    <div className="gv-ctl-ladder-toggles">
      {ladders.map(l => (
        <button
          key={l.id}
          type="button"
          className="gv-ctl-ladder-toggle"
          aria-pressed={collapsed.has(l.id)}
          title={s.ladderToggle(l.id)}
          onClick={() => onToggle(l.id)}
        >
          {l.id}
        </button>
      ))}
    </div>
  )
}
