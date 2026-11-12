import { isSolved } from './game.ts'
import type { GameState } from './types.ts'

/** R14: stars only on solve; minimum 1, maximum 3. */
export function starsFor(s: GameState): 0 | 1 | 2 | 3 {
  if (!isSolved(s)) return 0
  const extraMoves = s.moves > s.level.optimalMoves ? 1 : 0
  const stars = Math.min(3, Math.max(1, 3 - s.hintsUsed - extraMoves))
  return stars as 1 | 2 | 3
}
