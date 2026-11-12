// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const theme = readFileSync('src/styles/theme.css', 'utf8')
const token = (name: string): string => {
  const hex = new RegExp(`--${name}: (#[0-9a-fA-F]{6})`).exec(theme)?.[1]
  if (!hex) throw new Error(`token --${name} not found`)
  return hex
}

const channel = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
export const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Face colours of the 9-slice art and the board floor (read from palette.px.js / the built sprites).
const FLOOR = '#262338'
const PARCHMENT = '#dfaf73'
const PLATE = '#f1dcae'
const WOOD = '#8a5a34'
const GOLD = '#e6d26b'
const STONE_DARK = '#58586f'

describe('contrast helper', () => {
  it('measures the extremes and a known pair', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })
  it('fails a deliberately bad pair', () => {
    expect(contrast('#9c2036', '#262338')).toBeLessThan(3)
  })
})

describe('text contrast (WCAG AA, 4.5:1)', () => {
  it.each([
    ['text on page', token('text'), token('surface')],
    ['muted on page', token('muted'), token('surface')],
    ['muted on surface-2', token('muted'), token('surface-2')],
    ['text on wood button', token('text'), WOOD],
    ['ink on gold button', '#2a1a10', GOLD],
    ['ink on parchment panel', '#2a1a10', PARCHMENT],
    ['muted-ink on parchment panel', token('muted-ink'), PARCHMENT],
    ['ink on map caption plate', '#2a1a10', PLATE],
    ['star on page', token('star'), token('surface')],
  ])('%s', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
  it('muted text on the dark stone panel', () => {
    expect(contrast(token('muted'), STONE_DARK)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('flow colours against the board floor (graphics, 3:1)', () => {
  for (const letter of 'ABCDEFGHIJKLMNOP') {
    it(`flow ${letter}`, () => {
      expect(contrast(token(`flow-${letter}`), FLOOR)).toBeGreaterThanOrEqual(3)
    })
  }
})

describe('parchment panels re-point the Tailwind colour tokens', () => {
  const css = readFileSync('src/styles/pixel-ui.css', 'utf8')
  const panel = /\.px-panel \{([^}]*)\}/.exec(css)?.[1] ?? ''
  const value = (name: string) => new RegExp(`--${name}: ([^;]+);`).exec(panel)?.[1]?.trim()

  it('overrides --color-muted and --color-star, which text-muted and text-star actually use', () => {
    expect(value('color-muted')).toBeDefined()
    expect(value('color-star')).toBeDefined()
  })
  it('makes muted and star text readable on the parchment face (4.5:1)', () => {
    expect(contrast(token('muted-ink'), PARCHMENT)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(value('color-star') as string, PARCHMENT)).toBeGreaterThanOrEqual(4.5)
  })
  it('would fail with the page-level cream muted colour (the bug this guards against)', () => {
    expect(contrast(token('muted'), PARCHMENT)).toBeLessThan(3)
  })
})
