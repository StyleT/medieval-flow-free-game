import { describe, expect, it } from 'vitest'
import { createGame, isSolved } from './game.ts'
import { LEVEL_DATA } from './levels.data.ts'
import { createProver } from './sat.ts'
import { meetsQuota } from './forced.ts'
import { LEVELS, flowsFor, parseLevel, toGrid } from './levels.ts'
import { solve } from './solver.ts'

const meta = { id: 't', name: 't' }
const c = (row: number, col: number) => ({ row, col })

describe('parseLevel', () => {
  it('derives endpoints and ordered paths', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    expect(level.rows).toBe(3)
    expect(level.cols).toBe(3)
    expect(level.pairs.map((p) => p.color)).toEqual(['A', 'B', 'C'])
    expect(level.solution.A).toEqual([c(0, 0), c(0, 1), c(1, 1)])
    expect(level.pairs[0].ends).toEqual([c(0, 0), c(1, 1)])
    expect(level.solution.C).toEqual([c(1, 0), c(2, 0), c(2, 1)])
    expect(level.optimalMoves).toBe(3)
  })
  it('handles a 1x2 grid with a single flow', () => {
    const level = parseLevel(meta, ['AA'])
    expect(level.pairs).toHaveLength(1)
    expect(level.solution.A).toEqual([c(0, 0), c(0, 1)])
  })
  it('turns # into blocked cells', () => {
    const level = parseLevel(meta, ['AA#'])
    expect(level.blocked).toEqual([c(0, 2)])
  })
  it('throws on a 1-cell color', () => {
    expect(() => parseLevel(meta, ['AB', 'BB'])).toThrow(/fewer than 2/)
  })
  it('throws on a branching color', () => {
    expect(() => parseLevel(meta, ['BAB', 'AAA', 'BAB'])).toThrow()
  })
  it('throws on a loop', () => {
    expect(() => parseLevel(meta, ['AA', 'AA'])).toThrow(/exactly 2 ends/)
  })
  it('throws on a split color', () => {
    // a 2-cell path plus a separate 2x2 loop: exactly 2 ends, but not connected
    expect(() => parseLevel(meta, ['AA', '##', 'AA', 'AA'])).toThrow(/split/)
  })
  it('throws on ragged rows, unknown characters and empty grids', () => {
    expect(() => parseLevel(meta, ['AA', 'A'])).toThrow(/ragged/)
    expect(() => parseLevel(meta, ['Aa'])).toThrow(/unknown/)
    expect(() => parseLevel(meta, ['A.'])).toThrow(/unknown/)
    expect(() => parseLevel(meta, [])).toThrow(/empty/)
    expect(() => parseLevel(meta, [''])).toThrow(/empty/)
  })
})

describe('toGrid / flowsFor', () => {
  it('toGrid round-trips through parseLevel', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    expect(toGrid(level)).toEqual(['AAB', 'CAB', 'CCB'])
    expect(toGrid({ ...parseLevel(meta, ['AA#']) })).toEqual(['AA#'])
  })
  it('flowsFor follows min(16, round(sqrt(cells)) - 1)', () => {
    expect(flowsFor(5, 5)).toBe(4)
    expect(flowsFor(15, 15)).toBe(14)
    expect(flowsFor(20, 20)).toBe(16)
    expect(flowsFor(2, 2)).toBe(1)
  })
})

describe('LEVELS', () => {
  it('has 15 levels with strictly increasing area and non-decreasing flows up to 16', () => {
    expect(LEVELS).toHaveLength(15)
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].rows * LEVELS[i].cols).toBeGreaterThan(LEVELS[i - 1].rows * LEVELS[i - 1].cols)
      expect(LEVELS[i].pairs.length).toBeGreaterThanOrEqual(LEVELS[i - 1].pairs.length)
    }
    for (const level of LEVELS) expect(level.pairs.length).toBeLessThanOrEqual(16)
  })
  LEVELS.forEach((level, i) => {
    const data = LEVEL_DATA[i]
    describe(level.id, () => {
      it('solution covers every fillable cell exactly once', () => {
        const keys = Object.values(level.solution)
          .flat()
          .map((x) => `${x.row},${x.col}`)
        expect(new Set(keys).size).toBe(keys.length)
        expect(keys.length).toBe(level.rows * level.cols - level.blocked.length)
      })
      it('optimalMoves equals the number of flows, which follows flowsFor', () => {
        expect(level.optimalMoves).toBe(level.pairs.length)
        expect(level.pairs.length).toBe(flowsFor(level.rows, level.cols))
      })
      if (i < 2) {
        it('is a unique tutorial board', () => {
          const solutions = solve(level, 2)
          expect(solutions).toHaveLength(1)
          expect(solutions[0]).toEqual(level.solution)
        })
        return
      }
      it('has a valid reference fill (R11: uniqueness is not required)', () => {
        expect(isSolved({ ...createGame(level), paths: level.solution })).toBe(true)
      })
      it('meets the forced-flow quota, and each stored forced flow is proved', () => {
        const flows = level.pairs.length
        expect(data.forced.length).toBeGreaterThanOrEqual(Math.max(1, Math.round(0.3 * flows)))
        expect(meetsQuota(data.forced.length, 1, flows)).toBe(true)
        const prover = createProver(level)
        for (const color of data.forced) expect(prover.check(color)).toBe('forced')
      }, 30_000)
    })
  })
})
