// A host's own chrome, themed as the pane is: the resolved theme, and the
// props that scope the library's tokens and the scheme's colours to the
// element they are spread on.

import React from 'react'
import { schemeVars } from '../../graph/scheme'
import type { Theme } from '../../graph/scheme'
import type { Taxonomy } from '../../graph/taxonomy'
import { useResolvedTheme } from './useTheme'
import type { ThemeChoice } from './useTheme'

/** The page's body, whose host is `<html>`: `system` reads its `data-theme`, else the OS. */
const BODY: React.RefObject<HTMLElement | null> = {
  get current() { return typeof document === 'undefined' ? null : document.body },
}

/**
 * The theme `choice` resolves to — `system` by default, read in a layout
 * effect so a dark host's chrome never paints light — and `scopeProps` to
 * spread on the chrome's root: its `data-gv-theme`, and the scheme's colours
 * and `tokens` for that theme as `style`.
 */
export function useScheme(taxonomy: Taxonomy, { choice = 'system', systemTheme, tokens }: {
  choice?: ThemeChoice
  systemTheme?: Theme
  tokens?: Readonly<Record<Theme, React.CSSProperties>>
} = {}) {
  const theme = useResolvedTheme(BODY, choice, systemTheme) ?? 'light'
  const style = React.useMemo<React.CSSProperties>(() => ({ ...schemeVars(taxonomy, theme), ...tokens?.[theme] }), [taxonomy, theme, tokens])
  return { theme, scopeProps: { 'data-gv-theme': theme, style } }
}
