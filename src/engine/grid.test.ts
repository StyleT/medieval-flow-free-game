import { describe, expect, it } from 'vitest'
import { cellKey, inBounds, isAdjacent, neighborTable, neighbors, sameCell, straightLine } from './grid.ts'

const c = (row: number, col: number) => ({ row, col })

describe('grid', () => {
  it('cellKey and sameCell identify cells', () => {
    expect(cellKey(c(1, 2))).toBe('1,2')
    expect(sameCell(c(1, 2), c(1, 2))).toBe(true)
    expect(sameCell(c(1, 2), c(2, 1))).toBe(false)
    expect(sameCell(c(1, 2), c(1, 3))).toBe(false)
    expect(sameCell(c(1, 2), c(0, 2))).toBe(false)
  })

  it('R2 isAdjacent is true for the 4 orthogonal neighbours', () => {
    for (const n of [c(1, 2), c(3, 2), c(2, 1), c(2, 3)]) expect(isAdjacent(c(2, 2), n)).toBe(true)
  })
  it('R2 diagonal, distance 2 and same cell are not adjacent', () => {
    expect(isAdjacent(c(2, 2), c(3, 3))).toBe(false)
    expect(isAdjacent(c(2, 2), c(2, 4))).toBe(false)
    expect(isAdjacent(c(2, 2), c(2, 2))).toBe(false)
  })

  it('inBounds at the edges and just outside', () => {
    expect(inBounds(3, 4, c(0, 0))).toBe(true)
    expect(inBounds(3, 4, c(2, 3))).toBe(true)
    expect(inBounds(3, 4, c(-1, 0))).toBe(false)
    expect(inBounds(3, 4, c(0, -1))).toBe(false)
    expect(inBounds(3, 4, c(3, 0))).toBe(false)
    expect(inBounds(3, 4, c(0, 4))).toBe(false)
  })

  it('neighbors returns 2 for a corner, 3 for an edge, 4 for the interior', () => {
    expect(neighbors(3, 3, c(0, 0))).toHaveLength(2)
    expect(neighbors(3, 3, c(0, 1))).toHaveLength(3)
    expect(neighbors(3, 3, c(1, 1))).toHaveLength(4)
  })
  it('neighbors are ordered up, right, down, left', () => {
    expect(neighbors(3, 3, c(1, 1))).toEqual([c(0, 1), c(1, 2), c(2, 1), c(1, 0)])
  })

  it('straightLine covers rows and columns in both directions', () => {
    expect(straightLine(c(0, 0), c(0, 3))).toEqual([c(0, 1), c(0, 2), c(0, 3)])
    expect(straightLine(c(0, 3), c(0, 1))).toEqual([c(0, 2), c(0, 1)])
    expect(straightLine(c(0, 1), c(2, 1))).toEqual([c(1, 1), c(2, 1)])
    expect(straightLine(c(2, 1), c(0, 1))).toEqual([c(1, 1), c(0, 1)])
  })
  it('straightLine is null on a diagonal and empty on the same cell', () => {
    expect(straightLine(c(0, 0), c(2, 2))).toBeNull()
    expect(straightLine(c(0, 0), c(1, 2))).toBeNull()
    expect(straightLine(c(1, 1), c(1, 1))).toEqual([])
  })

  describe('neighborTable (up, right, down, left; -1 for none)', () => {
    it('a 1x1 board has no neighbours', () => {
      expect([...neighborTable(1, 1)]).toEqual([-1, -1, -1, -1])
    })
    it('a 2x3 board lists every neighbour and -1 at every edge', () => {
      // 0 1 2
      // 3 4 5
      // prettier-ignore
      expect([...neighborTable(2, 3)]).toEqual([
        -1, 1, 3, -1,
        -1, 2, 4, 0,
        -1, -1, 5, 1,
        0, 4, -1, -1,
        1, 5, -1, 3,
        2, -1, -1, 4,
      ])
    })
    it('a 3x1 column has only up and down neighbours', () => {
      // prettier-ignore
      expect([...neighborTable(3, 1)]).toEqual([
        -1, -1, 1, -1,
        0, -1, 2, -1,
        1, -1, -1, -1,
      ])
    })
    it('agrees with neighbors() on a 4x5 board', () => {
      const table = neighborTable(4, 5)
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
          const base = (row * 5 + col) * 4
          const listed = [...table.slice(base, base + 4)].filter((n) => n >= 0)
          expect(listed).toEqual(neighbors(4, 5, c(row, col)).map((n) => n.row * 5 + n.col))
        }
      }
    })
    it('an empty board gives an empty table', () => {
      expect(neighborTable(0, 3)).toHaveLength(0)
    })
  })
})
