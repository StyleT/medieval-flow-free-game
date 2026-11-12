import { describe, expect, it } from 'vitest'
import { createGame } from './game.ts'
import { parseLevel } from './levels.ts'
import { starsFor } from './scoring.ts'
import type { GameState } from './types.ts'

const level = parseLevel({ id: 't', name: 't' }, ['AAB', 'CAB', 'CCB'])

const solved = (over: Partial<GameState> = {}): GameState => ({
  ...createGame(level),
  paths: level.solution,
  ...over,
})

describe('starsFor', () => {
  it('0 hints and optimal moves give 3', () => {
    expect(starsFor(solved({ moves: 3 }))).toBe(3)
    expect(starsFor(solved({ moves: 1 }))).toBe(3)
  })
  it('one hint gives 2', () => {
    expect(starsFor(solved({ moves: 3, hintsUsed: 1 }))).toBe(2)
  })
  it('extra moves give 2, and optimal + 1 is the boundary', () => {
    expect(starsFor(solved({ moves: 4 }))).toBe(2)
    expect(starsFor(solved({ moves: 3 }))).toBe(3)
  })
  it('one hint plus extra moves gives 1', () => {
    expect(starsFor(solved({ moves: 4, hintsUsed: 1 }))).toBe(1)
  })
  it('stays clamped at 1 with 3 hints and extra moves', () => {
    expect(starsFor(solved({ moves: 9, hintsUsed: 3 }))).toBe(1)
    expect(starsFor(solved({ moves: 3, hintsUsed: 3 }))).toBe(1)
  })
  it('an unsolved game gives 0', () => {
    expect(starsFor(createGame(level))).toBe(0)
  })
})
