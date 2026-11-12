import { cellKey, neighbors, sameCell } from './grid.ts'
import { LEVEL_DATA } from './levels.data.ts'
import type { Cell, ColorId, Level, Pair } from './types.ts'

const BLOCKED_CHAR = '#'

/** ASCII solution grid → Level. `A–Z` are flow cells, `#` is blocked. */
export function parseLevel(meta: { id: string; name: string }, grid: string[]): Level {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) throw new Error('empty grid')
  if (grid.some((line) => line.length !== cols)) throw new Error('ragged rows')

  const blocked: Cell[] = []
  const cellsByColor = new Map<ColorId, Cell[]>()
  grid.forEach((line, row) => {
    for (let col = 0; col < cols; col++) {
      const ch = line[col]
      if (ch === BLOCKED_CHAR) blocked.push({ row, col })
      else if (/^[A-Z]$/.test(ch)) cellsByColor.set(ch, [...(cellsByColor.get(ch) ?? []), { row, col }])
      else throw new Error(`unknown character '${ch}'`)
    }
  })

  const colors = [...cellsByColor.keys()].sort()
  const solution: Record<ColorId, Cell[]> = {}
  const pairs: Pair[] = colors.map((color) => {
    const path = walkColor(color, cellsByColor.get(color)!, rows, cols)
    solution[color] = path
    return { color, ends: [path[0], path[path.length - 1]] }
  })

  return { ...meta, rows, cols, pairs, blocked, solution, optimalMoves: pairs.length }
}

/** Walks the color's cells from the endpoint that comes first in reading order. */
function walkColor(color: ColorId, cells: Cell[], rows: number, cols: number): Cell[] {
  if (cells.length < 2) throw new Error(`color ${color} has fewer than 2 cells`)
  const keys = new Set(cells.map(cellKey))
  const sameColorNeighbors = (c: Cell) =>
    neighbors(rows, cols, c).filter((n) => keys.has(cellKey(n)))

  const ends = cells.filter((c) => sameColorNeighbors(c).length === 1)
  if (ends.length !== 2) throw new Error(`color ${color} must have exactly 2 ends (loop or branch)`)
  if (cells.some((c) => sameColorNeighbors(c).length > 2)) {
    throw new Error(`color ${color} branches`)
  }

  const path: Cell[] = [ends[0]] // cells are in reading order, so ends[0] comes first
  while (path.length < cells.length) {
    const head = path[path.length - 1]
    const next = sameColorNeighbors(head).find((n) => !path.some((p) => sameCell(p, n)))
    if (next === undefined) throw new Error(`color ${color} is split into pieces`)
    path.push(next)
  }
  return path
}

export type LevelData = { id: string; name: string; grid: string[]; forced: string[] }

export const LEVELS: Level[] = LEVEL_DATA.map((entry) =>
  parseLevel({ id: entry.id, name: entry.name }, entry.grid),
)

/** ASCII solution grid of a level (the inverse of `parseLevel`). */
export function toGrid(level: Level): string[] {
  const grid = Array.from({ length: level.rows }, () => Array<string>(level.cols).fill('#'))
  for (const [color, path] of Object.entries(level.solution)) {
    for (const c of path) grid[c.row][c.col] = color
  }
  return grid.map((line) => line.join(''))
}

/** Flow count for a board: grows with the board but stays at 16 or fewer, so colors stay readable. */
export function flowsFor(rows: number, cols: number): number {
  return Math.min(16, Math.round(Math.sqrt(rows * cols)) - 1)
}
