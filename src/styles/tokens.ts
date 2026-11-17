// The typed path to `tokens.css`: one role per token, named by dropping
// `--gv-` and camel-casing the rest, so a host's theme object produces the
// variables its CSS would declare.

import type React from 'react'
import { cssSuffix } from '../graph/scheme'
import type { Theme } from '../graph/scheme'

/** Every token `tokens.css` declares, by role. */
export const TOKEN_ROLES = [
  'accent', 'accentTintWeak', 'accentTintHover', 'accentTintActive', 'accentTintRing',
  'insetBg', 'keyBg', 'tooltipShadow',
  'tensionStretch', 'tensionCompress', 'tensionRest',
  'diagnosticError', 'diagnosticWarning',
  'colorBg', 'colorBgGradient', 'colorText', 'colorTextMuted', 'colorGraphLabel',
  'colorSurface', 'colorBorder',
  'fontMono', 'fontSans', 'radius',
  'focusRingColor', 'selectionRingColor', 'badgeFill', 'badgeText',
] as const

type TokenRole = (typeof TOKEN_ROLES)[number]

/** The custom property a role is declared under: `focusRingColor` → `--gv-focus-ring-color`. */
export const tokenVar = (role: TokenRole): string => `--gv-${cssSuffix(role)}`

/** Per theme, the tokens a host overrides, as the variables a root carries inline. */
export function createTheme(themes: { readonly [T in Theme]?: { readonly [R in TokenRole]?: string } }): Readonly<Record<Theme, React.CSSProperties>> {
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
