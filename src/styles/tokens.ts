// The typed path to `tokens.css`: one role per host-facing token, named by
// dropping `--gv-` and camel-casing the rest, so a host's theme object
// produces the variables its CSS would declare; and the scheme's stylesheet
// for a host's own CSS.

import type React from 'react'
import { fillOf } from '../graph/coloring'
import type { Coloring, Fill } from '../graph/coloring'
import type { Graph } from '../graph/model'
import { cssSuffix, keyVars, schemeVars } from '../graph/scheme'
import type { Theme } from '../graph/scheme'
import type { Taxonomy } from '../graph/taxonomy'

/** Every token the README's Theming table offers a host, by role. */
export const TOKEN_ROLES = [
  'colorSurface', 'colorBg', 'colorText', 'colorTextMuted', 'colorBorder',
  'accent', 'focusRingColor', 'selectionRingColor', 'colorGraphLabel',
  'badgeFill', 'badgeText', 'onAccent', 'colorAttention', 'panelShadow', 'barShadow',
  'fontSans', 'fontMono', 'radius',
] as const

type TokenRole = (typeof TOKEN_ROLES)[number]

/** Per theme, the variables a root carries inline: what `createTheme` produces. */
export type ThemeTokens = Readonly<Record<Theme, React.CSSProperties>>

/** The custom property a role is declared under: `focusRingColor` → `--gv-focus-ring-color`. */
export const tokenVar = (role: TokenRole): string => `--gv-${cssSuffix(role)}`

/** Per theme, the tokens a host overrides, as the variables a root carries inline. */
export function createTheme(themes: { readonly [T in Theme]?: { readonly [R in TokenRole]?: string } }): ThemeTokens {
  const varsOf = (theme: Theme): React.CSSProperties => {
    const vars: Record<string, string> = {}
    for (const role of TOKEN_ROLES) {
      const value = themes[theme]?.[role]
      if (value !== undefined) vars[tokenVar(role)] = value
    }
    return vars
  }
  return { light: varsOf('light'), dark: varsOf('dark') }
}

/** A themed root's inline style for one theme: the scheme's colours, the fill's over them, then the host's tokens. */
export function scopeStyle(taxonomy: Taxonomy, theme: Theme, tokens?: ThemeTokens, fill?: Fill): React.CSSProperties {
  return { ...schemeVars(taxonomy, theme), ...(fill && keyVars(fill, theme)), ...tokens?.[theme] }
}

/**
 * A stylesheet for a host's own CSS: every style value's fill and border on
 * `:root`, and the dark values that differ under `darkSelector` — by default
 * `[data-theme="dark"]`, the attribute the pane reads a host's theme from; a
 * host that marks its theme another way names its own selector. Given the
 * `coloring` and `graph` the pane takes, it carries the fill's keys too,
 * under the names the pane gives them. The pane does not read this — it
 * carries the same inline — so a host that styles nothing of its own by node
 * colour never needs it.
 */
export function schemeStylesheet(
  taxonomy: Taxonomy,
  darkSelector = '[data-theme="dark"]',
  view?: { coloring?: { fill?: Coloring }; graph: Graph },
): string {
  const fill = view && fillOf(view.coloring?.fill, view.graph, taxonomy)
  const light = scopeStyle(taxonomy, 'light', undefined, fill) as Record<string, unknown>
  const dark = Object.entries(scopeStyle(taxonomy, 'dark', undefined, fill)).filter(([v, value]) => value !== light[v])
  const block = (selector: string, vars: [string, unknown][]) => `${selector} {\n${vars.map(([v, value]) => `  ${v}: ${value};`).join('\n')}\n}`
  return dark.length > 0 ? `${block(':root', Object.entries(light))}\n${block(darkSelector, dark)}` : block(':root', Object.entries(light))
}
