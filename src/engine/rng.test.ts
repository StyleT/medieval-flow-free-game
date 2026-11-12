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
  it('mulberry32 is pinned to golden values (committed levels depend on them)', () => {
    expect(take(42, 3)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099])
    expect(take(0, 1)[0]).toBe(mulberry32(2 ** 32)()) // the seed is taken as an unsigned 32-bit integer
  })
  it('shuffle is pinned to a golden permutation for a fixed seed', () => {
    expect(shuffle(mulberry32(9), [1, 2, 3, 4, 5, 6, 7, 8])).toEqual([8, 7, 4, 3, 5, 1, 6, 2])
  })
  it('shuffle draws exactly n - 1 numbers (none for the last, self-swap position)', () => {
    const rng = mulberry32(5)
    shuffle(rng, ['a', 'b', 'c'])
    expect(rng()).toBe(take(5, 3)[2])
    const single = mulberry32(5)
    shuffle(single, ['a'])
    expect(single()).toBe(take(5, 1)[0])
  })
})
