import type { Cell } from './types.ts'

// up, right, down, left
const DIRECTIONS: readonly [number, number][] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
]

export function cellKey(c: Cell): string {
  return `${c.row},${c.col}`
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col
}

export function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
}

export function inBounds(rows: number, cols: number, c: Cell): boolean {
  return c.row >= 0 && c.row < rows && c.col >= 0 && c.col < cols
}

export function neighbors(rows: number, cols: number, c: Cell): Cell[] {
  return DIRECTIONS.map(([dr, dc]) => ({ row: c.row + dr, col: c.col + dc })).filter((n) =>
    inBounds(rows, cols, n),
  )
}

/** Cells after `a` up to and including `b`; null unless both share a row or a column. */
export function straightLine(a: Cell, b: Cell): Cell[] | null {
  const dr = Math.sign(b.row - a.row)
  const dc = Math.sign(b.col - a.col)
  if (dr !== 0 && dc !== 0) return null
  const length = Math.abs(b.row - a.row) + Math.abs(b.col - a.col)
  return Array.from({ length }, (_, i) => ({
    row: a.row + dr * (i + 1),
    col: a.col + dc * (i + 1),
  }))
}

/** Edge-adjacent cell indexes of every cell, 4 slots per cell (up, right, down, left), -1 for none. */
export function neighborTable(rows: number, cols: number): Int32Array {
  const table = new Int32Array(rows * cols * 4).fill(-1)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const base = (row * cols + col) * 4
      if (row > 0) table[base] = (row - 1) * cols + col
      if (col < cols - 1) table[base + 1] = row * cols + col + 1
      if (row < rows - 1) table[base + 2] = (row + 1) * cols + col
      if (col > 0) table[base + 3] = row * cols + col - 1
    }
  }
  return table
}
