import { describe, expect, it } from 'vitest'
import { analyzeLevel, detourOf, meetsQuota } from './forced.ts'
import { parseLevel } from './levels.ts'
import type { Level } from './types.ts'

const meta = { id: 't', name: 't' }
const c = (row: number, col: number) => ({ row, col })

describe('detourOf', () => {
  it('is 0 for a monotone flow and counts the extra cells otherwise', () => {
    expect(detourOf([c(0, 0), c(0, 1), c(0, 2)])).toBe(0)
    expect(detourOf([c(0, 0), c(1, 0), c(1, 1), c(0, 1), c(0, 2)])).toBe(2)
  })
})

describe('meetsQuota (R16)', () => {
  it('needs max(1, round(0.3 * flows)) forced flows and one forced detour', () => {
    expect(meetsQuota(2, 1, 6)).toBe(true)
    expect(meetsQuota(1, 1, 6)).toBe(false)
    expect(meetsQuota(1, 1, 1)).toBe(true)
    expect(meetsQuota(5, 0, 6)).toBe(false)
    expect(meetsQuota(0, 0, 3)).toBe(false)
  })
})

describe('analyzeLevel', () => {
  it('finds every flow of a unique level forced, with the detours counted', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    const q = analyzeLevel(level, { exhaustive: true })
    expect(q.forced).toEqual(['A', 'B', 'C'])
    expect(q.totalDetour).toBe(0)
    expect(q.forcedDetour).toBe(0)
    expect(q.met).toBe(false) // forced but no detour
  })
  it('reports nothing forced on a wide-open board', () => {
    const level = openLevel()
    const q = analyzeLevel(level, { exhaustive: true })
    expect(q.forced).toEqual([])
    expect(q.met).toBe(false)
  })
  it('counts a flow as not forced when the deadline has passed', () => {
    const level = parseLevel(meta, ['AAB', 'CAB', 'CCB'])
    const q = analyzeLevel(level, { exhaustive: true, deadline: Date.now() - 1 })
    expect(q.forced).toEqual([])
  })
  it('checks the longest detour first and stops as soon as the quota is met', () => {
    // B wraps around A (detour 2), A is a straight pair (detour 0); both are forced
    const level = parseLevel(meta, ['BAAB', 'BBBB'])
    expect(analyzeLevel(level)).toEqual({ forced: ['B'], forcedDetour: 1, totalDetour: 2, met: true })
  })
  it('exhaustive checks every flow and returns the forced colors sorted', () => {
    const level = parseLevel(meta, ['BAAB', 'BBBB'])
    expect(analyzeLevel(level, { exhaustive: true })).toEqual({ forced: ['A', 'B'], forcedDetour: 1, totalDetour: 2, met: true })
  })
  it('totalDetour sums the detours of every flow, forced or not', () => {
    // A: U-turn with detour 4; B and C: straight, detour 0. Nothing is proved before the deadline.
    const level = parseLevel(meta, ['AAAC', 'ABBC', 'AAAC'])
    expect(analyzeLevel(level, { deadline: Date.now() - 1 })).toEqual({ forced: [], forcedDetour: 0, totalDetour: 4, met: false })
  })
  it('a forced flow with a detour of exactly 2 counts as a forced detour (boundary)', () => {
    const level = parseLevel(meta, ['ABBA', 'AAAA'])
    expect(detourOf(level.solution.A)).toBe(2)
    expect(analyzeLevel(level, { exhaustive: true })).toMatchObject({ forced: ['A', 'B'], forcedDetour: 1, met: true })
  })
  it('stops at the quota unless exhaustive', () => {
    const level = parseLevel(meta, ['AAAAAA', 'CCCBBA', 'CBCBDA', 'BBCBDA', 'BCCBDA', 'BBBBDD'])
    const early = analyzeLevel(level)
    const all = analyzeLevel(level, { exhaustive: true })
    expect(all.forced.length).toBeGreaterThanOrEqual(early.forced.length)
    expect(early.met).toBe(all.met)
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
