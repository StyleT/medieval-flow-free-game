// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AudioPlayer } from '../audio/audioEngine.ts'
import { SoundProvider } from '../audio/SoundProvider.tsx'
import { noopPlayer } from '../audio/audioEngine.ts'
import { SoundToggle } from './SoundToggle.tsx'

afterEach(cleanup)
const view = () => render(<SoundProvider player={noopPlayer} storage={null}><SoundToggle /></SoundProvider>)

describe('SoundToggle', () => {
  it('shows the speaker image inside a content-sized button (no fixed 44px box that crushes the frame)', () => {
    view()
    const button = screen.getByRole('button', { name: 'Sound settings' })
    expect(button.className).not.toMatch(/\bh-11\b|\bw-11\b/)
    expect(button.className).toContain('sound-toggle-btn')
    const img = button.querySelector('img')
    expect(img?.getAttribute('src')).toContain('speaker_on')
    expect(img?.getAttribute('aria-hidden')).toBe('true')
  })
  it('lives in the floating container', () => {
    const { container } = view()
    expect(container.querySelector('.sound-toggle')).not.toBeNull()
  })
  it('opens the menu and toggles music and sound effects by name', () => {
    view()
    const button = screen.getByRole('button', { name: 'Sound settings' })
    expect(screen.queryByRole('switch', { name: /Music/ })).toBeNull()
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const music = screen.getByRole('switch', { name: /Music/ })
    const sfx = screen.getByRole('switch', { name: /Sound effects/ })
    expect(music.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(music)
    expect(music.getAttribute('aria-checked')).toBe('false')
    expect(sfx.getAttribute('aria-checked')).toBe('true')
    expect(button.querySelector('img')?.getAttribute('src')).toContain('speaker_on')
    fireEvent.click(sfx)
    expect(button.querySelector('img')?.getAttribute('src')).toContain('speaker_off')
  })
  it('closes on Escape and on an outside press, and ignores presses inside', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }))
    fireEvent.pointerDown(screen.getByRole('switch', { name: /Music/ }))
    expect(screen.queryByRole('switch', { name: /Music/ })).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('switch', { name: /Music/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sound settings' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('switch', { name: /Music/ })).toBeNull()
  })
})

/** A player whose lock state the test flips by hand. */
function lockablePlayer(initial: boolean) {
  let locked = initial
  const listeners = new Set<() => void>()
  const player: AudioPlayer = {
    ...noopPlayer,
    isLocked: () => locked,
    onLockChange: (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
  const setLocked = (v: boolean) => act(() => {
    locked = v
    listeners.forEach((l) => l())
  })
  return { player, setLocked }
}

const storageWith = (value: object): Storage => {
  const m = new Map([['flow.audio.v1', JSON.stringify(value)]])
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage
}

describe('SoundToggle unlock hint', () => {
  const hint = () => screen.queryByRole('status')
  const button = () => screen.getByRole('button', { name: 'Sound settings' })

  it('shows "Tap to enable sound" and pulses the button while audio is locked', () => {
    const { player } = lockablePlayer(true)
    render(<SoundProvider player={player} storage={null}><SoundToggle /></SoundProvider>)
    expect(hint()?.textContent).toBe('Tap to enable sound')
    expect(button().className).toContain('sound-toggle-btn--locked')
  })
  it('hides the hint and stops pulsing once audio unlocks, and brings it back on a new lock', () => {
    const { player, setLocked } = lockablePlayer(true)
    render(<SoundProvider player={player} storage={null}><SoundToggle /></SoundProvider>)
    setLocked(false)
    expect(hint()).toBeNull()
    expect(button().className).not.toContain('sound-toggle-btn--locked')
    setLocked(true)
    expect(hint()).not.toBeNull()
  })
  it('shows nothing when audio is already unlocked', () => {
    view()
    expect(hint()).toBeNull()
    expect(button().className).not.toContain('sound-toggle-btn--locked')
  })
  it('shows nothing when music and sound effects are both off', () => {
    const { player } = lockablePlayer(true)
    render(<SoundProvider player={player} storage={storageWith({ music: false, sfx: false })}><SoundToggle /></SoundProvider>)
    expect(hint()).toBeNull()
    expect(button().className).not.toContain('sound-toggle-btn--locked')
  })
  it('still shows the hint when only one of music or sound effects is on', () => {
    const { player } = lockablePlayer(true)
    render(<SoundProvider player={player} storage={storageWith({ music: false, sfx: true })}><SoundToggle /></SoundProvider>)
    expect(hint()).not.toBeNull()
  })
  it('hides the note while the menu is open, so it never overlaps it', () => {
    const { player } = lockablePlayer(true)
    render(<SoundProvider player={player} storage={null}><SoundToggle /></SoundProvider>)
    fireEvent.click(button())
    expect(hint()).toBeNull()
  })
})
