import { createProver } from './sat.ts'
import type { Cell, ColorId, Level } from './types.ts'

/** How good a level is: how many flows have exactly one possible route (proved on the whole board). */
export type Quality = {
  forced: ColorId[]
  forcedDetour: number // forced flows whose obvious short route is wrong (detour ≥ 2)
  totalDetour: number
  met: boolean
}

/** len − (manhattan(ends) + 1): always even, 0 for a monotone flow. */
export function detourOf(path: readonly Cell[]): number {
  const first = path[0]
  const last = path[path.length - 1]
  return path.length - (Math.abs(first.row - last.row) + Math.abs(first.col - last.col) + 1)
}

/** R16 quota: at least 30% of the flows forced, and one of them with a detour. */
export function meetsQuota(forced: number, forcedDetour: number, flows: number): boolean {
  return forced >= Math.max(1, Math.round(0.3 * flows)) && forcedDetour >= 1
}

/**
 * Counts forced flows with a SAT proof, longest detours first, stopping as soon as the quota is met
 * (unless `exhaustive`, which checks every flow). A flow whose proof passes `deadline` (epoch ms)
 * counts as not forced.
 */
export function analyzeLevel(level: Level, options: { exhaustive?: boolean; deadline?: number } = {}): Quality {
  const flows = level.pairs.length
  const detours = new Map(level.pairs.map((p) => [p.color, detourOf(level.solution[p.color])]))
  const order = level.pairs.map((p) => p.color).sort((x, y) => detours.get(y)! - detours.get(x)!)
  const prover = createProver(level, { deadline: options.deadline })
  const quality: Quality = {
    forced: [],
    forcedDetour: 0,
    totalDetour: [...detours.values()].reduce((x, y) => x + y, 0),
    met: false,
  }

  for (const color of order) {
    if (prover.check(color) !== 'forced') continue
    quality.forced.push(color)
    if (detours.get(color)! >= 2) quality.forcedDetour++
    quality.met = meetsQuota(quality.forced.length, quality.forcedDetour, flows)
    if (quality.met && !options.exhaustive) break
  }
  quality.forced.sort()
  return quality
}
