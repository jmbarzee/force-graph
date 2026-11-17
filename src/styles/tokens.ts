// The typed path to `tokens.css`: one role per host-facing token, named by
// dropping `--gv-` and camel-casing the rest, so a host's theme object
// produces the variables its CSS would declare.

import type React from 'react'
import { cssSuffix, schemeVars } from '../graph/scheme'
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

/** A themed root's inline style: the scheme's colours, then the host's tokens, for one theme. */
export function scopeStyle(taxonomy: Taxonomy, theme: Theme, tokens?: ThemeTokens): React.CSSProperties {
  return { ...schemeVars(taxonomy, theme), ...tokens?.[theme] }
}
