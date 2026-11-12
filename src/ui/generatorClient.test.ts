import { describe, expect, it } from 'vitest'
import { hashGrid, levelFromResponse } from './generatorClient.ts'

describe('levelFromResponse', () => {
  it('builds a level with a stable id from the grid', () => {
    const a = levelFromResponse({ grid: ['AB', 'AB'] }, '2×2')
    const b = levelFromResponse({ grid: ['AB', 'AB'] }, '2×2')
    expect(a.id).toBe(b.id)
    expect(a.name).toBe('2×2')
    expect(a.pairs).toHaveLength(2)
  })
  it('rejects an error answer', () => {
    expect(() => levelFromResponse({ error: 'boom' }, 'x')).toThrow('boom')
  })
  it('rejects a grid that does not parse', () => {
    expect(() => levelFromResponse({ grid: ['AB', 'A'] }, 'x')).toThrow()
  })
})

describe('hashGrid', () => {
  it('differs for different grids and is stable for the same one', () => {
    expect(hashGrid(['AB', 'AB'])).toBe(hashGrid(['AB', 'AB']))
    expect(hashGrid(['AB', 'AB'])).not.toBe(hashGrid(['AA', 'BB']))
  })
  it('does not confuse row boundaries', () => {
    expect(hashGrid(['AB', 'C'])).not.toBe(hashGrid(['A', 'BC']))
  })
})
