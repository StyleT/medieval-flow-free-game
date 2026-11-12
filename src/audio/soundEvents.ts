import { isFlowConnected, isSolved } from '../engine/game.ts'
import type { GameState } from '../engine/types.ts'
import type { SoundEvent } from './soundMap.ts'

export const MAX_RATE_STEPS = 16
export const BACKTRACK_RATE = 0.8
export const CONNECT_RATE_MIN = 0.9
export const CONNECT_RATE_MAX = 1.2

export const stepRate = (length: number): number => 1 + Math.min(length, MAX_RATE_STEPS) * 0.035

/** Each color gets its own pitch, spread evenly over the connect range. */
export function connectRate(colorIndex: number, colorCount: number): number {
  if (colorCount <= 1) return CONNECT_RATE_MIN
  return CONNECT_RATE_MIN + ((CONNECT_RATE_MAX - CONNECT_RATE_MIN) * colorIndex) / (colorCount - 1)
}

const newlyConnected = (prev: GameState, next: GameState): number => {
  return next.level.pairs.findIndex(
    (p) => isFlowConnected(next, p.color) && !isFlowConnected(prev, p.color),
  )
}

/** True when the active drag grew while another color's pipe got shorter. */
const cutSomeone = (prev: GameState, next: GameState): boolean =>
  next.active !== null &&
  next.level.pairs.some(
    (p) => p.color !== next.active && next.paths[p.color].length < prev.paths[p.color].length,
  )

/**
 * The one sound a state change deserves, or null.
 * Priority: solve > hint > connect > cut > start > step / backtrack.
 */
export function soundEventsFor(prev: GameState, next: GameState): SoundEvent | null {
  if (isSolved(next) && !isSolved(prev)) return { id: 'solve' }
  if (next.hintsUsed > prev.hintsUsed) return { id: 'hint' }
  const connected = newlyConnected(prev, next)
  if (connected >= 0) return { id: 'connect', rate: connectRate(connected, next.level.pairs.length) }
  if (cutSomeone(prev, next)) return { id: 'snip' }
  if (next.active === null) return null
  // A new drag, or a new press while another color was still active.
  if (prev.active !== next.active) return { id: 'start' }
  const before = prev.paths[next.active].length
  const after = next.paths[next.active].length
  if (after > before) return { id: 'tick', rate: stepRate(after) }
  if (after < before) return { id: 'tick', rate: BACKTRACK_RATE }
  return null
}
