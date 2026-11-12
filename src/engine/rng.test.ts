import { describe, expect, it } from 'vitest'
import { mulberry32, randInt, shuffle } from './rng.ts'

const take = (seed: number, n: number) => {
  const rng = mulberry32(seed)
  return Array.from({ length: n }, () => rng())
}

describe('rng', () => {
  it('the same seed gives the same sequence', () => {
    expect(take(42, 10)).toEqual(take(42, 10))
  })
  it('different seeds give different sequences', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10))
  })
  it('values stay in [0, 1)', () => {
    for (const v of take(7, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('randInt(rng, 1) is always 0 and stays below the max', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 100; i++) expect(randInt(rng, 1)).toBe(0)
    const rng2 = mulberry32(3)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(randInt(rng2, 5))
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4])
  })
  it('shuffle is a permutation and does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(mulberry32(9), input)
    expect([...out].sort((a, b) => a - b)).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(out).not.toEqual(input)
  })
  it('shuffle handles empty and single-item arrays', () => {
    expect(shuffle(mulberry32(1), [])).toEqual([])
    expect(shuffle(mulberry32(1), ['x'])).toEqual(['x'])
  })
})
