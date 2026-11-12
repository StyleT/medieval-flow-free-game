// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import { parseLevel } from './engine/levels.ts'
import type { Level } from './engine/types.ts'
import { createProfile, emptySave, recordCompletion, recordGenerated, totalScore } from './profile/profiles.ts'
import { loadSave, writeSave } from './profile/storage.ts'
import { LEGACY_SAVE_KEY } from './profile/types.ts'
import type { SaveFile } from './profile/types.ts'
import { FakeStorage, attempt } from './test-utils.ts'

const LEVELS = [
  parseLevel({ id: 'L1', name: 'Level 1' }, ['AB', 'AB']),
  parseLevel({ id: 'L2', name: 'Level 2' }, ['AAB', 'CCB']),
]
const PUZZLE_GRID = ['AB', 'AB']

let storage: FakeStorage
let clock: number
const now = () => (clock += 1000)
let calls: { rows: number; cols: number; flows: number; seed: number }[]
let release: (() => void) | null

const fakeLevel = (id = 'p1'): Level => parseLevel({ id, name: '2×2' }, PUZZLE_GRID)
const generate = (request: (typeof calls)[number]) => {
  calls.push(request)
  return Promise.resolve(fakeLevel())
}
/** A generator that stays pending until `release()` is called. */
const slowGenerate = (request: (typeof calls)[number]) => {
  calls.push(request)
  return new Promise<Level>((resolve) => {
    release = () => resolve(fakeLevel())
  })
}
const failingGenerate = () => Promise.reject(new Error('boom'))

const clearedSave = (clearAll = true): SaveFile => {
  const created = createProfile(emptySave(), 'Ann', 1, 'a')
  if (!created.ok) throw new Error('setup')
  let save = recordCompletion(created.save, 'a', 'L1', attempt()).save
  if (clearAll) save = recordCompletion(save, 'a', 'L2', attempt()).save
  return save
}

const setup = (save: SaveFile | null = clearedSave(), gen: Parameters<typeof App>[0]['generate'] = generate) => {
  storage = new FakeStorage()
  if (save) writeSave(storage, save)
  return render(<App levels={LEVELS} storage={storage} now={now} newId={() => 'x'} generate={gen} newSeed={() => 7} />)
}

function mockBoard() {
  const board = screen.getByTestId('board') as unknown as SVGSVGElement
  board.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect
  board.setPointerCapture = () => {}
  return board
}
const pointer = (el: Element, type: string, x: number, y: number) =>
  act(() => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>
    Object.assign(e, { pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y })
    el.dispatchEvent(e)
  })
const solve = (board: SVGSVGElement) => {
  pointer(board, 'pointerdown', 25, 25)
  pointer(board, 'pointermove', 25, 75)
  pointer(board, 'pointerup', 25, 75)
  pointer(board, 'pointerdown', 75, 25)
  pointer(board, 'pointermove', 75, 75)
  pointer(board, 'pointerup', 75, 75)
}

/** The board appears outside `act`, so let React flush the effects that attach drag listeners. */
const boardReady = async () => {
  const board = await screen.findByTestId('board')
  await act(async () => {})
  return board
}

const generateAndSolve = async () => {
  fireEvent.click(screen.getByRole('button', { name: /^Generate/ }))
  await boardReady()
  solve(mockBoard())
}

beforeEach(() => {
  clock = 0
  calls = []
  release = null
})
afterEach(cleanup)

describe('endless availability', () => {
  it('is available before any level is cleared', () => {
    setup(clearedSave(false))
    expect(screen.getByRole('heading', { name: 'Endless' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Generate/ })).toBeTruthy()
  })
  it('is available on a brand-new profile and starts with an empty list', () => {
    const created = createProfile(emptySave(), 'New', 1, 'n')
    if (!created.ok) throw new Error('setup')
    setup(created.save)
    expect(screen.getByText('Auto-generated (0)')).toBeTruthy()
  })
})

describe('generating', () => {
  it('uses the chosen size, the flowsFor count and the injected seed', async () => {
    setup()
    fireEvent.click(screen.getByRole('radio', { name: '10×10' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate 10×10 · 9 flows' }))
    await boardReady()
    expect(calls).toEqual([{ rows: 10, cols: 10, flows: 9, seed: 7 }])
  })
  it('shows a spinner and disables the controls while generating, then opens the puzzle', async () => {
    setup(clearedSave(), slowGenerate)
    fireEvent.click(screen.getByRole('button', { name: /^Generate/ }))
    const busy = screen.getByRole('button', { name: /Generating/ }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    expect((screen.getByRole('radio', { name: '8×8' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(busy)
    expect(calls).toHaveLength(1)
    await act(async () => release?.())
    expect(await boardReady()).toBeTruthy()
  })
  it('shows an error and re-enables the button when generation fails', async () => {
    setup(clearedSave(), failingGenerate)
    fireEvent.click(screen.getByRole('button', { name: /^Generate/ }))
    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't generate")
    expect((screen.getByRole('button', { name: /^Generate/ }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('solving a generated puzzle', () => {
  it('shows stats without stars, stores the entry and leaves the total score alone', async () => {
    setup()
    await generateAndSolve()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Puzzle solved!')).toBeTruthy()
    expect(within(dialog).getByText(/2 moves · optimal 2/)).toBeTruthy()
    expect(within(dialog).queryByText(/★/)).toBeNull()
    expect(within(dialog).getByText(/Solved 1 time ·/)).toBeTruthy()
    const profile = loadSave(storage).profiles.a
    expect(profile.generated).toHaveLength(1)
    expect(profile.generated[0]).toMatchObject({ rows: 2, cols: 2, flows: 2, completions: 1, grid: PUZZLE_GRID })
    expect(totalScore(profile)).toBe(6)
  })
  it('"New puzzle" generates another of the same size', async () => {
    setup()
    await generateAndSolve()
    fireEvent.click(screen.getByRole('button', { name: 'New puzzle' }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]).toMatchObject({ rows: 2, cols: 2 }) // the solved puzzle's size
  })
  it('lists a generated puzzle right away, as not solved yet', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^Generate/ }))
    await boardReady()
    expect(loadSave(storage).profiles.a.generated).toHaveLength(1)
    expect(loadSave(storage).profiles.a.generated[0]).toMatchObject({ completions: 0, best: null })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Auto-generated (1)')).toBeTruthy()
    expect(screen.getByText('Not solved yet')).toBeTruthy()
  })
  it('solving that puzzle updates the same entry instead of adding a second', async () => {
    setup()
    await generateAndSolve()
    expect(loadSave(storage).profiles.a.generated).toHaveLength(1)
    expect(loadSave(storage).profiles.a.generated[0].completions).toBe(1)
  })
  it('says the result will not be saved when storage is full', async () => {
    setup()
    storage.throwOnSet = true
    await generateAndSolve()
    expect(within(screen.getByRole('dialog')).getByText("This result won't be saved")).toBeTruthy()
  })
})

describe('auto-generated list', () => {
  const withPuzzle = (): SaveFile => {
    const out = recordGenerated(
      clearedSave(),
      'a',
      { id: 'p1', rows: 2, cols: 2, flows: 2, grid: PUZZLE_GRID },
      { moves: 2, hintsUsed: 0, durationMs: 9000, at: 5 },
    )
    return out!.save
  }
  const openList = () => fireEvent.click(screen.getByText(/Auto-generated/))

  it('is collapsed by default and lists the stored puzzle with its record', () => {
    setup(withPuzzle())
    expect((screen.getByText(/Auto-generated/).closest('details') as HTMLDetailsElement).open).toBe(false)
    expect(screen.getByText('Auto-generated (1)')).toBeTruthy()
    const list = within(screen.getByText(/Auto-generated/).closest('details') as HTMLElement)
    expect(list.getByText('2×2 · 2 flows')).toBeTruthy()
    expect(list.getByText(/Solved 1× · best 2\/2 moves · 0:09/)).toBeTruthy()
  })
  it('replaying bumps completions and keeps the better best', () => {
    setup(withPuzzle())
    openList()
    fireEvent.click(screen.getByRole('button', { name: /^Play 2×2 puzzle p1/ }))
    solve(mockBoard())
    expect(screen.getByText(/Solved 2 times/)).toBeTruthy()
    const entry = loadSave(storage).profiles.a.generated[0]
    expect(entry.completions).toBe(2)
    expect(entry.best!.durationMs).toBeLessThanOrEqual(9000)
    expect(calls).toHaveLength(0)
  })
  it('Delete removes the puzzle', () => {
    setup(withPuzzle())
    openList()
    fireEvent.click(screen.getByRole('button', { name: /^Delete 2×2 puzzle p1/ }))
    expect(screen.getByText('Auto-generated (0)')).toBeTruthy()
    expect(loadSave(storage).profiles.a.generated).toEqual([])
  })
  it('hides a puzzle whose grid no longer parses', () => {
    const save = withPuzzle()
    const broken = { ...save, profiles: { a: { ...save.profiles.a, generated: [{ ...save.profiles.a.generated[0], grid: ['AA', 'AA'] }] } } }
    setup(broken)
    expect(screen.getByText('Auto-generated (0)')).toBeTruthy()
  })
})

describe('v1 save migration in the app', () => {
  it('opens a v1 save, keeps progress and shows an empty Endless list', () => {
    storage = new FakeStorage()
    const v2 = clearedSave()
    const v1 = { ...v2, version: 1, profiles: { a: { ...v2.profiles.a, generated: undefined } } }
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(v1))
    render(<App levels={LEVELS} storage={storage} now={now} newId={() => 'x'} generate={generate} newSeed={() => 7} />)
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(screen.getByText('Auto-generated (0)')).toBeTruthy()
    expect(loadSave(storage).version).toBe(2)
  })
})
