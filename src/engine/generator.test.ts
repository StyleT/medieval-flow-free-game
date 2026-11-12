import { describe, expect, it } from 'vitest'
import {
  generateLevel,
  mergeRuns,
  packSnakes,
  shapeFlows,
  splitRuns,
  tooTrivial,
  touchesItself,
  validSplits,
} from './generator.ts'
import { mulberry32 } from './rng.ts'
import { neighborTable } from './grid.ts'
import { parseLevel, toGrid } from './levels.ts'
import { solve } from './solver.ts'
import type { Level } from './types.ts'

const opts = { rows: 5, cols: 5, flows: 4, seed: 1, id: 'g', name: 'g' }
const unique = { ...opts, mode: 'unique' as const }
const meta = { id: 't', name: 't' }

/** R16 shape checks shared by every generated level. */
function expectValidShape(level: Level, flows: number): void {
  const cells = level.rows * level.cols
  const paths = Object.values(level.solution)
  expect(level.pairs).toHaveLength(flows)
  expect(paths.reduce((sum, p) => sum + p.length, 0)).toBe(cells)
  const near = neighborTable(level.rows, level.cols)
  const mark = new Int32Array(cells)
  paths.forEach((path, i) => {
    expect(path.length).toBeGreaterThanOrEqual(3)
    const ends = [path[0], path[path.length - 1]]
    expect(Math.abs(ends[0].row - ends[1].row) + Math.abs(ends[0].col - ends[1].col)).toBeGreaterThan(1)
    const indexes = path.map((c) => c.row * level.cols + c.col)
    expect(touchesItself(indexes, near, mark, i + 1)).toBe(false)
  })
}

describe('generateLevel (open mode, default)', () => {
  it('produces a valid level that parses back from its grid', () => {
    const level = generateLevel(opts)
    expectValidShape(level, 4)
    expect(level.optimalMoves).toBe(4)
    expect(level.id).toBe('g')
    expect(parseLevel(meta, toGrid(level)).solution).toEqual(level.solution)
  })
  it('the same seed gives an identical level, a different seed a different one', () => {
    expect(generateLevel(opts)).toEqual(generateLevel(opts))
    expect(generateLevel({ ...opts, seed: 2 })).not.toEqual(generateLevel(opts))
  })
  it('colors follow the reading order of each flow start', () => {
    const level = generateLevel(opts)
    const firsts = level.pairs.map((p) => Math.min(...p.ends.map((e) => e.row * 100 + e.col)))
    expect(firsts).toEqual([...firsts].sort((a, b) => a - b))
  })
  it('works at the 3*flows === cells boundary', () => {
    const level = generateLevel({ ...opts, rows: 3, cols: 3, flows: 3, budget: { candidates: 3 } })
    expect(Object.values(level.solution).every((p) => p.length === 3)).toBe(true)
  })
  it('handles the biggest boards', () => {
    expectValidShape(generateLevel({ ...opts, rows: 15, cols: 15, flows: 16 }), 16)
    expectValidShape(generateLevel({ ...opts, rows: 15, cols: 15, flows: 14 }), 14)
  }, 20_000)
  it('still returns a valid level when every candidate runs out of time', () => {
    const level = generateLevel({ ...opts, budget: { candidates: 2, candidateMs: -1 } })
    expectValidShape(level, 4)
  })
  it('throws for invalid options', () => {
    expect(() => generateLevel({ ...opts, rows: 1 })).toThrow(/2x2/)
    expect(() => generateLevel({ ...opts, cols: 1 })).toThrow(/2x2/)
    expect(() => generateLevel({ ...opts, flows: 0 })).toThrow(/at least 1/)
    expect(() => generateLevel({ ...opts, rows: 3, cols: 3, flows: 4 })).toThrow(/too many/)
    expect(() => generateLevel({ ...opts, rows: 20, cols: 20, flows: 27 })).toThrow(/at most/)
  })
})

/**
 * The generator is deterministic per seed, and the committed levels.data.ts was produced by it, so
 * the exact output for a seed is a contract: a change here means regenerating the shipped levels.
 */
describe('generateLevel reproducibility (golden output)', () => {
  it('open mode, 5×5 with 4 flows, seed 1', () => {
    expect(toGrid(generateLevel(opts))).toEqual(['AAAAA', 'BBBBB', 'CCCDC', 'CDDDC', 'CCCCC'])
  })
  it('open mode, 6×6 with 5 flows, seed 7', () => {
    expect(toGrid(generateLevel({ ...opts, rows: 6, cols: 6, flows: 5, seed: 7 }))).toEqual([
      'ABCCCC',
      'ABDBBC',
      'ABDDBC',
      'ABBBBC',
      'AAAAAC',
      'EEEEAC',
    ])
  })
  it('unique mode, 5×5 with 4 flows, seed 1', () => {
    expect(toGrid(generateLevel(unique))).toEqual(['AAABB', 'ACCBD', 'ADCBD', 'ADCCD', 'ADDDD'])
  })
  it('packSnakes never produces a snake that touches itself (R16)', () => {
    for (const size of [4, 5, 6]) {
      const near = neighborTable(size, size)
      const mark = new Int32Array(size * size)
      let stamp = 0
      for (let seed = 1; seed <= 300; seed++) {
        for (const snake of packSnakes(size, size, 4, mulberry32(seed))) {
          expect(touchesItself(snake, near, mark, ++stamp)).toBe(false)
        }
      }
    }
  })
  it('packSnakes covers the board with the same snakes for a seed', () => {
    expect(packSnakes(4, 4, 5, mulberry32(3))).toEqual([[3, 2, 1, 0], [15, 14, 13, 12, 8], [4, 5, 9, 10, 11, 7], [6]])
  })
})

describe('generateLevel option limits', () => {
  it('accepts the smallest boards (2 rows or 2 columns): no size error', () => {
    expect(() => generateLevel({ ...opts, rows: 2, cols: 4, flows: 1 })).not.toThrow(/2x2/)
    expect(() => generateLevel({ ...opts, rows: 4, cols: 2, flows: 1 })).not.toThrow(/2x2/)
  })
  it('allows exactly 26 flows: the error is about board size, not the flow limit', () => {
    expect(() => generateLevel({ ...opts, rows: 3, cols: 3, flows: 26 })).toThrow(/too many flows/)
  })
  it('throws when no candidate can ever be valid (2×2: one flow always has adjacent ends)', () => {
    expect(() => generateLevel({ ...opts, rows: 2, cols: 2, flows: 1 })).toThrow(/no level found/)
  })
  it('when no candidate meets the quota, the best-scoring candidate within the budget wins', () => {
    // candidateMs -1: every forced-flow proof times out, so the score is the total detour alone.
    const grid = (seed: number, candidates: number) =>
      toGrid(generateLevel({ ...opts, seed, budget: { candidates, candidateMs: -1 } }))
    // seed 1: the first candidate is already the best one.
    for (const candidates of [1, 3, 5]) expect(grid(1, candidates)).toEqual(['AAAAA', 'BBBBB', 'CCCDC', 'CDDDC', 'CCCCC'])
    // seed 4: candidates 2 and 3 each score higher, so a bigger budget picks a different level.
    expect(grid(4, 1)).toEqual(['AAAAA', 'ABBCC', 'ACBCD', 'ACCCD', 'DDDDD'])
    expect(grid(4, 4)).toEqual(['AAAAA', 'ADDDA', 'BDCDC', 'BDCDC', 'BDCCC'])
  })
  it('a spent time budget stops after the first analyzed candidate', () => {
    const level = generateLevel({ ...opts, seed: 4, budget: { candidates: 4, candidateMs: -1, totalMs: -1 } })
    expect(toGrid(level)).toEqual(['AAAAA', 'ABBCC', 'ACBCD', 'ACCCD', 'DDDDD']) // seed 4's first candidate
  })
  it('skips trivial candidates while better ones exist (4×4 with 5 flows)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      expect(tooTrivial(generateLevel({ ...opts, rows: 4, cols: 4, flows: 5, seed }))).toBe(false)
    }
  })
})

describe('generateLevel (unique mode)', () => {
  it('produces a level with exactly one solution', () => {
    const level = generateLevel(unique)
    expectValidShape(level, 4)
    expect(solve(level, 2)).toEqual([level.solution])
  })
  it('throws cleanly when no unique level exists (1 flow is never unique)', () => {
    expect(() => generateLevel({ ...unique, rows: 3, cols: 3, flows: 1 })).toThrow(/no unique level/)
  }, 60_000)
})

describe('shape helpers', () => {
  const near = neighborTable(3, 3)
  const ctx = () => ({ near, mark: new Int32Array(9), stamp: 0, rng: () => 0.5 })

  it('touchesItself spots a path that curls next to itself', () => {
    const mark = new Int32Array(9)
    expect(touchesItself([0, 1, 2], near, mark, 1)).toBe(false)
    expect(touchesItself([0, 1, 4, 3], near, mark, 2)).toBe(true) // 3 touches 0
  })
  it('validSplits needs both parts ≥ 3 cells with non-adjacent ends', () => {
    expect(validSplits([0, 1, 2, 5, 8, 7], near)).toEqual([3])
    expect(validSplits([0, 1, 2, 5, 8], near)).toEqual([])
  })
  it('validSplits matches a brute-force check on every Hamiltonian path of 3×3 and 3×4', () => {
    for (const [rows, cols] of [[3, 3], [3, 4]]) {
      const table = neighborTable(rows, cols)
      const adjacent = (a: number, b: number) =>
        Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) + Math.abs((a % cols) - (b % cols)) === 1
      const expected = (run: number[]) => {
        const cuts: number[] = []
        for (let k = 3; k <= run.length - 3; k++) {
          if (!adjacent(run[0], run[k - 1]) && !adjacent(run[k], run[run.length - 1])) cuts.push(k)
        }
        return cuts
      }
      let checked = 0
      const walk = (path: number[]) => {
        if (path.length === rows * cols) {
          expect(validSplits(path, table)).toEqual(expected(path))
          checked++
          return
        }
        const head = path[path.length - 1]
        for (let d = 0; d < 4; d++) {
          const n = table[head * 4 + d]
          if (n >= 0 && !path.includes(n)) walk([...path, n])
        }
      }
      for (let start = 0; start < rows * cols; start++) walk([start])
      expect(checked).toBeGreaterThan(0)
    }
  })
  it('shapeFlows rejects flows whose ends are adjacent, and keeps valid ones unchanged', () => {
    const rng = () => 0.5
    expect(shapeFlows([[0, 1, 2], [3, 4, 5], [6, 7, 8]], 3, 3, 3, rng)).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8]])
    expect(shapeFlows([[0, 1, 4, 3]], 3, 3, 1, rng)).toBeNull() // 0 and 3 touch
    expect(shapeFlows([[0, 1, 2], [3, 4, 5, 8, 7, 6]], 3, 3, 2, rng)).toBeNull() // only the second is bad
  })
  it('shapeFlows returns null (no throw) when the runs cannot be split or merged into the flow count', () => {
    const rng = () => 0.5
    expect(shapeFlows([[0, 1, 2]], 3, 3, 2, rng)).toBeNull()
    expect(shapeFlows([[4]], 3, 3, 1, rng)).toBeNull()
  })
  it('splitRuns turns one run into the requested count, or null when impossible', () => {
    const run = [0, 1, 2, 5, 8, 7]
    expect(splitRuns([run], 2, ctx())).toHaveLength(2)
    expect(splitRuns([run], 3, ctx())).toBeNull()
  })
  it('mergeRuns joins touching short runs into valid flows, or null when stuck', () => {
    const merged = mergeRuns([[0, 1], [2, 5, 8]], 1, ctx())
    expect(merged?.map((run) => [...run].sort((a, b) => a - b))).toEqual([[0, 1, 2, 5, 8]])
    expect(mergeRuns([[0, 1], [8, 7]], 1, ctx())).toBeNull() // nothing touches
  })
})

describe('tooTrivial', () => {
  it('rejects a level where most flows run straight along the border', () => {
    expect(tooTrivial(parseLevel(meta, ['AAAA', 'BBBB']))).toBe(true)
  })
  it('counts the right column and bottom row as border', () => {
    expect(tooTrivial(parseLevel(meta, ['ABC', 'ABC', 'ABC']))).toBe(true) // A left, C right
    expect(tooTrivial(parseLevel(meta, ['AAA', 'BBB', 'CCC']))).toBe(true) // A top, C bottom
  })
  it('keeps a level with detours inside', () => {
    expect(tooTrivial(parseLevel(meta, ['AAAB', 'CDAB', 'CDAB', 'CCAB']))).toBe(false)
  })
})
