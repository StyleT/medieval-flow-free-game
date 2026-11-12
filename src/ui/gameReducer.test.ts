import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/game.ts'
import { parseLevel } from '../engine/levels.ts'
import { gameReducer } from './gameReducer.ts'

const level = parseLevel({ id: 't', name: 't' }, ['AAB', 'CAB', 'CCB'])
const c = (row: number, col: number) => ({ row, col })

describe('gameReducer', () => {
  it('start, moveMany and end drive a drag', () => {
    let s = gameReducer(createGame(level), { type: 'start', cell: c(0, 0) })
    s = gameReducer(s, { type: 'moveMany', cells: [c(0, 1), c(1, 1)] })
    s = gameReducer(s, { type: 'end' })
    expect(s.paths.A).toEqual([c(0, 0), c(0, 1), c(1, 1)])
    expect(s.moves).toBe(1)
  })
  it('moveMany stops at the first illegal cell and ignores an empty list', () => {
    const started = gameReducer(createGame(level), { type: 'start', cell: c(0, 0) })
    expect(gameReducer(started, { type: 'moveMany', cells: [] })).toBe(started)
    const s = gameReducer(started, { type: 'moveMany', cells: [c(0, 1), c(0, 2), c(1, 2)] })
    expect(s.paths.A).toEqual([c(0, 0), c(0, 1)])
  })
  it('hint, reset and load', () => {
    const hinted = gameReducer(createGame(level), { type: 'hint' })
    expect(hinted.hintsUsed).toBe(1)
    expect(gameReducer(hinted, { type: 'reset' }).hintsUsed).toBe(0)
    const other = parseLevel({ id: 'o', name: 'o' }, ['AA'])
    expect(gameReducer(hinted, { type: 'load', level: other }).level.id).toBe('o')
  })
})
