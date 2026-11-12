import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProver, detachedLoops } from './sat.ts'
import { generateLevel } from './generator.ts'
import { parseLevel } from './levels.ts'
import type { Level } from './types.ts'
import { flowStatus } from './solver.ts'

const meta = { id: 't', name: 't' }

describe('createProver', () => {
  it('flows of a unique level are forced', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    const prover = createProver(level)
    for (const p of level.pairs) expect(prover.check(p.color)).toBe('forced')
  })
  it('a flow with another route is an alternative', () => {
    const level = openLevel()
    expect(createProver(level).check('A')).toBe('alternative')
  })
  it('stays correct when one prover is asked several times', () => {
    const level = openLevel()
    const prover = createProver(level)
    const first = ['A'].map((x) => prover.check(x))
    expect(['A'].map((x) => prover.check(x))).toEqual(first)
  })
  it('respects blocked cells', () => {
    const level = parseLevel(meta, ['AAA', 'B#B', 'BBB'])
    expect(createProver(level).check('A')).toBe('forced')
  })
  it('R1 blocked cells carry no pipe: a flow cannot detour through a wall', () => {
    // with edges into '#' cells usable, A could go (0,0)-#-(0,2) and close the rest over the walls
    const level = parseLevel(meta, ['A#A', 'A#A', 'AAA'])
    const prover = createProver(level)
    expect(prover.check('A')).toBe('forced')
    expect(prover.hasAnotherFill()).toBe('forced')
  })
  it('a different route that needs a detached loop is not an alternative', () => {
    // ends side by side on a 2x4: the direct edge leaves a 2x3 ring, the short hook a 2x2 ring
    expect(createProver(adjacentEndsLevel()).check('A')).toBe('forced')
  })
  it('gives up with unknown once the loop-cut rounds run out', () => {
    // a walled-off 6x6 room with no endpoints can only be covered by loops; cutting them never ends
    expect(createProver(sealedRoomLevel()).check('A')).toBe('unknown')
  })
  it('throws for an unknown color', () => {
    const level = parseLevel(meta, ['AA'])
    expect(() => createProver(level).check('Z')).toThrow(/unknown color Z/)
  })
  it('agrees with the backtracking solver on generated boards', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const level = generateLevel({ rows: 5, cols: 5, flows: 4, seed, id: 'x', name: 'x', mode: 'open', budget: { candidates: 1 } })
      const prover = createProver(level)
      level.pairs.forEach((p, k) => {
        expect(prover.check(p.color)).toBe(flowStatus(level, k, 1_000_000))
      })
    }
  })
})

describe('hasAnotherFill', () => {
  it('is forced for a unique level and an alternative for an open one', () => {
    expect(createProver(parseLevel(meta, ['AAB', 'CAB', 'CCB'])).hasAnotherFill()).toBe('forced')
    expect(createProver(openLevel()).hasAnotherFill()).toBe('alternative')
  })
})

describe('deadline', () => {
  afterEach(() => vi.restoreAllMocks())
  it('an expired deadline gives unknown instead of searching', () => {
    const prover = createProver(openLevel(), { deadline: Date.now() - 1 })
    expect(prover.check('A')).toBe('unknown')
    expect(prover.hasAnotherFill()).toBe('unknown')
  })
  it('a deadline equal to now still searches (only a passed deadline stops)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    expect(createProver(openLevel(), { deadline: 1_000 }).check('A')).toBe('alternative')
    expect(createProver(openLevel(), { deadline: 999 }).check('A')).toBe('unknown')
  })
  it('a far deadline changes nothing', () => {
    expect(createProver(openLevel(), { deadline: Date.now() + 60_000 }).check('A')).toBe('alternative')
  })
})

describe('detachedLoops', () => {
  const edges = [
    [0, 1],
    [1, 3],
    [3, 2],
    [2, 0],
    [4, 5],
  ] as const
  it('returns the edges of a closed square and ignores an open segment', () => {
    const used = new Set(['e0_1', 'e1_3', 'e2_3', 'e0_2', 'e4_5'])
    const loops = detachedLoops(edges, used)
    expect(loops).toHaveLength(1)
    expect(loops[0].sort()).toEqual(['e0_1', 'e0_2', 'e1_3', 'e2_3'])
  })
  it('returns nothing when no edge is used', () => {
    expect(detachedLoops(edges, new Set())).toEqual([])
  })
})

/** One flow corner to corner on a 3x3: the row snake and the column snake both fill the board. */
function openLevel(): Level {
  const c = (row: number, col: number) => ({ row, col })
  return {
    id: 'open',
    name: 'open',
    rows: 3,
    cols: 3,
    blocked: [],
    optimalMoves: 1,
    pairs: [{ color: 'A', ends: [c(0, 0), c(2, 2)] }],
    solution: { A: [c(0, 0), c(0, 1), c(0, 2), c(1, 2), c(1, 1), c(1, 0), c(2, 0), c(2, 1), c(2, 2)] },
  }
}

const cell = (row: number, col: number) => ({ row, col })

/** One flow whose ends touch, on a 2x4; the reference snakes through every cell. */
function adjacentEndsLevel(): Level {
  return {
    id: 'adjacent',
    name: 'adjacent',
    rows: 2,
    cols: 4,
    blocked: [],
    optimalMoves: 1,
    pairs: [{ color: 'A', ends: [cell(0, 0), cell(1, 0)] }],
    solution: { A: [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(1, 3), cell(1, 2), cell(1, 1), cell(1, 0)] },
  }
}

/** The open 3x3 in columns 0–2, a wall in column 3 and a sealed 6x6 room without endpoints in columns 4–9. */
function sealedRoomLevel(): Level {
  const blocked = []
  for (let row = 0; row < 6; row++) {
    blocked.push(cell(row, 3))
    if (row > 2) blocked.push(cell(row, 0), cell(row, 1), cell(row, 2))
  }
  const open = openLevel()
  return { ...open, id: 'sealed', name: 'sealed', rows: 6, cols: 10, blocked }
}
