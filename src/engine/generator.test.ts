import { describe, expect, it } from 'vitest'
import { generateLevel, mergeRuns, splitRuns, tooTrivial, touchesItself, validSplits } from './generator.ts'
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
  it('keeps a level with detours inside', () => {
    expect(tooTrivial(parseLevel(meta, ['AAAB', 'CDAB', 'CDAB', 'CCAB']))).toBe(false)
  })
})
