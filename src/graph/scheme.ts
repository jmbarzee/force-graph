// The colour scheme — what a taxonomy's colours look like, in both themes at
// once, and the three readers that turn them into pixels: the custom-property
// name a value's colour is published under, the inline variables a pane
// carries for the resolved theme, and a colour normaliser for the canvas,
// which cannot throw and so reads only the forms the taxonomy admits.

import type React from 'react'
import type { AxisValue } from './axis'
import type { Fill } from './coloring'
import type { Taxonomy } from './taxonomy'

/** The two themes every colour is declared in. */
export type Theme = 'light' | 'dark'
/** Both themes, in order. */
export const THEMES: readonly Theme[] = ['light', 'dark']

/** A fill and a border. */
export interface ColorPair {
  /** Canvas fill colour. */
  readonly fill: string
  /** Canvas border colour, a few stops darker than the fill. */
  readonly border: string
}

/** A value's colour in both themes — declared together, so no half can go missing. */
export interface ThemedColor {
  /** The fill and border in the light theme. */
  readonly light: ColorPair
  /** The fill and border in the dark theme. */
  readonly dark: ColorPair
}

/** One colour per theme: hex, `rgb()` or `hsl()` in each. */
export interface ThemedHue {
  /** The colour in the light theme. */
  readonly light: string
  /** The colour in the dark theme. */
  readonly dark: string
}

/** How an edge type is stroked. */
export interface EdgeStroke {
  /** The stroke's colour per theme. */
  readonly color: ThemedHue
  /** The stroke's base opacity, 0 to 1. */
  readonly alpha: number
  /** The canvas dash pattern; empty is solid. */
  readonly dash: readonly number[]
  /** The stroke's width. */
  readonly width: number
}

/**
 * The stem of a value's custom-property name: the value id in kebab case
 * (`twoWords` → `two-words`). Derived, never stored.
 */
export function cssSuffix(value: AxisValue): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}


/**
 * The inline custom properties a pane carries for one theme: every style
 * value's fill and border, under its fill's keys. Set on the pane's root,
 * they follow the resolved theme by being recomputed, not overridden.
 */
export function schemeVars(taxonomy: Taxonomy, theme: Theme): React.CSSProperties {
  const vars: Record<string, string> = {}
  for (const key of taxonomy.styleValues) {
    const c = taxonomy.styleOf(key).color[theme]
    vars[taxonomy.colorVar(key)] = c.fill
    vars[`${taxonomy.colorVar(key)}-border`] = c.border
  }
  return vars
}

/** The fill's keys under the names it gives them, for one theme: a pane's `--gv-node-*` follows its fill. */
export function keyVars(fill: Fill, theme: Theme): React.CSSProperties {
  const vars: Record<string, string> = {}
  for (const { color, cssVar } of fill.keys.values()) {
    vars[cssVar] = color[theme].fill
    vars[`${cssVar}-border`] = color[theme].border
  }
  return vars
}

/**
 * The cycling palette a key with no colour of its own takes a slot in. Keys
 * are told apart by a legend, so the ten hues only separate the handful shown
 * at once; the light half is each hue a few stops deeper, to read on a pale
 * canvas.
 */
export const PALETTE: readonly ThemedHue[] = [
  { light: '#0F766E', dark: '#2DD4BF' }, // teal
  { light: '#B45309', dark: '#F59E0B' }, // amber
  { light: '#6D28D9', dark: '#A78BFA' }, // violet
  { light: '#BE185D', dark: '#F472B6' }, // rose
  { light: '#047857', dark: '#34D399' }, // green
  { light: '#1D4ED8', dark: '#60A5FA' }, // blue
  { light: '#C2410C', dark: '#FB923C' }, // orange
  { light: '#4D7C0F', dark: '#A3E635' }, // lime
  { light: '#0E7490', dark: '#22D3EE' }, // cyan
  { light: '#A21CAF', dark: '#E879F9' }, // fuchsia
]

/** A key's hue: a string serves both themes; absent, the palette's at `slot`. */
export function hueOf(color: string | ThemedHue | undefined, slot: number): ThemedHue {
  if (color === undefined) return PALETTE[slot % PALETTE.length]
  return typeof color === 'string' ? { light: color, dark: color } : color
}

/** A hue as a body's fill, with a border of its RGB × 0.6. */
export function pairOf(hue: ThemedHue): ThemedColor {
  const border = (color: string): string =>
    `#${(rgbOf(color) ?? NEUTRAL).map(c => Math.round(c * 0.6).toString(16).padStart(2, '0')).join('')}`
  return {
    light: { fill: hue.light, border: border(hue.light) },
    dark: { fill: hue.dark, border: border(hue.dark) },
  }
}

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const RGB = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i
const HSL = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i

/** CSS's hsl → rgb, hue in degrees, saturation and lightness in percent, channels rounded to 0–255. */
function hslToRgb(h: number, s: number, l: number): readonly [number, number, number] {
  const sat = Math.min(100, Math.max(0, s)) / 100
  const light = Math.min(100, Math.max(0, l)) / 100
  const hue = ((h % 360) + 360) % 360
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = light - chroma / 2
  const [r, g, b] =
    hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x]
    : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/**
 * The red, green and blue of a scheme colour, or undefined. A scheme colour
 * is hex of either length, `rgb()`/`rgba()` or `hsl()`/`hsla()` — a form
 * every reader can parse without a browser, so the taxonomy can refuse
 * anything else at construction (`isSchemeColor`) and no reader meets a
 * colour it cannot read.
 */
export function rgbOf(color: string): readonly [number, number, number] | undefined {
  const c = color.trim()
  let m = HEX6.exec(c)
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
  m = HEX3.exec(c)
  if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)]
  m = RGB.exec(c)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  m = HSL.exec(c)
  if (m) return hslToRgb(Number(m[1]), Number(m[2]), Number(m[3]))
  return undefined
}

/** Whether a colour, or each half of a hue, is one every reader parses: hex, `rgb()` or `hsl()`. */
export const isSchemeColor = (color: string | ThemedHue): boolean =>
  typeof color === 'string' ? rgbOf(color) !== undefined : isSchemeColor(color.light) && isSchemeColor(color.dark)

const NEUTRAL: readonly [number, number, number] = [148, 163, 184]
const REFUSED = new Set<string>()

/**
 * A colour at an alpha, as `rgba()`, for a canvas gradient or fill. A colour
 * outside the scheme's forms becomes a neutral grey, said once per colour on
 * the console — never a throw, because this runs inside the draw loop.
 * Unreachable for a taxonomy's colours, which are refused at
 * construction; it guards the library's own group palette and any caller
 * that bypasses the taxonomy.
 */
export function withAlpha(color: string, alpha: number): string {
  let rgb = rgbOf(color)
  if (!rgb) {
    if (!REFUSED.has(color)) {
      REFUSED.add(color)
      console.error(`[scheme] ${JSON.stringify(color)} is not a colour the canvas can read; drawing it neutral`)
    }
    rgb = NEUTRAL
  }
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

/**
 * A stylesheet for a host's own CSS: every style value's fill and border on
 * `:root`, and the dark values that differ under `darkSelector` — by default
 * `[data-theme="dark"]`, the attribute the pane reads a host's theme from; a
 * host that marks its theme another way names its own selector. The pane
 * does not read this — it carries `schemeVars` inline — so a host that
 * styles nothing of its own by node value never needs it.
 */
export function schemeStylesheet(taxonomy: Taxonomy, darkSelector = '[data-theme="dark"]'): string {
  const lightVars: string[] = []
  const darkVars: string[] = []
  for (const key of taxonomy.styleValues) {
    const { light, dark } = taxonomy.styleOf(key).color
    const v = taxonomy.colorVar(key)
    lightVars.push(`  ${v}: ${light.fill};`)
    lightVars.push(`  ${v}-border: ${light.border};`)
    if (dark.fill !== light.fill) darkVars.push(`  ${v}: ${dark.fill};`)
    if (dark.border !== light.border) darkVars.push(`  ${v}-border: ${dark.border};`)
  }
  const parts: string[] = [`:root {\n${lightVars.join('\n')}\n}`]
  if (darkVars.length > 0) parts.push(`${darkSelector} {\n${darkVars.join('\n')}\n}`)
  return parts.join('\n')
}
