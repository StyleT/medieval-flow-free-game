import { describe, expect, it } from 'vitest'
import { createGame } from '../../engine/game.ts'
import { parseLevel } from '../../engine/levels.ts'
import { connectedColors, newlyConnected } from './connectFx.ts'

const set = (...c: string[]) => new Set(c)

describe('newlyConnected', () => {
  it('reports a new connection', () => {
    expect(newlyConnected(set(), set('A'))).toEqual(['A'])
  })
  it('returns several at once in color order', () => {
    expect(newlyConnected(set(), set('C', 'A', 'B'))).toEqual(['A', 'B', 'C'])
  })
  it('only reports the new ones', () => {
    expect(newlyConnected(set('A'), set('A', 'B'))).toEqual(['B'])
  })
  it('returns nothing for empty sets or no change', () => {
    expect(newlyConnected(set(), set())).toEqual([])
    expect(newlyConnected(set('A', 'B'), set('A', 'B'))).toEqual([])
  })
  it('does not report a disconnect', () => {
    expect(newlyConnected(set('A', 'B'), set('A'))).toEqual([])
    expect(newlyConnected(set('A'), set())).toEqual([])
  })
})

describe('connectedColors', () => {
  const level = parseLevel({ id: 'c', name: 'C' }, ['AB', 'AB'])
  it('is empty for a fresh game', () => {
    expect(connectedColors(createGame(level)).size).toBe(0)
  })
  it('contains a flow whose path ends on its other endpoint', () => {
    const state = createGame(level)
    const solved = { ...state, paths: { ...state.paths, A: level.solution.A } }
    expect([...connectedColors(solved)]).toEqual(['A'])
  })
  it('ignores a one-cell path', () => {
    const state = createGame(level)
    const one = { ...state, paths: { ...state.paths, A: [level.pairs[0].ends[0]] } }
    expect(connectedColors(one).size).toBe(0)
  })
})
