import { describe, expect, it } from 'vitest'
import { applyPixelScale, cssPixelSize } from './pixelScale.ts'

describe('cssPixelSize', () => {
  it('uses 3 CSS px on a wide 1x screen and 2 on a narrow one', () => {
    expect(cssPixelSize(1280, 1)).toBe(3)
    expect(cssPixelSize(360, 1)).toBe(2)
  })
  it('keeps an integer number of device pixels at every DPR', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3, 3.5]) {
      for (const width of [320, 390, 1440]) {
        const device = cssPixelSize(width, dpr) * dpr
        expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-9)
      }
    }
  })
  it('gives 1.5 CSS px (3 device px) on a 2x phone-width screen', () => {
    expect(cssPixelSize(360, 2)).toBe(2)
    expect(cssPixelSize(390, 2)).toBe(3)
  })
  it('switches scale exactly at 380px', () => {
    expect(cssPixelSize(379, 1)).toBe(2)
    expect(cssPixelSize(380, 1)).toBe(3)
  })
  it('falls back to DPR 1 for invalid values', () => {
    for (const dpr of [0, -2, NaN, Infinity, 0.5]) expect(cssPixelSize(1280, dpr)).toBe(3)
  })
})

describe('applyPixelScale', () => {
  it('writes --px on the root element', () => {
    const set: Record<string, string> = {}
    const el = { style: { setProperty: (k: string, v: string) => (set[k] = v) } } as unknown as HTMLElement
    applyPixelScale(el, { innerWidth: 1280, devicePixelRatio: 2.625 })
    expect(set['--px']).toBe(`${Math.round(3 * 2.625) / 2.625}px`)
  })
})
