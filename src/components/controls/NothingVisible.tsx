// What a force control shows in place of its map or plot when the visible set
// holds nothing on its axis, so a filter that hides every node says why.

import './controls.css'

export function NothingVisible() {
  return <p className="gv-ctl-nothing-visible">Nothing visible on this axis — turn a chip on.</p>
}
