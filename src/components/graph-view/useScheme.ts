// A host's own chrome, themed as the pane is: the resolved theme, and the
// props that scope the library's tokens and the scheme's colours to the
// element they are spread on.

import React from 'react'
import { scopeStyle } from '../../styles/tokens'
import type { ThemeTokens } from '../../styles/tokens'
import { coloringsEqual, fillOf } from '../../graph/coloring'
import type { Coloring } from '../../graph/coloring'
import type { Graph } from '../../graph/model'
import type { Theme } from '../../graph/scheme'
import type { Taxonomy } from '../../graph/taxonomy'
import { useStable } from './useControllable'
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
 * and `tokens` for that theme as `style` — with the fill's keys, as the pane
 * publishes them, given the `coloring` and `graph` the pane takes as `view`.
 */
export function useScheme(taxonomy: Taxonomy, { choice = 'system', systemTheme, tokens, view }: {
  choice?: ThemeChoice
  systemTheme?: Theme
  tokens?: ThemeTokens
  view?: { coloring?: { fill?: Coloring }; graph: Graph }
} = {}) {
  const theme = useResolvedTheme(BODY, choice, systemTheme) ?? 'light'
  const coloring = useStable(view?.coloring?.fill, coloringsEqual)
  const graph = view?.graph
  const fill = React.useMemo(() => graph && fillOf(coloring, graph, taxonomy), [coloring, graph, taxonomy])
  const style = React.useMemo(() => scopeStyle(taxonomy, theme, tokens, fill), [taxonomy, theme, tokens, fill])
  return { theme, scopeProps: { 'data-gv-theme': theme, style } }
}
