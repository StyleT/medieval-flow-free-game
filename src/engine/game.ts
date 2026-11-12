import { inBounds, isAdjacent, sameCell, straightLine } from './grid.ts'
import { MAX_HINTS } from './types.ts'
import type { Cell, ColorId, GameState, Level, Paths } from './types.ts'

const lastOf = (path: readonly Cell[]): Cell => path[path.length - 1]

function samePath(a: readonly Cell[], b: readonly Cell[]): boolean {
  return a.length === b.length && a.every((cell, i) => sameCell(cell, b[i]))
}

function indexInPath(path: readonly Cell[], cell: Cell): number {
  return path.findIndex((c) => sameCell(c, cell))
}

function isBlocked(level: Level, cell: Cell): boolean {
  return level.blocked.some((b) => sameCell(b, cell))
}

export function createGame(level: Level): GameState {
  const paths: Paths = {}
  for (const pair of level.pairs) paths[pair.color] = []
  return {
    level,
    paths,
    active: null,
    dragChanged: false,
    moves: 0,
    lastMovedColor: null,
    hintsUsed: 0,
  }
}

export function resetGame(s: GameState): GameState {
  return createGame(s.level)
}

export function endpointAt(level: Level, cell: Cell): ColorId | null {
  const pair = level.pairs.find((p) => p.ends.some((end) => sameCell(end, cell)))
  return pair ? pair.color : null
}

export function occupantAt(s: GameState, cell: Cell): ColorId | null {
  for (const pair of s.level.pairs) {
    if (indexInPath(s.paths[pair.color], cell) >= 0) return pair.color
  }
  return null
}

/** A flow is connected when its pipe runs from one endpoint to the other. */
export function isFlowConnected(s: GameState, color: ColorId): boolean {
  const path = s.paths[color]
  return path.length > 1 && endpointAt(s.level, lastOf(path)) === color
}

export function progress(s: GameState): {
  flowsConnected: number
  flowsTotal: number
  filledPct: number
} {
  const flowsTotal = s.level.pairs.length
  const flowsConnected = s.level.pairs.filter((p) => isFlowConnected(s, p.color)).length
  const filledPct = Math.round((coveredCells(s) / fillableCells(s.level)) * 100)
  return { flowsConnected, flowsTotal, filledPct }
}

function coveredCells(s: GameState): number {
  return s.level.pairs.reduce((sum, p) => sum + s.paths[p.color].length, 0)
}

function fillableCells(level: Level): number {
  return level.rows * level.cols - level.blocked.length
}

export function isSolved(s: GameState): boolean {
  const allConnected = s.level.pairs.every((p) => isFlowConnected(s, p.color))
  return allConnected && coveredCells(s) === fillableCells(s.level)
}

/** R4 */
export function startDrag(s: GameState, cell: Cell): GameState {
  if (!inBounds(s.level.rows, s.level.cols, cell)) return s
  const endpointColor = endpointAt(s.level, cell)
  const color = endpointColor ?? occupantAt(s, cell)
  if (color === null) return s

  const before = s.paths[color]
  const after = endpointColor !== null ? [cell] : before.slice(0, indexInPath(before, cell) + 1)
  const reset = before.length > 0 && !samePath(before, after)
  return { ...s, paths: { ...s.paths, [color]: after }, active: color, dragChanged: reset }
}

/** R2, R5–R10 */
export function dragTo(s: GameState, target: Cell): GameState {
  if (s.active === null) return s
  const color = s.active
  const head = lastOf(s.paths[color])
  if (sameCell(head, target)) return s

  const steps = isAdjacent(head, target) ? [target] : straightLine(head, target)
  if (steps === null) return s

  let current = s
  for (const cell of steps) {
    const next = stepTo(current, color, cell)
    if (next === current) break // stop at the first illegal cell
    current = next
  }
  return current
}

/** One orthogonal step; returns the same state object when the step is illegal. */
function stepTo(s: GameState, color: ColorId, cell: Cell): GameState {
  const { level } = s
  if (!inBounds(level.rows, level.cols, cell)) return s

  const path = s.paths[color]
  const ownIndex = indexInPath(path, cell)
  if (ownIndex >= 0) {
    // R6: backtrack (still allowed once connected)
    return { ...s, paths: { ...s.paths, [color]: path.slice(0, ownIndex + 1) }, dragChanged: true }
  }
  if (isFlowConnected(s, color)) return s // R9
  if (isBlocked(level, cell)) return s // R8
  const endpoint = endpointAt(level, cell)
  if (endpoint !== null && endpoint !== color) return s // R8

  const paths: Paths = { ...s.paths }
  const other = occupantAt(s, cell)
  if (other !== null) paths[other] = cutBefore(paths[other], cell) // R7
  paths[color] = [...path, cell]
  return { ...s, paths, dragChanged: true }
}

function cutBefore(path: Cell[], cell: Cell): Cell[] {
  return path.slice(0, indexInPath(path, cell))
}

/** R13 */
export function endDrag(s: GameState): GameState {
  const counts = s.dragChanged && s.active !== s.lastMovedColor
  return {
    ...s,
    moves: counts ? s.moves + 1 : s.moves,
    lastMovedColor: counts ? s.active : s.lastMovedColor,
    active: null,
    dragChanged: false,
  }
}

/** R12 */
export function applyHint(s: GameState): GameState {
  if (s.hintsUsed >= MAX_HINTS || isSolved(s)) return s
  const pair =
    s.level.pairs.find((p) => !isFlowConnected(s, p.color)) ??
    s.level.pairs.find((p) => !matchesSolution(s, p.color))
  if (pair === undefined) return s

  const solutionPath = s.level.solution[pair.color]
  const paths: Paths = { ...s.paths }
  for (const other of s.level.pairs) {
    if (other.color === pair.color) continue
    const firstOverlap = paths[other.color].findIndex((c) => indexInPath(solutionPath, c) >= 0)
    if (firstOverlap >= 0) paths[other.color] = paths[other.color].slice(0, firstOverlap)
  }
  paths[pair.color] = [...solutionPath]
  return { ...s, paths, hintsUsed: s.hintsUsed + 1 }
}

function matchesSolution(s: GameState, color: ColorId): boolean {
  const path = s.paths[color]
  const solution = s.level.solution[color]
  return samePath(path, solution) || samePath(path, [...solution].reverse())
}
