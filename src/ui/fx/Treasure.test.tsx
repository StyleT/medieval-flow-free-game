// @vitest-environment jsdom
/// <reference types="node" />
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Treasure } from './Treasure.tsx'
import { CompletionDialog } from '../CompletionDialog.tsx'
import { FreeplayDialog } from '../FreeplayDialog.tsx'
import { SoundProvider } from '../../audio/SoundProvider.tsx'
import { noopPlayer } from '../../audio/audioEngine.ts'
import { readFileSync } from 'node:fs'

afterEach(cleanup)

describe('Treasure', () => {
  it('is decorative: aria-hidden, one chest and ten coins', () => {
    const { container } = render(<Treasure seed={1} />)
    expect(screen.getByTestId('treasure').getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('[data-sprite="chest"]')).toHaveLength(1)
    expect(screen.getAllByTestId('coin')).toHaveLength(10)
  })
  it('gives the same coin throws for the same seed', () => {
    const throws = () => screen.getAllByTestId('coin').map((c) => (c as HTMLElement).style.getPropertyValue('--dx'))
    render(<Treasure seed={5} />)
    const a = throws()
    cleanup()
    render(<Treasure seed={5} />)
    expect(throws()).toEqual(a)
  })
  it('reduced motion hides coins and shows the open chest', () => {
    const css = readFileSync('src/styles/pixel-ui.css', 'utf8')
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.treasure-coin \{\s*display: none/)
    expect(css).toMatch(/\.treasure-chest \{\s*background-position-x: calc\(-5 \*/)
  })
})

const wrap = (ui: React.ReactElement) => render(<SoundProvider player={noopPlayer} storage={null}>{ui}</SoundProvider>)

describe('dialogs', () => {
  const attempt = { stars: 2 as const, moves: 3, hintsUsed: 1, durationMs: 5000, at: 9 }
  it('CompletionDialog shows the chest, crowns and the ★ text', () => {
    wrap(<CompletionDialog info={{ attempt, firstClear: true, firstClearStars: 2, total: 2, maxTotal: 45, canGoNext: true }} onNext={() => {}} onReplay={() => {}} onLevels={() => {}} />)
    expect(screen.getByTestId('treasure')).toBeTruthy()
    expect(screen.getByText('First clear! +2 ★')).toBeTruthy()
    expect(screen.getByText('★★☆')).toBeTruthy()
  })
  it('FreeplayDialog shows the chest but no star text', () => {
    const run = { moves: 3, hintsUsed: 0, durationMs: 1000, at: 1 }
    const entry = { id: 'g', rows: 6, cols: 6, flows: 5, grid: [], completions: 1, best: run, last: run }
    wrap(<FreeplayDialog info={{ result: run, best: run, entry: entry as never, optimal: 5, newBest: true, stored: true }} generating={false} onNew={() => {}} onReplay={() => {}} onLevels={() => {}} />)
    expect(screen.getByTestId('treasure')).toBeTruthy()
    expect(screen.getByText('New personal best!')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/[★☆]/)
  })
})
