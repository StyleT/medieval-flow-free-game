import { describe, expect, it } from 'vitest'
import { BURST, burstParticles } from './burst.ts'

describe('burstParticles', () => {
  it('is reproducible per seed and differs between seeds', () => {
    expect(burstParticles(10, 3)).toEqual(burstParticles(10, 3))
    expect(burstParticles(10, 3)).not.toEqual(burstParticles(10, 4))
  })
  it('returns the requested count', () => {
    expect(burstParticles(10, 1)).toHaveLength(10)
    expect(burstParticles(1, 1)).toHaveLength(1)
  })
  it('returns [] for 0, negative and invalid counts', () => {
    for (const n of [0, -1, NaN, -Infinity]) expect(burstParticles(n, 1)).toEqual([])
  })
  it('keeps every value inside its bounds', () => {
    for (const p of burstParticles(200, 9)) {
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(BURST.maxDx)
      expect(p.dy).toBeGreaterThanOrEqual(BURST.minDy)
      expect(p.dy).toBeLessThanOrEqual(BURST.maxDy)
      expect(p.delay).toBeGreaterThanOrEqual(0)
      expect(p.delay).toBeLessThanOrEqual(BURST.maxDelay)
      expect([-1, 1]).toContain(p.spin)
    }
  })
  it('always throws coins upward', () => {
    expect(burstParticles(50, 2).every((p) => p.dy < 0)).toBe(true)
  })
})
