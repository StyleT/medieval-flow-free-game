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

describe('solveWithBudget: exhausted and the solution limit', () => {
  it('is not exhausted when the solution limit stops the search, even with no budget cap', () => {
    const result = solveWithBudget(twoSolutionLevel(), { limit: 1, budget: Infinity })
    expect(result.solutions).toHaveLength(1)
    expect(result.exhausted).toBe(false)
  })
  it('boundary: finding exactly `limit` solutions is not exhausted, one more slot is', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    expect(solveWithBudget(level, { limit: 1, budget: Infinity }).exhausted).toBe(false)
    expect(solveWithBudget(level, { limit: 2, budget: Infinity }).exhausted).toBe(true)
  })
})

describe('solve: levels without flows', () => {
  const noFlows = (rows: number, cols: number, blocked: { row: number; col: number }[]): Level => ({
    id: 'n',
    name: 'n',
    rows,
    cols,
    blocked,
    optimalMoves: 0,
    solution: {},
    pairs: [],
  })
  it('boundary: a fully blocked board with no flows is solved by the empty fill', () => {
    expect(solve(noFlows(1, 2, [c(0, 0), c(0, 1)]))).toEqual([{}])
  })
  it('negative: an empty cell with no flow to fill it has no solution', () => {
    const result = solveWithBudget(noFlows(1, 2, [c(0, 0)]), { limit: 1, budget: Infinity })
    expect(result.solutions).toEqual([])
    expect(result.exhausted).toBe(true)
  })
})

/**
 * `nodes` is part of the result and `forced.ts` / the generator spend fixed budgets, so the search
 * effort is observable. These counts pin MRV, the forbidden-flow ordering and the flood-fill pruning.
 */
describe('search effort (nodes)', () => {
  // Level 1 of the campaign: four forced flows on 5x5.
  const campaign1 = () => parseLevel(meta, ['AAAAA', 'ABCCC', 'ABBBC', 'AAABC', 'DDDDC'])

  it('the forbidden flow tries off-reference moves first: the open 3x3 alternative is the first descent', () => {
    const level: Level = {
      ...twoSolutionLevel(),
      solution: { A: [c(0, 0), c(0, 1), c(0, 2), c(1, 2), c(1, 1), c(1, 0), c(2, 0), c(2, 1), c(2, 2)] },
    }
    // root + 8 steps, no backtracking
    expect(flowCheck(level, 0, 100_000)).toEqual({ status: 'alternative', nodes: 9 })
  })
  it('a fully forced 3x3 needs no backtracking, and proving each flow forced stays tiny', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    expect(solveWithBudget(level, { limit: 1, budget: Infinity }).nodes).toBe(7)
    expect([0, 1, 2].map((f) => flowCheck(level, f, 100_000))).toEqual([
      { status: 'forced', nodes: 2 },
      { status: 'forced', nodes: 4 },
      { status: 'forced', nodes: 6 },
    ])
  })
  it('enumerating both snakes of the open 3x3 visits only their two branches', () => {
    expect(solveWithBudget(twoSolutionLevel(), { limit: 1, budget: Infinity }).nodes).toBe(9)
    expect(solveWithBudget(twoSolutionLevel(), { limit: 3, budget: Infinity }).nodes).toBe(17)
  })
  it('pins the effort on a 5x5 campaign level (solve and forced proofs)', () => {
    const level = campaign1()
    expect(solveWithBudget(level, { limit: 1, budget: Infinity }).nodes).toBe(35)
    expect(flowCheck(level, 0, 100_000)).toEqual({ status: 'forced', nodes: 32 })
    expect(flowCheck(level, 1, 100_000)).toEqual({ status: 'forced', nodes: 12 })
  })
  it('boundary: a head diagonal to its target is not mistaken for adjacent', () => {
    // A: (0,0)-(0,1); B: (1,1)-(0,2), its head sits diagonally below-left of its target.
    const level: Level = {
      id: 'd',
      name: 'd',
      rows: 3,
      cols: 3,
      blocked: [],
      optimalMoves: 2,
      solution: {
        A: [c(0, 0), c(0, 1)],
        B: [c(1, 1), c(1, 0), c(2, 0), c(2, 1), c(2, 2), c(1, 2), c(0, 2)],
      },
      pairs: [
        { color: 'A', ends: [c(0, 0), c(0, 1)] },
        { color: 'B', ends: [c(1, 1), c(0, 2)] },
      ],
    }
    expect(solveWithBudget(level, { limit: 2, budget: Infinity }).nodes).toBe(8)
    expect(flowCheck(level, 0, 100_000)).toEqual({ status: 'forced', nodes: 1 })
  })
  it('negative: a connected flow end is not a usable neighbour for an empty cell (pruned at once)', () => {
    // A: (1,1)-(2,1) connects in one step and leaves (2,0) a dead end; B: (2,2)-(0,1).
    const level: Level = {
      id: 'x',
      name: 'x',
      rows: 3,
      cols: 3,
      blocked: [],
      optimalMoves: 2,
      solution: {},
      pairs: [
        { color: 'A', ends: [c(1, 1), c(2, 1)] },
        { color: 'B', ends: [c(2, 2), c(0, 1)] },
      ],
    }
    expect(solveWithBudget(level, { limit: 2, budget: Infinity })).toEqual({
      solutions: [],
      exhausted: true,
      nodes: 3,
    })
  })
})
