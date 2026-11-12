import { describe, expect, it } from 'vitest'
import { pointToCell, toBoardPoint, traceCells } from './geometry.ts'

const c = (row: number, col: number) => ({ row, col })
const p = (x: number, y: number) => ({ x, y })

describe('toBoardPoint', () => {
  const rect = { left: 10, top: 20, width: 100, height: 200 }
  it('maps client coordinates to cell units', () => {
    expect(toBoardPoint(rect, 60, 120, 4, 2)).toEqual(p(1, 2))
  })
  it('maps the top-left corner to the origin and the far corner to cols,rows', () => {
    expect(toBoardPoint(rect, 10, 20, 4, 2)).toEqual(p(0, 0))
    expect(toBoardPoint(rect, 110, 220, 4, 2)).toEqual(p(2, 4))
  })
  it('yields negative values outside the rect', () => {
    expect(toBoardPoint(rect, 0, 0, 4, 2).x).toBeLessThan(0)
  })
})

describe('pointToCell', () => {
  it('maps the middle and the exact top-left corner', () => {
    expect(pointToCell(p(1.5, 1.5), 3, 3)).toEqual(c(1, 1))
    expect(pointToCell(p(0, 0), 3, 3)).toEqual(c(0, 0))
  })
  it('maps just inside the bottom-right edge', () => {
    expect(pointToCell(p(2.999, 2.999), 3, 3)).toEqual(c(2, 2))
  })
  it('is null outside the board, including exactly on the far edge', () => {
    expect(pointToCell(p(-0.01, 1), 3, 3)).toBeNull()
    expect(pointToCell(p(1, -0.01), 3, 3)).toBeNull()
    expect(pointToCell(p(3, 1), 3, 3)).toBeNull()
    expect(pointToCell(p(1, 3), 3, 3)).toBeNull()
  })
  it('handles non-square boards', () => {
    expect(pointToCell(p(4.5, 0.5), 2, 5)).toEqual(c(0, 4))
    expect(pointToCell(p(0.5, 2.5), 2, 5)).toBeNull()
  })
})

describe('traceCells', () => {
  it('is empty within the same cell', () => {
    expect(traceCells(p(0.2, 0.2), p(0.8, 0.8), 3, 3)).toEqual([])
  })
  it('traces a straight horizontal and vertical swipe, both directions', () => {
    expect(traceCells(p(0.5, 0.5), p(2.5, 0.5), 3, 3)).toEqual([c(0, 1), c(0, 2)])
    expect(traceCells(p(2.5, 0.5), p(0.5, 0.5), 3, 3)).toEqual([c(0, 1), c(0, 0)])
    expect(traceCells(p(0.5, 0.5), p(0.5, 2.5), 3, 3)).toEqual([c(1, 0), c(2, 0)])
    expect(traceCells(p(0.5, 2.5), p(0.5, 0.5), 3, 3)).toEqual([c(1, 0), c(0, 0)])
  })
  it('a diagonal swipe becomes 4-connected steps that follow the segment', () => {
    // from (0.2,0.5) to (1.8,1.5): crosses x=1 at y≈1.0 (corner-ish), 2 cells total
    const cells = traceCells(p(0.2, 0.5), p(1.8, 1.5), 3, 3)
    expect(cells).toHaveLength(2)
    expect(cells[cells.length - 1]).toEqual(c(1, 1))
  })
  it('every step is orthogonally adjacent to the previous one', () => {
    const cells = traceCells(p(0.1, 0.1), p(4.9, 3.7), 5, 5)
    let prev = c(0, 0)
    for (const cell of cells) {
      expect(Math.abs(cell.row - prev.row) + Math.abs(cell.col - prev.col)).toBe(1)
      prev = cell
    }
    expect(prev).toEqual(c(3, 4))
  })
  it('steps along x first on an exact corner crossing', () => {
    expect(traceCells(p(0.5, 0.5), p(1.5, 1.5), 3, 3)).toEqual([c(0, 1), c(1, 1)])
    expect(traceCells(p(1.5, 1.5), p(0.5, 0.5), 3, 3)).toEqual([c(1, 0), c(0, 0)])
  })
  it('drops cells outside the board', () => {
    expect(traceCells(p(1.5, 0.5), p(4.5, 0.5), 3, 3)).toEqual([c(0, 2)])
    expect(traceCells(p(0.5, 0.5), p(-2.5, 0.5), 3, 3)).toEqual([])
  })
})
