// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import { parseLevel } from './engine/levels.ts'
import { loadSave, writeSave } from './profile/storage.ts'
import { createProfile, emptySave } from './profile/profiles.ts'
import { SAVE_KEY } from './profile/types.ts'
import { FakeStorage } from './test-utils.ts'

// L1: 2x2, two 2-cell flows. L2: 2x3, two 3-cell flows.
const LEVELS = [
  parseLevel({ id: 'L1', name: 'Level 1' }, ['AB', 'AB']),
  parseLevel({ id: 'L2', name: 'Level 2' }, ['AABB'.slice(0, 3), 'CCB'].map((r) => r)),
]

let storage: FakeStorage
let clock: number
const now = () => (clock += 1000)
let ids: number

const setup = (preload?: (s: FakeStorage) => void) => {
  storage = new FakeStorage()
  preload?.(storage)
  return render(<App levels={LEVELS} storage={storage} now={now} newId={() => `id${++ids}`} />)
}

const createPlayer = (name: string) => {
  fireEvent.change(screen.getByLabelText('New player'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
}

/** jsdom has no layout: give the board a 100x100 rect and no pointer capture. */
function mockBoard() {
  const board = screen.getByTestId('board') as unknown as SVGSVGElement
  board.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect
  board.setPointerCapture = () => {}
  return board
}

const pointer = (el: Element, type: string, x: number, y: number, id = 1) =>
  act(() => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>
    Object.assign(e, { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y })
    el.dispatchEvent(e)
  })

beforeEach(() => {
  clock = 0
  ids = 0
})
afterEach(cleanup)

describe('boot and profiles', () => {
  it('shows Profiles when there is no active profile', () => {
    setup()
    expect(screen.getByRole('heading', { name: "Who's playing?" })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('jumps straight to Levels when an active profile exists', () => {
    setup((s) => {
      const r = createProfile(emptySave(), 'Ann', 1, 'a')
      if (r.ok) writeSave(s, r.save)
    })
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(screen.getByText('Total score 0 / 6')).toBeTruthy()
  })
  it('creating a profile saves it and opens Levels', () => {
    setup()
    createPlayer('  Zed ')
    expect(screen.getByText('Zed')).toBeTruthy()
    expect(loadSave(storage).profiles.id1.name).toBe('Zed')
  })
  it('shows inline validation for empty, too-long and taken names', () => {
    setup((s) => {
      const r = createProfile(emptySave(), 'Ann', 1, 'a')
      if (r.ok) writeSave(s, { ...r.save, activeProfileId: null })
    })
    const input = screen.getByLabelText('New player')
    fireEvent.change(input, { target: { value: 'ann' } })
    expect(screen.getByRole('alert').textContent).toBe('That name is taken')
    fireEvent.change(input, { target: { value: 'x'.repeat(17) } })
    expect(screen.getByRole('alert').textContent).toBe('Max 16 characters')
    fireEvent.change(input, { target: { value: ' ' } })
    expect(screen.getByRole('alert').textContent).toBe('Enter a name')
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('delete needs a confirm step', () => {
    setup((s) => {
      const r = createProfile(emptySave(), 'Ann', 1, 'a')
      if (r.ok) writeSave(s, { ...r.save, activeProfileId: null })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ann' }))
    expect(loadSave(storage).profiles.a).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(loadSave(storage).profiles.a).toBeUndefined()
  })
  it('Switch player returns to Profiles, and picking a profile opens Levels', () => {
    setup()
    createPlayer('Ann')
    fireEvent.click(screen.getByRole('button', { name: 'Switch player' }))
    expect(screen.getByRole('heading', { name: "Who's playing?" })).toBeTruthy()
    fireEvent.click(screen.getByText('Ann'))
    expect(screen.getByText('Total score 0 / 6')).toBeTruthy()
  })
})

describe('levels', () => {
  it('locks level 2 until level 1 is done', () => {
    setup()
    createPlayer('Ann')
    expect((screen.getByRole('button', { name: 'Level 1' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Level 2 (locked)' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('2×2 · 2 flows')).toBeTruthy()
  })
  it('warns when storage is unavailable', () => {
    storage = new FakeStorage()
    storage.throwOnSet = true
    render(<App levels={LEVELS} storage={storage} now={now} newId={() => 'x'} />)
    createPlayer('Ann')
    expect(screen.getByRole('status').textContent).toContain("won't be saved")
  })
  it('works with no storage at all', () => {
    render(<App levels={LEVELS} storage={null} now={now} newId={() => 'x'} />)
    createPlayer('Ann')
    expect(screen.getByRole('status')).toBeTruthy()
  })
})

describe('play', () => {
  const openLevel1 = () => {
    setup()
    createPlayer('Ann')
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))
    return mockBoard()
  }

  it('renders the board with one tint-free grid and both endpoints per flow', () => {
    openLevel1()
    expect(screen.getAllByTestId('end-A')).toHaveLength(2)
    expect(screen.getAllByTestId('end-B')).toHaveLength(2)
    expect(screen.queryByTestId('pipe-A')).toBeNull()
    expect(screen.getByTestId('moves').textContent).toBe('0 / 2')
    expect(screen.getByTestId('hints-left').textContent).toBe('Hints left: 3')
  })
  it('a pointer drag draws a pipe and counts a move', () => {
    const board = openLevel1()
    pointer(board, 'pointerdown', 25, 25)
    expect(screen.getByTestId('halo')).toBeTruthy()
    pointer(board, 'pointermove', 25, 75)
    pointer(board, 'pointerup', 25, 75)
    expect(screen.getByTestId('pipe-A').getAttribute('points')).toBe('0.5,0.5 0.5,1.5')
    expect(screen.getByTestId('moves').textContent).toBe('1 / 2')
    expect(screen.queryByTestId('halo')).toBeNull()
  })
  it('ignores a second pointer, other pointer ids and pointerdown outside the board', () => {
    const board = openLevel1()
    pointer(board, 'pointerdown', 25, 25, 1)
    pointer(board, 'pointerdown', 75, 25, 2)
    pointer(board, 'pointermove', 75, 75, 2)
    pointer(board, 'pointerup', 75, 75, 2)
    expect(screen.getByTestId('halo')).toBeTruthy() // drag 1 still active
    pointer(board, 'pointerup', 25, 25, 1)
    pointer(board, 'pointerdown', 150, 150, 3)
    expect(screen.queryByTestId('halo')).toBeNull()
  })
  it('pointercancel ends the drag like pointerup', () => {
    const board = openLevel1()
    pointer(board, 'pointerdown', 25, 25)
    pointer(board, 'pointermove', 25, 75)
    pointer(board, 'pointercancel', 25, 75)
    expect(screen.getByTestId('moves').textContent).toBe('1 / 2')
  })
  it('Hint fills a flow and counts down', () => {
    openLevel1()
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByTestId('pipe-A')).toBeTruthy()
    expect(screen.getByTestId('hints-left').textContent).toBe('Hints left: 2')
  })
  it('Reset clears the board', () => {
    openLevel1()
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.queryByTestId('pipe-A')).toBeNull()
    expect(screen.getByTestId('hints-left').textContent).toBe('Hints left: 3')
  })
  it('Back returns to Levels', () => {
    openLevel1()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Total score 0 / 6')).toBeTruthy()
  })
})

describe('completion', () => {
  const solveLevel1 = (board: SVGSVGElement) => {
    pointer(board, 'pointerdown', 25, 25)
    pointer(board, 'pointermove', 25, 75)
    pointer(board, 'pointerup', 25, 75)
    pointer(board, 'pointerdown', 75, 25)
    pointer(board, 'pointermove', 75, 75)
    pointer(board, 'pointerup', 75, 75)
  }
  const start = () => {
    setup()
    createPlayer('Ann')
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))
    return mockBoard()
  }

  it('solving shows the dialog with 3 stars, saves a first clear and unlocks the next level', () => {
    solveLevel1(start())
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('First clear! +3 ★')).toBeTruthy()
    expect(within(dialog).getByText('Total score 3 / 6')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Next level' })).toBeTruthy()
    const rec = loadSave(storage).profiles.id1.levels.L1
    expect(rec.firstClear).toMatchObject({ stars: 3, moves: 2, hintsUsed: 0 })
    expect(rec.firstClear.durationMs).toBeGreaterThan(0)
  })
  it('Next level opens level 2', () => {
    solveLevel1(start())
    fireEvent.click(screen.getByRole('button', { name: 'Next level' }))
    expect(screen.getByRole('heading', { name: 'Level 2' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('a hinted solve earns fewer stars; a replay leaves the score unchanged', () => {
    start()
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('First clear! +1 ★')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    const board = mockBoard()
    solveLevel1(board)
    expect(screen.getByText('Replay: score unchanged (first clear 1 ★)')).toBeTruthy()
    expect(screen.getByText('Total score 1 / 6')).toBeTruthy()
    const rec = loadSave(storage).profiles.id1.levels.L1
    expect(rec.firstClear.stars).toBe(1)
    expect(rec.best.stars).toBe(3)
    expect(rec.completions).toBe(2)
  })
  it('Esc closes the dialog and returns to Levels', () => {
    solveLevel1(start())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('Total score 3 / 6')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('clicking the backdrop closes the dialog, clicking inside does not', () => {
    solveLevel1(start())
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('stats sheet', () => {
  it('opens for a completed level and states replays do not change the score', () => {
    setup()
    createPlayer('Ann')
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))
    mockBoard()
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stats for Level 1' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/First clear/)).toBeTruthy()
    expect(within(dialog).getByText("Replays don't change your score.")).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('has no Stats button for an uncompleted level', () => {
    setup()
    createPlayer('Ann')
    expect(screen.queryByRole('button', { name: 'Stats for Level 1' })).toBeNull()
  })
})

describe('persistence across reloads', () => {
  it('restores progress from storage', () => {
    setup()
    createPlayer('Ann')
    cleanup()
    render(<App levels={LEVELS} storage={storage} now={now} newId={() => 'x'} />)
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(storage.getItem(SAVE_KEY)).not.toBeNull()
  })
})
