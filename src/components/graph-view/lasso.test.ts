import { expect, it } from 'vitest'
import { lassoed } from './lasso'

it('encloses exactly the nodes whose centres lie inside the polygon', () => {
  // An L in screen pixels: its notch, top right, is outside.
  const path = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
  const nodes = [
    { id: 'in-arm', x: 10, y: 10 },
    { id: 'in-foot', x: 40, y: 37 },
    { id: 'notch', x: 40, y: 10 },
    { id: 'beyond', x: 60, y: 60 },
  ]
  // World to screen: doubled, then shifted by (-10, 0).
  expect(lassoed(path, nodes, { x: -10, y: 0, scale: 2 })).toEqual(['in-arm', 'in-foot'])
})
