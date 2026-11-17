// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { ColorLegend } from './ColorLegend'
import type { ColorLegendProps } from './ColorLegend'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const key = (id: string, visible = true) => ({ id, label: id.toUpperCase(), color: '#123456', visible })

async function render(props: Partial<ColorLegendProps>, children?: React.ReactNode) {
  const el = document.createElement('div')
  const root = createRoot(el)
  const control = { shown: (id: string) => id !== 'off', toggle: vi.fn(), emphasize: vi.fn() }
  await act(async () => root.render(React.createElement(ColorLegend, { channels: {}, control, ...props }, children)))
  return { el, control, unmount: () => act(() => root.unmount()) }
}

const rows = (section: Element) => [...section.querySelectorAll('.gv-color-legend-row')]

it("holds the host's controls above a section per channel present, fill, glow, ring, each titled", async () => {
  const view = await render(
    { channels: { ring: [key('r')], fill: [key('f')] }, titles: { ring: 'Term' } },
    React.createElement('select', { className: 'picker' }),
  )
  const legend = view.el.querySelector('.gv-color-legend')!
  expect([...legend.children].map(c => c.className)).toEqual(['picker', 'gv-color-legend-items'])
  expect([...legend.querySelectorAll('.gv-color-legend-title')].map(t => t.textContent)).toEqual(['Fill', 'Term'])
  expect(legend.querySelector('.gv-color-legend-label')!.textContent).toBe('F')
  view.unmount()
})

it('reads fill and ring rows only, and toggles and emphasises glow rows', async () => {
  const view = await render({ channels: { fill: [key('f')], glow: [key('g'), key('off')], ring: [key('r')] } })
  const [fill, glow, ring] = view.el.querySelectorAll('.gv-color-legend-section')
  for (const section of [fill!, ring!]) {
    expect(section.querySelector('input')).toBeNull()
    act(() => rows(section)[0]!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
  }
  expect(view.control.emphasize).not.toHaveBeenCalled()
  const [g, off] = rows(glow!)
  expect(off!.className).toContain('off')
  await act(async () => g!.querySelector('input')!.click())
  expect(view.control.toggle).toHaveBeenCalledWith('g')
  act(() => g!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
  expect(view.control.emphasize).toHaveBeenLastCalledWith('g')
  view.unmount()
})

it('says a shown key no visible node wears is not shown', async () => {
  const view = await render({ channels: { fill: [key('f', false)], glow: [key('g', false), key('off', false)] } })
  const notes = [...view.el.querySelectorAll('.gv-color-legend-row')].map(r => r.querySelector('.gv-color-legend-note')?.textContent)
  expect(notes).toEqual(['not shown', 'not shown', undefined])
  view.unmount()
})
