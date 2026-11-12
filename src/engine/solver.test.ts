import { describe, expect, it } from 'vitest'
import { createGame, isSolved } from './game.ts'
import { parseLevel } from './levels.ts'
import { flowCheck, flowStatus, solve, solveWithBudget } from './solver.ts'
import type { Level } from './types.ts'

const c = (row: number, col: number) => ({ row, col })
const meta = { id: 't', name: 't' }

describe('solve', () => {
  it('solves a 3x3 level and the result passes isSolved', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    const [solution] = solve(level)
    expect(solution).toEqual(level.solution)
    expect(isSolved({ ...createGame(level), paths: solution })).toBe(true)
  })
  it('solves a 1x2 single flow', () => {
    const level = parseLevel(meta, ['AA'])
    expect(solve(level)).toEqual([level.solution])
  })
  it('limit=1 stops after one solution even when more exist', () => {
    const level = twoSolutionLevel()
    expect(solve(level, 1)).toHaveLength(1)
  })
  it('returns 2 solutions for an ambiguous level when limit=2', () => {
    expect(solve(twoSolutionLevel(), 2)).toHaveLength(2)
  })
  it('returns [] when endpoints are walled off by blocked cells', () => {
    const level: Level = { ...parseLevel(meta, ['AA#']), blocked: [c(0, 1)] }
    const walled: Level = {
      ...level,
      cols: 3,
      pairs: [{ color: 'A', ends: [c(0, 0), c(0, 2)] }],
    }
    expect(solve(walled)).toEqual([])
  })
  it('returns [] when a cell can never be filled', () => {
    // 2x2: A is adjacent-free diagonal-less; an extra empty cell no pipe can reach
    const level = parseLevel(meta, ['AAB', 'CCB'])
    const withHole: Level = { ...level, rows: 3, pairs: level.pairs }
    expect(solve(withHole)).toEqual([])
  })
})

/** One flow corner to corner on 3x3: the row snake and the column snake both fill the board. */
function twoSolutionLevel(): Level {
  return {
    id: 'amb',
    name: 'amb',
    rows: 3,
    cols: 3,
    blocked: [],
    optimalMoves: 1,
    solution: {},
    pairs: [{ color: 'A', ends: [c(0, 0), c(2, 2)] }],
  }
}

describe('solveWithBudget', () => {
  it('stops at exactly the node budget and reports not exhausted', () => {
    const result = solveWithBudget(twoSolutionLevel(), { limit: 100, budget: 2 })
    expect(result.nodes).toBe(2)
    expect(result.exhausted).toBe(false)
  })
  it('a budget of 0 finds nothing', () => {
    const result = solveWithBudget(twoSolutionLevel(), { limit: 1, budget: 0 })
    expect(result.solutions).toEqual([])
    expect(result.exhausted).toBe(false)
  })
  it('is exhausted when the whole tree was searched', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    const result = solveWithBudget(level, { limit: 5, budget: 100_000 })
    expect(result.exhausted).toBe(true)
    expect(result.solutions).toEqual([level.solution])
  })
  it('lists every solution of the ambiguous 3x3 (both snakes)', () => {
    expect(solve(twoSolutionLevel(), 50)).toHaveLength(2)
  })
})

describe('flowCheck / flowStatus', () => {
  it('finds an alternative route on an open board', () => {
    const level: Level = {
      ...twoSolutionLevel(),
      solution: { A: [c(0, 0), c(0, 1), c(0, 2), c(1, 2), c(1, 1), c(1, 0), c(2, 0), c(2, 1), c(2, 2)] },
    }
    expect(flowCheck(level, 0, 100_000).status).toBe('alternative')
  })
  it('is forced when the flow has one possible route', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    expect(flowStatus(level, 0, 100_000)).toBe('forced')
  })
  it('is unknown when the budget runs out first', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    expect(flowCheck(level, 0, 0).status).toBe('unknown')
  })
})
