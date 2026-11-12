// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseLevel } from '../../engine/levels.ts'
import type { Attempt, Profile } from '../../profile/types.ts'
import { LevelMap } from './LevelMap.tsx'

afterEach(cleanup)

const levels = [1, 2, 3].map((n) => parseLevel({ id: `L${n}`, name: `Level ${n}` }, ['AB', 'AB']))
const attempt = (stars: 1 | 2 | 3): Attempt => ({ stars, moves: 2, hintsUsed: 0, durationMs: 1, at: 1 })
const profileWith = (cleared: Record<string, 1 | 2 | 3>): Profile =>
  ({
    id: 'p', name: 'Ann', createdAt: 0, generated: [],
    levels: Object.fromEntries(
      Object.entries(cleared).map(([id, s]) => [id, { firstClear: attempt(s), best: attempt(s), completions: 1, lastPlayedAt: 1 }]),
    ),
  }) as unknown as Profile

const renderMap = (profile: Profile, onPlay = vi.fn(), onStats = vi.fn()) => {
  render(<LevelMap profile={profile} levels={levels} onPlay={onPlay} onStats={onStats} />)
  return { onPlay, onStats }
}

describe('LevelMap', () => {
  it('keeps the old accessible names: locked levels say (locked)', () => {
    renderMap(profileWith({}))
    expect((screen.getByRole('button', { name: 'Level 1' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Level 2 (locked)' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Level 3 (locked)' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('plays an unlocked level on click', () => {
    const { onPlay } = renderMap(profileWith({}))
    fireEvent.click(screen.getByRole('button', { name: 'Level 1' }))
    expect(onPlay).toHaveBeenCalledWith('L1')
  })
  it('does nothing when a locked node is clicked', () => {
    const { onPlay } = renderMap(profileWith({}))
    fireEvent.click(screen.getByRole('button', { name: 'Level 2 (locked)' }))
    expect(onPlay).not.toHaveBeenCalled()
  })
  it('unlocks the next level after a clear and shows the stars as screen-reader text', () => {
    renderMap(profileWith({ L1: 3 }))
    expect((screen.getByRole('button', { name: 'Level 2' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('★★★')).toBeTruthy()
    expect(screen.getByText('★★★').closest('.level-map-plate')).not.toBeNull()
  })
  it('offers Stats only for cleared levels, with the old name', () => {
    const { onStats } = renderMap(profileWith({ L1: 2 }))
    expect(screen.queryByRole('button', { name: 'Stats for Level 2' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stats for Level 1' }))
    expect(onStats).toHaveBeenCalledWith('L1')
  })
  it('marks the next uncleared level as the current step and none when all are cleared', () => {
    renderMap(profileWith({ L1: 1 }))
    expect(screen.getByRole('button', { name: 'Level 2' }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('button', { name: 'Level 1' }).getAttribute('aria-current')).toBeNull()
    cleanup()
    renderMap(profileWith({ L1: 1, L2: 1, L3: 1 }))
    expect(document.querySelector('[aria-current="step"]')).toBeNull()
  })
  it('scrolls the current node into view on mount, tolerating missing scrollIntoView', () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    renderMap(profileWith({}))
    expect(spy).toHaveBeenCalledWith({ block: 'center' })
    // @ts-expect-error jsdom has none by default
    delete Element.prototype.scrollIntoView
    expect(() => renderMap(profileWith({}))).not.toThrow()
  })
  it('puts every caption in its own plate, outside the castle button', () => {
    renderMap(profileWith({ L1: 1 }))
    const plates = document.querySelectorAll('.level-map-plate')
    expect(plates).toHaveLength(3)
    for (const caption of screen.getAllByText('2×2 · 2 flows')) {
      expect(caption.closest('.level-map-plate')).not.toBeNull()
      expect(caption.closest('button')).toBeNull()
    }
  })
  it('shows a lock instead of crowns on locked plates', () => {
    renderMap(profileWith({}))
    const plates = [...document.querySelectorAll('.level-map-plate')]
    expect(plates[0].textContent).toContain('☆☆☆')
    expect(plates[1].querySelector('img[src$="lock.png"]')).not.toBeNull()
    expect(plates[1].textContent).not.toMatch(/[★☆]/)
  })
  it('shows each level caption', () => {
    renderMap(profileWith({}))
    expect(screen.getAllByText('2×2 · 2 flows')).toHaveLength(3)
  })
})

describe('LevelMap fits its column', () => {
  const style = (el: Element) => (el as HTMLElement).style
  const widthOf = () => {
    const map = screen.getByTestId('level-map')
    return style(map).width
  }
  const withColumn = (clientWidth: number) => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth })
  }
  afterEach(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
  })

  it('uses the full width in a wide column', () => {
    withColumn(900)
    renderMap(profileWith({}))
    expect(widthOf()).toBe('calc(160 * var(--px))')
  })
  it('shrinks to fit a phone-width column', () => {
    withColumn(361)
    renderMap(profileWith({}))
    const artPx = Number(/calc\((\d+) \*/.exec(widthOf())?.[1])
    expect(artPx).toBeLessThan(160)
    expect(artPx * 3 + 6).toBeLessThanOrEqual(361)
  })
  it('never goes below the minimum, even in a tiny column', () => {
    withColumn(50)
    renderMap(profileWith({}))
    expect(widthOf()).toBe('calc(96 * var(--px))')
  })
  it('keeps every node, plate and Stats button when narrowed', () => {
    withColumn(361)
    renderMap(profileWith({ L1: 2 }))
    expect(screen.getAllByRole('button', { name: /^Level / })).toHaveLength(3)
    expect(document.querySelectorAll('.level-map-plate')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Stats for Level 1' })).toBeTruthy()
  })
  it('keeps nodes inside the narrowed map', () => {
    withColumn(361)
    renderMap(profileWith({}))
    const map = Number(/calc\((\d+) \*/.exec(widthOf())?.[1])
    for (const li of document.querySelectorAll('.level-map-node')) {
      const left = Number(/calc\((-?[\d.]+) \*/.exec(style(li).left)?.[1])
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + 32).toBeLessThanOrEqual(map)
    }
  })
})
