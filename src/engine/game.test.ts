import { describe, expect, it } from 'vitest'
import {
  applyHint,
  createGame,
  dragTo,
  endDrag,
  endpointAt,
  isFlowConnected,
  isSolved,
  occupantAt,
  progress,
  resetGame,
  startDrag,
} from './game.ts'
import { parseLevel } from './levels.ts'
import type { Cell, GameState, Level } from './types.ts'

const c = (row: number, col: number): Cell => ({ row, col })

// A: (0,0)(0,1)(1,1)   B: (0,2)(1,2)(2,2)   C: (1,0)(2,0)(2,1)
const level = parseLevel({ id: 't', name: 't' }, ['AAB', 'CAB', 'CCB'])
// with a blocked cell: A: (0,0)(0,1)  #: (0,2)
const blockedLevel = parseLevel({ id: 'b', name: 'b' }, ['AA#', 'BBB'.replace('BBB', 'CC#')])

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

/** Runs a drag: start, move through the given cells, end. */
function drag(s: GameState, start: Cell, ...to: Cell[]): GameState {
  let state = startDrag(s, start)
  for (const cell of to) state = dragTo(state, cell)
  return endDrag(state)
}

const solvedState = (): GameState => ({ ...createGame(level), paths: level.solution })

describe('queries', () => {
  it('endpointAt and occupantAt', () => {
    expect(endpointAt(level, c(0, 0))).toBe('A')
    expect(endpointAt(level, c(1, 1))).toBe('A')
    expect(endpointAt(level, c(0, 1))).toBeNull()
    const s = drag(createGame(level), c(0, 0), c(0, 1))
    expect(occupantAt(s, c(0, 1))).toBe('A')
    expect(occupantAt(s, c(2, 2))).toBeNull()
  })
  it('R9 a path of length 1 is not connected; reaching the other end is', () => {
    const started = startDrag(createGame(level), c(0, 0))
    expect(isFlowConnected(started, 'A')).toBe(false)
    expect(isFlowConnected(solvedState(), 'A')).toBe(true)
  })
  it('progress counts flows and fill percentage', () => {
    expect(progress(createGame(level))).toEqual({ flowsConnected: 0, flowsTotal: 3, filledPct: 0 })
    expect(progress(solvedState())).toEqual({ flowsConnected: 3, flowsTotal: 3, filledPct: 100 })
    const s = drag(createGame(level), c(0, 0), c(0, 1))
    expect(progress(s)).toEqual({ flowsConnected: 0, flowsTotal: 3, filledPct: 22 })
  })
  it('progress excludes blocked cells from the total', () => {
    const s = drag(createGame(blockedLevel), c(0, 0), c(0, 1))
    expect(progress(s).filledPct).toBe(50)
  })
  it('resetGame clears paths, moves and hints', () => {
    const s = applyHint(drag(createGame(level), c(0, 0), c(0, 1)))
    const reset = resetGame(s)
    expect(reset.moves).toBe(0)
    expect(reset.hintsUsed).toBe(0)
    expect(reset.paths.A).toEqual([])
    expect(reset.lastMovedColor).toBeNull()
  })
})

describe('R4 startDrag', () => {
  it('starts from either endpoint', () => {
    expect(startDrag(createGame(level), c(0, 0)).paths.A).toEqual([c(0, 0)])
    const s = startDrag(createGame(level), c(1, 1))
    expect(s.paths.A).toEqual([c(1, 1)])
    expect(s.active).toBe('A')
  })
  it('restarting on an endpoint clears the pipe', () => {
    const s = drag(createGame(level), c(0, 0), c(0, 1))
    const again = startDrag(s, c(0, 0))
    expect(again.paths.A).toEqual([c(0, 0)])
    expect(again.dragChanged).toBe(true)
  })
  it('restarting on a lone endpoint changes nothing', () => {
    const s = endDrag(startDrag(createGame(level), c(0, 0)))
    expect(startDrag(s, c(0, 0)).dragChanged).toBe(false)
  })
  it('starting mid-pipe truncates and continues from it', () => {
    const s = drag(createGame(level), c(0, 0), c(0, 1), c(1, 1))
    const mid = startDrag(s, c(0, 1))
    expect(mid.paths.A).toEqual([c(0, 0), c(0, 1)])
    expect(mid.active).toBe('A')
    expect(mid.dragChanged).toBe(true)
  })
  it('starting on the pipe head changes nothing', () => {
    const s = drag(createGame(level), c(0, 0), c(0, 1))
    const head = startDrag(s, c(0, 1))
    expect(head.paths.A).toEqual([c(0, 0), c(0, 1)])
    expect(head.dragChanged).toBe(false)
  })
  it('is a no-op on empty, blocked and out-of-bounds cells', () => {
    const s = createGame(level)
    expect(startDrag(s, c(0, 1))).toBe(s)
    expect(startDrag(createGame(blockedLevel), c(0, 2))).toEqual(createGame(blockedLevel))
    expect(startDrag(s, c(-1, 0))).toBe(s)
    expect(startDrag(s, c(0, 9))).toBe(s)
  })
})

describe('R5-R6 extend and backtrack', () => {
  it('R5 extends into an empty adjacent cell', () => {
    const s = dragTo(startDrag(createGame(level), c(0, 0)), c(0, 1))
    expect(s.paths.A).toEqual([c(0, 0), c(0, 1)])
    expect(s.dragChanged).toBe(true)
  })
  it('R6 backtracking truncates the pipe', () => {
    let s = startDrag(createGame(level), c(0, 0))
    s = dragTo(dragTo(s, c(0, 1)), c(1, 1))
    s = dragTo(s, c(0, 1))
    expect(s.paths.A).toEqual([c(0, 0), c(0, 1)])
  })
  it('dragging onto the head is a no-op', () => {
    const s = startDrag(createGame(level), c(0, 0))
    expect(dragTo(s, c(0, 0))).toBe(s)
  })
  it('dragging along the board edge works', () => {
    const s = drag(createGame(level), c(2, 2), c(1, 2), c(0, 2))
    expect(s.paths.B).toEqual([c(2, 2), c(1, 2), c(0, 2)])
  })
})

describe('R7 cutting', () => {
  // rows: A (0,0)-(0,2), B (1,0)-(1,2), C (2,0)-(2,2)
  const rows = parseLevel({ id: 'rows', name: 'rows' }, ['AAA', 'BBB', 'CCC'])

  it('cuts the other color, which keeps only the cells before the entered one', () => {
    let s = drag(createGame(rows), c(1, 0), c(1, 1), c(1, 2)) // B connected
    s = startDrag(s, c(0, 0))
    s = dragTo(dragTo(s, c(0, 1)), c(1, 1)) // enter B's middle cell
    expect(s.paths.B).toEqual([c(1, 0)])
    expect(s.paths.A).toEqual([c(0, 0), c(0, 1), c(1, 1)])
  })
  it('cutting the head cell drops only that cell', () => {
    let s = drag(createGame(rows), c(1, 0), c(1, 1)) // B: (1,0),(1,1)
    s = startDrag(s, c(0, 0))
    s = dragTo(dragTo(s, c(0, 1)), c(1, 1))
    expect(s.paths.B).toEqual([c(1, 0)])
  })
  it('a cut pipe is no longer connected', () => {
    let s = drag(createGame(rows), c(1, 0), c(1, 1), c(1, 2))
    s = dragTo(dragTo(startDrag(s, c(0, 0)), c(0, 1)), c(1, 1))
    expect(isFlowConnected(s, 'B')).toBe(false)
  })
})

describe('R8-R9 forbidden cells and connection', () => {
  it('never enters another color endpoint', () => {
    const s = startDrag(createGame(level), c(0, 0))
    const next = dragTo(dragTo(s, c(0, 1)), c(0, 2))
    expect(next.paths.A).toEqual([c(0, 0), c(0, 1)])
  })
  it('never enters a blocked cell', () => {
    const s = startDrag(createGame(blockedLevel), c(0, 0))
    const next = dragTo(dragTo(s, c(0, 1)), c(0, 2))
    expect(next.paths.A).toEqual([c(0, 0), c(0, 1)])
  })
  it('reaching the matching endpoint connects, and forward moves are then ignored', () => {
    let s = startDrag(createGame(level), c(0, 0))
    s = dragTo(dragTo(s, c(0, 1)), c(1, 1))
    expect(isFlowConnected(s, 'A')).toBe(true)
    const after = dragTo(s, c(1, 0)) // would be an empty-looking cell of C's endpoint, ignored anyway
    expect(after.paths.A).toEqual(s.paths.A)
    const before = createGame(level)
    // forward move past connection into an empty neighbour (use blockedLevel-free layout)
    expect(dragTo(s, c(2, 1)).paths.A).toEqual(s.paths.A)
    expect(before.paths.A).toEqual([])
  })
  it('backtracking still works after connecting', () => {
    let s = startDrag(createGame(level), c(0, 0))
    s = dragTo(dragTo(s, c(0, 1)), c(1, 1))
    s = dragTo(s, c(0, 1))
    expect(s.paths.A).toEqual([c(0, 0), c(0, 1)])
    expect(isFlowConnected(s, 'A')).toBe(false)
  })
})

describe('R10 jumps', () => {
  const row = parseLevel({ id: 'r', name: 'r' }, ['AAAA', 'BBBB'])
  it('interpolates a straight jump cell by cell', () => {
    const s = dragTo(startDrag(createGame(row), c(0, 0)), c(0, 3))
    expect(s.paths.A).toEqual([c(0, 0), c(0, 1), c(0, 2), c(0, 3)])
  })
  it('stops at the first illegal cell', () => {
    const blocked = dragTo(startDrag(createGame(blockedLevel), c(0, 0)), c(0, 2))
    expect(blocked.paths.A).toEqual([c(0, 0), c(0, 1)])
    const rows = parseLevel({ id: 'r', name: 'r' }, ['AAAA', 'BBBB'])
    const walled = { ...rows, blocked: [c(0, 2)] }
    const jumped = dragTo(startDrag(createGame(walled), c(0, 0)), c(0, 3))
    expect(jumped.paths.A).toEqual([c(0, 0), c(0, 1)])
  })
  it('ignores an L-shaped jump', () => {
    const s = startDrag(createGame(level), c(0, 0))
    expect(dragTo(s, c(1, 1))).toBe(s)
  })
  it('ignores out-of-bounds targets', () => {
    const s = startDrag(createGame(level), c(0, 0))
    expect(dragTo(s, c(-1, 0))).toBe(s)
    expect(dragTo(s, c(0, -3))).toBe(s)
  })
  it('dragTo with no active drag is a no-op', () => {
    const s = createGame(level)
    expect(dragTo(s, c(0, 1))).toBe(s)
  })
})

describe('R11 isSolved', () => {
  it('is true on the full solution', () => {
    expect(isSolved(solvedState())).toBe(true)
  })
  it('is false when all flows are connected but one cell is empty', () => {
    const s = solvedState()
    const short = { ...s, paths: { ...s.paths, B: [c(0, 2), c(1, 2)] } }
    expect(isSolved(short)).toBe(false)
    expect(isSolved(createGame(level))).toBe(false)
  })
  it('is false when every cell is covered but a flow is not connected', () => {
    const lvl = parseLevel({ id: 'x', name: 'x' }, ['AAAA'])
    expect(isSolved({ ...createGame(lvl), paths: { A: lvl.solution.A.slice(0, 3) } })).toBe(false)
  })
})

describe('R12 hints', () => {
  it('applies the first differing flow solution path', () => {
    const s = applyHint(createGame(level))
    expect(s.paths.A).toEqual(level.solution.A)
    expect(s.hintsUsed).toBe(1)
    expect(s.moves).toBe(0)
  })
  it('cuts overlapping pipes of other colors', () => {
    let s = startDrag(createGame(level), c(1, 0))
    s = endDrag(dragTo(dragTo(s, c(1, 1)), c(0, 1))) // C wanders through A's cells
    const hinted = applyHint(s)
    expect(hinted.paths.A).toEqual(level.solution.A)
    expect(hinted.paths.C).toEqual([c(1, 0)])
  })
  it('walks through different flows on repeated hints', () => {
    let s = applyHint(createGame(level))
    s = applyHint(s)
    expect(s.paths.B).toEqual(level.solution.B)
    s = applyHint(s)
    expect(s.paths.C).toEqual(level.solution.C)
  })
  it('treats a reversed correct path as matching', () => {
    const reversed = { ...createGame(level), paths: { ...createGame(level).paths, A: [...level.solution.A].reverse() } }
    expect(applyHint(reversed).paths.B).toEqual(level.solution.B)
  })
  it('allows the 3rd hint and makes the 4th a no-op', () => {
    const lvl = parseLevel({ id: 'h', name: 'h' }, ['ABCD', 'ABCD', 'ABCD'])
    let s = createGame(lvl)
    s = applyHint(applyHint(applyHint(s)))
    expect(s.hintsUsed).toBe(3)
    const fourth = applyHint(s)
    expect(fourth).toBe(s)
    expect(isSolved(s)).toBe(false)
  })
  it('skips a flow connected along a different valid route', () => {
    const open: Level = {
      id: 'o',
      name: 'o',
      rows: 3,
      cols: 3,
      blocked: [],
      optimalMoves: 2,
      pairs: [
        { color: 'A', ends: [c(0, 0), c(0, 2)] },
        { color: 'B', ends: [c(2, 0), c(2, 2)] },
      ],
      solution: { A: [c(0, 0), c(0, 1), c(0, 2)], B: [c(2, 0), c(2, 1), c(2, 2)] },
    }
    const base = createGame(open)
    const detour = { ...base, paths: { ...base.paths, A: [c(0, 0), c(1, 0), c(1, 1), c(1, 2), c(0, 2)] } }
    expect(isFlowConnected(detour, 'A')).toBe(true)
    const hinted = applyHint(detour)
    expect(hinted.paths.A).toEqual(detour.paths.A)
    expect(hinted.paths.B).toEqual(open.solution.B)
  })
  it('targets an unconnected flow before a differing connected one', () => {
    const base = createGame(level)
    const wrongA = { ...base, paths: { ...base.paths, A: [c(0, 0), c(0, 1), c(1, 1)] } }
    expect(applyHint(wrongA).paths.B).toEqual(level.solution.B)
  })
  it('when all flows are connected but the board is not full, fixes the first differing flow', () => {
    const wide = parseLevel({ id: 'w', name: 'w' }, ['AB', 'AB'])
    const base = createGame(wide)
    const swapped = { ...base, paths: { A: [c(0, 0), c(1, 0)], B: [c(0, 1), c(1, 1)] } }
    expect(isSolved(swapped)).toBe(true)
    expect(applyHint(swapped)).toBe(swapped)
  })
  it('does nothing on a solved board', () => {
    const s = solvedState()
    expect(applyHint(s)).toBe(s)
  })
  it('does not reset the previous color', () => {
    const s = drag(createGame(level), c(0, 0), c(0, 1))
    expect(applyHint(s).lastMovedColor).toBe('A')
  })
})

describe('R13 move counting', () => {
  it('counts a finished drag that changed the board', () => {
    expect(drag(createGame(level), c(0, 0), c(0, 1)).moves).toBe(1)
  })
  it('a drag that changes nothing counts as 0', () => {
    expect(endDrag(startDrag(createGame(level), c(0, 0))).moves).toBe(0)
    expect(drag(createGame(level), c(0, 1)).moves).toBe(0)
  })
  it('two consecutive drags of the same color count as 1', () => {
    let s = drag(createGame(level), c(0, 0), c(0, 1))
    s = drag(s, c(0, 1), c(1, 1))
    expect(s.moves).toBe(1)
  })
  it('A-B-A counts as 3', () => {
    let s = drag(createGame(level), c(0, 0), c(0, 1))
    s = drag(s, c(0, 2), c(1, 2))
    s = drag(s, c(0, 1), c(1, 1))
    expect(s.moves).toBe(3)
    expect(s.lastMovedColor).toBe('A')
  })
  it('endDrag clears the active drag', () => {
    const s = endDrag(startDrag(createGame(level), c(0, 0)))
    expect(s.active).toBeNull()
    expect(s.dragChanged).toBe(false)
  })
})

describe('immutability', () => {
  it('never mutates its input state', () => {
    const base = deepFreeze(createGame(level))
    let s = startDrag(base, c(0, 0))
    deepFreeze(s)
    s = dragTo(s, c(0, 1))
    deepFreeze(s)
    s = endDrag(s)
    deepFreeze(s)
    s = startDrag(s, c(1, 0))
    deepFreeze(s)
    s = dragTo(dragTo(s, c(1, 1)), c(0, 1))
    deepFreeze(s)
    expect(() => applyHint(s)).not.toThrow()
    expect(() => resetGame(s)).not.toThrow()
    expect(base.paths.A).toEqual([])
  })
})
