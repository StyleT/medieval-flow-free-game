import { mulberry32 } from '../../engine/rng.ts'

export type Particle = { dx: number; dy: number; delay: number; spin: number }

export const BURST = { maxDx: 140, minDy: -190, maxDy: -70, maxDelay: 400 } as const

/** Coin burst: an arc up and out, reproducible per seed. Units are CSS px and ms. */
export function burstParticles(n: number, seed: number): Particle[] {
  if (!Number.isFinite(n) || n <= 0) return []
  const rng = mulberry32(seed)
  return Array.from({ length: Math.floor(n) }, () => ({
    dx: Math.round((rng() * 2 - 1) * BURST.maxDx),
    dy: Math.round(BURST.minDy + rng() * (BURST.maxDy - BURST.minDy)),
    delay: Math.round(rng() * BURST.maxDelay),
    spin: rng() < 0.5 ? -1 : 1,
  }))
}
