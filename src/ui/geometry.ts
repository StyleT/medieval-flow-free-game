import type { Cell } from '../engine/types.ts'

export type Point = { x: number; y: number }

/** Client coordinates → board coordinates in cell units. */
export function toBoardPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  rows: number,
  cols: number,
): Point {
  return {
    x: ((clientX - rect.left) / rect.width) * cols,
    y: ((clientY - rect.top) / rect.height) * rows,
  }
}

export function pointToCell(p: Point, rows: number, cols: number): Cell | null {
  const row = Math.floor(p.y)
  const col = Math.floor(p.x)
  const inside = p.x >= 0 && p.y >= 0 && row < rows && col < cols
  return inside ? { row, col } : null
}

/**
 * 4-connected grid traversal (Amanatides–Woo) of the segment `from → to`,
 * excluding the cell containing `from`. Cells outside the board are dropped.
 * On an exact corner crossing it steps along x first.
 */
export function traceCells(from: Point, to: Point, rows: number, cols: number): Cell[] {
  let col = Math.floor(from.x)
  let row = Math.floor(from.y)
  const endCol = Math.floor(to.x)
  const endRow = Math.floor(to.y)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const stepCol = Math.sign(dx)
  const stepRow = Math.sign(dy)

  // Parametric distance (0..1 along the segment) to the next vertical / horizontal grid line.
  let tMaxX = stepCol === 0 ? Infinity : ((stepCol > 0 ? col + 1 : col) - from.x) / dx
  let tMaxY = stepRow === 0 ? Infinity : ((stepRow > 0 ? row + 1 : row) - from.y) / dy
  const tDeltaX = stepCol === 0 ? Infinity : stepCol / dx
  const tDeltaY = stepRow === 0 ? Infinity : stepRow / dy

  const cells: Cell[] = []
  const maxSteps = Math.abs(endCol - col) + Math.abs(endRow - row)
  for (let i = 0; i < maxSteps; i++) {
    if (tMaxX <= tMaxY) {
      col += stepCol
      tMaxX += tDeltaX
    } else {
      row += stepRow
      tMaxY += tDeltaY
    }
    if (row >= 0 && row < rows && col >= 0 && col < cols) cells.push({ row, col })
  }
  return cells
}
