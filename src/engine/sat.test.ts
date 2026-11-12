import { describe, expect, it } from 'vitest'
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
  it('an expired deadline gives unknown instead of searching', () => {
    const prover = createProver(openLevel(), { deadline: Date.now() - 1 })
    expect(prover.check('A')).toBe('unknown')
    expect(prover.hasAnotherFill()).toBe('unknown')
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
