// The tokens the canvas draws in, read from the stylesheet once per theme or
// style change rather than while a frame draws.

import React from 'react'
import { cssSuffix } from '../../graph/scheme'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

/** The canvas's tokens, by role: `focusRingColor` reads `--gv-focus-ring-color`. */
const ROLES = [
  'colorGraphLabel', 'colorText', 'colorTextMuted',
  'focusRingColor', 'selectionRingColor', 'badgeFill', 'badgeText',
  'tensionStretch', 'tensionCompress', 'tensionRest', 'fontSans',
] as const

/** Each canvas token's resolved value, by role. */
export type Palette = Readonly<Record<(typeof ROLES)[number], string>>

/**
 * The palette `el` inherits: the pane's tokens, a host's overrides included,
 * not the document's. `--gv-font-sans` left `inherit`, as it is by default,
 * resolves empty, so the canvas takes the font `el` inherits.
 */
function resolvePalette(el: Element): Palette {
  const style = getComputedStyle(el)
  const palette = Object.fromEntries(ROLES.map(role => [role, style.getPropertyValue(`--gv-${cssSuffix(role)}`).trim()])) as Palette
  return { ...palette, fontSans: palette.fontSans || style.fontFamily }
}

/**
 * The palette of the element at `ref`, resolved on mount and again whenever
 * its nearest themed root changes `data-gv-theme`, `class` or `style`;
 * undefined until the first resolve.
 */
export function usePalette(ref: React.RefObject<Element | null>): Palette | undefined {
  const [palette, setPalette] = React.useState<Palette>()
  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const resolve = () => setPalette(resolvePalette(el))
    resolve()
    const root = el.closest('[data-gv-theme]')
    if (!root || typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(resolve)
    observer.observe(root, { attributes: true, attributeFilter: ['data-gv-theme', 'class', 'style'] })
    return () => observer.disconnect()
  }, [ref])
  return palette
}
