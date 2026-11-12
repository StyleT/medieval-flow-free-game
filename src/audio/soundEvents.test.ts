import { describe, expect, it } from 'vitest'
import { applyHint, createGame, dragTo, endDrag, resetGame, startDrag } from '../engine/game.ts'
import { parseLevel } from '../engine/levels.ts'
import { BACKTRACK_RATE, CONNECT_RATE_MAX, CONNECT_RATE_MIN, connectRate, soundEventsFor, stepRate } from './soundEvents.ts'

const c = (row: number, col: number) => ({ row, col })
// 3x3, A: top row, B: middle row, C: bottom row
const level = parseLevel({ id: 'T', name: 'T' }, ['AAA', 'BBB', 'CCC'])
const fresh = () => createGame(level)

describe('soundEventsFor', () => {
  it('start: dragging from an endpoint', () => {
    const s0 = fresh()
    expect(soundEventsFor(s0, startDrag(s0, c(0, 0)))).toEqual({ id: 'start' })
  })
  it('tick on extend, pitch rises with length', () => {
    const s1 = startDrag(fresh(), c(0, 0))
    const s2 = dragTo(s1, c(0, 1))
    expect(soundEventsFor(s1, s2)).toEqual({ id: 'tick', rate: stepRate(2) })
    expect(stepRate(2)).toBeGreaterThan(stepRate(1))
  })
  it('tick at the backtrack rate when the pipe shrinks', () => {
    const s1 = dragTo(startDrag(fresh(), c(0, 0)), c(0, 1))
    const s2 = dragTo(s1, c(0, 0))
    expect(soundEventsFor(s1, s2)).toEqual({ id: 'tick', rate: BACKTRACK_RATE })
  })
  it('snip when entering another color pipe', () => {
    // A runs down the left column; B starts at (0,1)... build a cut with a custom level
    const l = parseLevel({ id: 'U', name: 'U' }, ['AB', 'AB', 'AB'])
    let s = createGame(l)
    s = endDrag(dragTo(dragTo(startDrag(s, c(0, 1)), c(1, 1)), c(2, 1))) // B connected
    s = startDrag(s, c(0, 0))
    const into = dragTo(s, c(0, 1)) // illegal (endpoint) => same
    expect(soundEventsFor(s, into)).toBeNull()
  })
  it('snip on a real cut', () => {
    // 2x3: A on row 0, B snakes so A can step onto B
    const l = parseLevel({ id: 'V', name: 'V' }, ['AAA', 'BBB'])
    let s = createGame(l)
    s = endDrag(dragTo(startDrag(s, c(1, 0)), c(1, 1))) // B partial: (1,0),(1,1)
    s = startDrag(s, c(0, 0))
    const next = dragTo(s, c(0, 1))
    const cut = dragTo(next, c(1, 1))
    expect(cut.paths.B.length).toBeLessThan(next.paths.B.length)
    expect(soundEventsFor(next, cut)).toEqual({ id: 'snip' })
  })
  it('connect, with a rate by color index', () => {
    const s1 = dragTo(startDrag(fresh(), c(1, 0)), c(1, 1))
    const s2 = dragTo(s1, c(1, 2))
    expect(soundEventsFor(s1, s2)).toEqual({ id: 'connect', rate: connectRate(1, 3) })
  })
  it('hint', () => {
    const s0 = fresh()
    expect(soundEventsFor(s0, applyHint(s0))?.id).toBe('hint')
  })
  it('solve beats connect on the last step', () => {
    let s = fresh()
    s = endDrag(dragTo(dragTo(startDrag(s, c(0, 0)), c(0, 1)), c(0, 2)))
    s = endDrag(dragTo(dragTo(startDrag(s, c(1, 0)), c(1, 1)), c(1, 2)))
    const a = startDrag(s, c(2, 0))
    const b = dragTo(dragTo(a, c(2, 1)), c(2, 2))
    expect(soundEventsFor(a, b)).toEqual({ id: 'solve' })
  })
  it('a hint that also connects plays hint', () => {
    const s0 = fresh()
    const next = applyHint(s0)
    expect(next.paths.A.length).toBe(3)
    expect(soundEventsFor(s0, next)).toEqual({ id: 'hint' })
  })
  it('a swipe that connects and ticks reports connect', () => {
    const s1 = startDrag(fresh(), c(0, 0))
    const s2 = dragTo(s1, c(0, 2)) // fast jump through two cells
    expect(soundEventsFor(s1, s2)?.id).toBe('connect')
  })
})

describe('soundEventsFor: boundaries and negatives', () => {
  it('step rate is capped at length 16', () => {
    expect(stepRate(16)).toBe(stepRate(40))
    expect(stepRate(15)).toBeLessThan(stepRate(16))
  })
  it('connect rate spans the range and survives a single color', () => {
    expect(connectRate(0, 5)).toBe(CONNECT_RATE_MIN)
    expect(connectRate(4, 5)).toBeCloseTo(CONNECT_RATE_MAX)
    expect(connectRate(0, 1)).toBe(CONNECT_RATE_MIN)
  })
  it('same object → null', () => {
    const s = fresh()
    expect(soundEventsFor(s, s)).toBeNull()
  })
  it('starting on an empty cell (same object) → null', () => {
    const s = fresh()
    expect(soundEventsFor(s, startDrag(s, c(0, 1)))).toBeNull()
  })
  it('endDrag only bumps moves → null', () => {
    const s = dragTo(startDrag(fresh(), c(0, 0)), c(0, 1))
    expect(soundEventsFor(s, endDrag(s))).toBeNull()
  })
  it('reset → null (handler-driven)', () => {
    const s = endDrag(dragTo(startDrag(fresh(), c(0, 0)), c(0, 1)))
    expect(soundEventsFor(s, resetGame(s))).toBeNull()
  })
  it('switching the active color is a start', () => {
    const s = endDrag(dragTo(startDrag(fresh(), c(0, 0)), c(0, 1)))
    expect(soundEventsFor(s, startDrag(s, c(1, 0)))).toEqual({ id: 'start' })
  })
  it('restarting on the same endpoint keeps no-op as null when nothing changed', () => {
    const s = startDrag(fresh(), c(0, 0))
    expect(soundEventsFor(s, { ...s })).toBeNull()
  })
  it('pressing another endpoint mid-drag is a start, not a tick', () => {
    const s = startDrag(fresh(), c(0, 0))
    expect(soundEventsFor(s, startDrag(s, c(1, 0)))).toEqual({ id: 'start' })
  })
  it('stepRate has exact values', () => {
    expect(stepRate(0)).toBe(1)
    expect(stepRate(2)).toBeCloseTo(1.07)
    expect(stepRate(16)).toBeCloseTo(1.56)
  })
})
