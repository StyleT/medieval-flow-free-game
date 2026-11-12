// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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
