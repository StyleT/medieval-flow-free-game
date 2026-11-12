import { isFlowConnected } from '../../engine/game.ts'
import type { ColorId, GameState } from '../../engine/types.ts'

/** Colors connected in `next` but not in `prev`, in color order. */
export function newlyConnected(prev: ReadonlySet<ColorId>, next: ReadonlySet<ColorId>): ColorId[] {
  return [...next].filter((c) => !prev.has(c)).sort()
}

export function connectedColors(state: GameState): Set<ColorId> {
  return new Set(state.level.pairs.filter((p) => isFlowConnected(state, p.color)).map((p) => p.color))
}
