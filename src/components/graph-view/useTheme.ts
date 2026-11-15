// The pane's theme. The user's choice is system, light or dark; the resolved
// theme is that choice, or — for system — the host's: what it passes as
// `systemTheme`, else the nearest ancestor that declares one with
// `data-theme`, else `prefers-color-scheme`, the last two observed so a host
// that switches mid-session is followed. The pane then carries the resolved
// theme as its own `data-theme`, so its stylesheet tokens follow the same
// answer the canvas draws with — one resolver, not two.

import React from 'react'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import type { Theme } from '../../graph/scheme'

/** A theme choice: `system` follows the host, `light` and `dark` are fixed. */
export type ThemeChoice = 'system' | Theme

/** The three choices, in the order the pane's button cycles them. */
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark']

/** A persisted or host-supplied choice, or system for anything outside the three: discard the field, not the state. */
export function themeChoiceOf(value: unknown): ThemeChoice {
  return (THEME_CHOICES as readonly unknown[]).includes(value) ? (value as ThemeChoice) : 'system'
}

/** What an element that marks a theme says: its `data-theme`. */
export interface ThemeMarker {
  getAttribute(name: string): string | null
}

/** The one attribute the library reads a host's theme from. */
export const THEME_MARKER_SELECTOR = '[data-theme]'

/** The theme a marker declares; a `data-theme` outside light and dark declares nothing. */
export function themeOfMarker(marker: ThemeMarker | null): Theme | undefined {
  if (!marker) return undefined
  const attr = marker.getAttribute('data-theme')
  return attr === 'dark' || attr === 'light' ? attr : undefined
}

/** What the host has decided ABOVE `el`: the nearest marking ancestor, else the OS. */
export function hostTheme(el: Element | null): Theme {
  let marker: Element | null = el?.parentElement?.closest(THEME_MARKER_SELECTOR) ?? null
  while (marker) {
    const theme = themeOfMarker(marker)
    if (theme) return theme
    marker = marker.parentElement?.closest(THEME_MARKER_SELECTOR) ?? null
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The host's theme for the element at `ref`, or undefined until the layout effect has read it. */
function useHostRead(ref: React.RefObject<HTMLElement | null>, enabled: boolean): Theme | undefined {
  const [host, setHost] = React.useState<Theme>()
  useIsomorphicLayoutEffect(() => {
    if (!enabled) return
    const read = () => setHost(hostTheme(ref.current))
    read()
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: true })
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener?.('change', read)
    return () => { observer.disconnect(); media?.removeEventListener?.('change', read) }
  }, [ref, enabled])
  return host
}

/**
 * The host's theme for the element at `ref`, re-read when any ancestor's
 * `data-theme` changes and when the OS preference changes. Light until read,
 * the server's answer, so a hydrating render matches it; with `enabled`
 * false nothing is read or observed, and the answer stays light.
 */
export function useHostTheme(ref: React.RefObject<HTMLElement | null>, enabled = true): Theme {
  return useHostRead(ref, enabled) ?? 'light'
}

/** The pane's resolved theme, undefined until the host is read. */
export function useResolvedTheme(ref: React.RefObject<HTMLElement | null>, choice: ThemeChoice, systemTheme?: Theme): Theme | undefined {
  const host = useHostRead(ref, systemTheme === undefined)
  return choice === 'system' ? systemTheme ?? host : choice
}

/** The theme the pane rooted at `ref` draws in: the resolved theme, light until read. */
export function useTheme(ref: React.RefObject<HTMLElement | null>, choice: ThemeChoice, systemTheme?: Theme): Theme {
  return useResolvedTheme(ref, choice, systemTheme) ?? 'light'
}
