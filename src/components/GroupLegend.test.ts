// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { GroupLegend } from './GroupLegend'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it("holds the host's controls in its box, above the items that scroll", async () => {
  const el = document.createElement('div')
  const root = createRoot(el)
  const control = { shown: () => true, emphasize: () => {} }
  await act(async () => root.render(React.createElement(GroupLegend,
    { title: 'Groups', items: [{ id: 'a', label: 'A' }], active: [], control },
    React.createElement('select', { className: 'picker' }))))
  const legend = el.querySelector('.gv-group-legend')!
  expect([...legend.children].map(c => c.className)).toEqual(['gv-group-legend-title', 'picker', 'gv-group-legend-items'])
  expect(legend.querySelector('.gv-group-legend-items .gv-group-legend-label')!.textContent).toBe('A')
  act(() => root.unmount())
})
