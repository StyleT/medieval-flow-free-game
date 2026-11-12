// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('art/board.px.js', 'utf8')
const block = /const MARKS = \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
const marks = [...block.matchAll(/([A-P]): \[([^\]]*)\]/g)].map(([, letter, rows]) => ({
  letter,
  glyph: rows.replace(/[\s"]/g, '').split(',').join('/'),
}))

describe('gem marks (colour-independent identity)', () => {
  it('defines a mark for every flow A–P', () => {
    expect(marks.map((m) => m.letter).join('')).toBe('ABCDEFGHIJKLMNOP')
  })
  it('gives every flow a different glyph', () => {
    expect(new Set(marks.map((m) => m.glyph)).size).toBe(16)
  })
  it('keeps marks small enough to sit on the gem face and never empty', () => {
    for (const { glyph } of marks) {
      const rows = glyph.split('/')
      expect(rows.length).toBeLessThanOrEqual(5)
      expect(rows.every((r) => r.length <= 4)).toBe(true)
      expect(glyph).toContain('M')
    }
  })
})
