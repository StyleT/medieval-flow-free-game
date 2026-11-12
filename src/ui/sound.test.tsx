// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { AUDIO_KEY } from '../audio/settings.ts'
import { parseLevel } from '../engine/levels.ts'
import { createProfile, emptySave } from '../profile/profiles.ts'
import { writeSave } from '../profile/storage.ts'
import { FakeStorage, fakePlayer } from '../test-utils.ts'

const LEVELS = [
  parseLevel({ id: 'L1', name: 'Level 1' }, ['AB', 'AB']),
  parseLevel({ id: 'L2', name: 'Level 2' }, ['AAB', 'CCB']),
]
let clock = 0
const now = () => (clock += 1000)

afterEach(cleanup)

const setup = (opts: { profile?: boolean; storage?: FakeStorage } = {}) => {
  const storage = opts.storage ?? new FakeStorage()
  if (opts.profile !== false) {
    const r = createProfile(emptySave(), 'Ann', 1, 'a')
    if (r.ok) writeSave(storage, r.save)
  }
  const audio = fakePlayer()
  const view = render(<App levels={LEVELS} storage={storage} now={now} newId={() => 'x'} audio={audio} />)
  return { audio, storage, ...view }
}

const openLevel1 = () => {
  const ctx = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))
  const board = screen.getByTestId('board') as unknown as SVGSVGElement
  board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect
  board.setPointerCapture = () => {}
  return { ...ctx, board }
}
const pointer = (el: Element, type: string, x: number, y: number) =>
  fireEvent(el, Object.assign(new Event(type, { bubbles: true, cancelable: true }), { pointerId: 1, clientX: x, clientY: y, button: 0, isPrimary: true }))

describe('sound toggle', () => {
  it('renders on profiles, levels and play screens', () => {
    const { unmount } = setup({ profile: false })
    expect(screen.getByRole('button', { name: 'Sound settings' })).toBeTruthy()
    unmount()
    cleanup()
    openLevel1()
    expect(screen.getByRole('button', { name: 'Sound settings' })).toBeTruthy()
  })
  it('renders on the levels screen', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Sound settings' })).toBeTruthy()
  })
  it('toggles music and sfx separately, applies to the player and persists', () => {
    const { audio, storage } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }))
    const [music, sfx] = screen.getAllByRole('switch')
    expect(music.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(music)
    expect(music.getAttribute('aria-checked')).toBe('false')
    expect(sfx.getAttribute('aria-checked')).toBe('true')
    expect(audio.enabled.at(-1)).toEqual({ music: false, sfx: true })
    fireEvent.click(sfx)
    expect(audio.enabled.at(-1)).toEqual({ music: false, sfx: false })
    expect(JSON.parse(storage.getItem(AUDIO_KEY)!)).toEqual({ music: false, sfx: false })
  })
  it('a reload restores the saved settings', () => {
    const storage = new FakeStorage()
    storage.setItem(AUDIO_KEY, '{"music":false,"sfx":true}')
    const { audio } = setup({ storage })
    expect(audio.enabled.at(-1)).toEqual({ music: false, sfx: true })
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }))
    expect(screen.getAllByRole('switch')[0].getAttribute('aria-checked')).toBe('false')
  })
  it('Esc and an outside press close the popover; presses inside do not', () => {
    setup()
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }))
    open()
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    fireEvent.pointerDown(screen.getAllByRole('switch')[0])
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    open()
    fireEvent.pointerDown(document.body)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    open()
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getAllByRole('switch')).toHaveLength(2)
  })
  it('still works for the session when storage throws', () => {
    const storage = new FakeStorage()
    storage.throwOnSet = true
    const { audio } = setup({ storage })
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }))
    fireEvent.click(screen.getAllByRole('switch')[1])
    expect(screen.getAllByRole('switch')[1].getAttribute('aria-checked')).toBe('false')
    expect(audio.enabled.at(-1)).toEqual({ music: true, sfx: false })
  })
  it('works with no storage', () => {
    const audio = fakePlayer()
    render(<App levels={LEVELS} storage={null} now={now} newId={() => 'x'} audio={audio} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }))
    fireEvent.click(screen.getAllByRole('switch')[0])
    expect(audio.enabled.at(-1)).toEqual({ music: false, sfx: true })
  })
})

describe('sound wiring', () => {
  it('music follows the screen: menu → play → menu', () => {
    const { audio } = setup()
    expect(audio.music.at(-1)).toBe('menu')
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))
    expect(audio.music.at(-1)).toBe('play')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(audio.music.at(-1)).toBe('menu')
  })
  it('profiles screen uses the menu bed', () => {
    const { audio } = setup({ profile: false })
    expect(audio.music.at(-1)).toBe('menu')
  })
  it('a generic button plays click; data-sfx="none" plays nothing; disabled plays nothing', () => {
    const { audio } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Switch player' }))
    expect(audio.sfx.filter((e) => e.id === 'click')).toHaveLength(1)
    // Profiles screen: the disabled Play button makes no sound.
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(audio.sfx.filter((e) => e.id === 'click')).toHaveLength(1)
  })
  it('Hint and Reset get their own sounds, not click', () => {
    const { audio } = openLevel1()
    audio.sfx.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(audio.sfx.map((e) => e.id)).toEqual(['hint'])
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(audio.sfx.map((e) => e.id)).toEqual(['hint', 'reset'])
  })
  it('unlocks audio on the first pointerdown and keydown', () => {
    const { audio } = setup()
    fireEvent.pointerDown(document.body)
    fireEvent.keyDown(document, { key: 'a' })
    expect(audio.unlocks).toBe(2)
  })
  it('hidden tab is forwarded to the player', () => {
    const { audio } = setup()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    fireEvent(document, new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    fireEvent(document, new Event('visibilitychange'))
    expect(audio.hidden).toEqual([true, false])
  })
  it('profile create / pick / delete / invalid name', () => {
    const { audio } = setup({ profile: false })
    const form = screen.getByLabelText('New player').closest('form')!
    fireEvent.submit(form) // empty → invalid
    expect(audio.sfx.at(-1)?.id).toBe('error')
    fireEvent.change(screen.getByLabelText('New player'), { target: { value: 'Bo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(audio.sfx.map((e) => e.id)).toContain('confirm')
    fireEvent.click(screen.getByRole('button', { name: 'Switch player' }))
    audio.sfx.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(audio.sfx.map((e) => e.id)).toContain('cancel')
  })
  it('dragging plays start, connect and solve, then the star events', () => {
    const { audio, board } = openLevel1()
    audio.sfx.length = 0
    pointer(board, 'pointerdown', 25, 25)
    pointer(board, 'pointermove', 25, 75)
    pointer(board, 'pointerup', 25, 75)
    pointer(board, 'pointerdown', 75, 25)
    pointer(board, 'pointermove', 75, 75)
    pointer(board, 'pointerup', 75, 75)
    const ids = audio.sfx.map((e) => e.id)
    expect(ids).toEqual(['start', 'connect', 'start', 'solve'])
    expect(audio.ducks).toEqual([3500])
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('star sounds are staggered, one per earned star', async () => {
    const { audio, board } = openLevel1()
    audio.sfx.length = 0
    pointer(board, 'pointerdown', 25, 25)
    pointer(board, 'pointermove', 25, 75)
    pointer(board, 'pointerup', 25, 75)
    pointer(board, 'pointerdown', 75, 25)
    pointer(board, 'pointermove', 75, 75)
    pointer(board, 'pointerup', 75, 75)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900))
    })
    const stars = audio.sfx.filter((e) => e.id === 'star')
    expect(stars.map((e) => e.rate)).toEqual([1, 1.12, 1.24])
  })
  it('Next level plays the next sound, not click', () => {
    const { audio, board } = openLevel1()
    pointer(board, 'pointerdown', 25, 25)
    pointer(board, 'pointermove', 25, 75)
    pointer(board, 'pointerup', 25, 75)
    pointer(board, 'pointerdown', 75, 25)
    pointer(board, 'pointermove', 75, 75)
    pointer(board, 'pointerup', 75, 75)
    audio.sfx.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Next level' }))
    expect(audio.sfx.map((e) => e.id)).toEqual(['next'])
  })
  it('unmounting the dialog before the stars finish cancels the pending sounds', async () => {
    const { audio, board } = openLevel1()
    pointer(board, 'pointerdown', 25, 25)
    pointer(board, 'pointermove', 25, 75)
    pointer(board, 'pointerup', 25, 75)
    pointer(board, 'pointerdown', 75, 25)
    pointer(board, 'pointermove', 75, 75)
    pointer(board, 'pointerup', 75, 75)
    fireEvent.click(screen.getByRole('button', { name: 'Levels' }))
    audio.sfx.length = 0
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900))
    })
    expect(audio.sfx.filter((e) => e.id === 'star')).toHaveLength(0)
  })
})
