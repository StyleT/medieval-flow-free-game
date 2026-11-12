// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame } from '../engine/game.ts'
import { parseLevel } from '../engine/levels.ts'
import type { GameState } from '../engine/types.ts'
import { Board } from './Board.tsx'
import { FX_MS } from './fx/useConnectFx.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const open = parseLevel({ id: 'o', name: 'O' }, ['AB', 'AB'])
const walled = parseLevel({ id: 'w', name: 'W' }, ['A#B', 'ABB'])
const noop = () => {}

const withPath = (s: GameState, color: string, cells: GameState['paths'][string]): GameState => ({
  ...s,
  paths: { ...s.paths, [color]: cells },
})

describe('Board art', () => {
  it('renders no blocked sprites when the level has none', () => {
    render(<Board state={createGame(open)} dispatch={noop} />)
    expect(screen.queryAllByTestId('block')).toHaveLength(0)
  })
  it('renders one block sprite per blocked cell', () => {
    expect(walled.blocked.length).toBeGreaterThan(0)
    render(<Board state={createGame(walled)} dispatch={noop} />)
    expect(screen.getAllByTestId('block')).toHaveLength(walled.blocked.length)
  })
  it('draws each endpoint as a rect filled with its gem pattern', () => {
    const { container } = render(<Board state={createGame(open)} dispatch={noop} />)
    const ends = screen.getAllByTestId('end-A')
    expect(ends).toHaveLength(2)
    for (const e of ends) {
      expect(e.tagName.toLowerCase()).toBe('rect')
      expect(e.getAttribute('fill')).toBe('url(#board-gem-A)')
    }
    const pattern = container.querySelector('pattern#board-gem-A')
    expect(pattern?.querySelector('image')?.getAttribute('href')).toBe('/art/sprites/gem_A.png')
  })
  it('defines one gem pattern per flow color and nothing more', () => {
    const { container } = render(<Board state={createGame(open)} dispatch={noop} />)
    const ids = [...container.querySelectorAll('pattern[id^="board-gem-"]')].map((p) => p.id)
    expect(ids).toEqual(['board-gem-A', 'board-gem-B'])
  })
  it('fills blocked cells from the block pattern, defined only when the level has blocks', () => {
    const { container, unmount } = render(<Board state={createGame(walled)} dispatch={noop} />)
    expect(screen.getByTestId('block').getAttribute('fill')).toBe('url(#board-block)')
    expect(container.querySelector('pattern#board-block image')?.getAttribute('href')).toBe('/art/sprites/block.png')
    unmount()
    const other = render(<Board state={createGame(open)} dispatch={noop} />)
    expect(other.container.querySelector('pattern#board-block')).toBeNull()
  })
  it('never draws a board sprite as a bare <image> (WebKit blurs those)', () => {
    const { container } = render(<Board state={createGame(walled)} dispatch={noop} />)
    const bare = [...container.querySelectorAll('image')].filter((i) => !i.closest('pattern'))
    expect(bare).toHaveLength(0)
  })
  it('keeps the pipe testid on the main polyline only, points unchanged', () => {
    const state = withPath(createGame(open), 'A', [{ row: 0, col: 0 }, { row: 1, col: 0 }])
    const { container } = render(<Board state={state} dispatch={noop} />)
    expect(screen.getAllByTestId('pipe-A')).toHaveLength(1)
    expect(screen.getByTestId('pipe-A').getAttribute('points')).toBe('0.5,0.5 0.5,1.5')
    const all = container.querySelectorAll('polyline')
    expect(all).toHaveLength(4)
    expect([...all].filter((p) => p.hasAttribute('data-testid'))).toHaveLength(1)
    expect(new Set([...all].map((p) => p.getAttribute('points'))).size).toBe(1)
  })
  it('draws no pipe for a single-cell path', () => {
    const state = withPath(createGame(open), 'A', [{ row: 0, col: 0 }])
    const { container } = render(<Board state={state} dispatch={noop} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
  })
})

describe('connect sparkle', () => {
  const connected = (s: GameState) => withPath(s, 'A', open.solution.A)

  it('is absent before a connection', () => {
    render(<Board state={createGame(open)} dispatch={noop} />)
    expect(screen.queryAllByTestId('sparkle')).toHaveLength(0)
  })
  it('shows at both endpoints after connecting, then expires', () => {
    const base = createGame(open)
    const { rerender } = render(<Board state={base} dispatch={noop} />)
    rerender(<Board state={connected(base)} dispatch={noop} />)
    expect(screen.getAllByTestId('sparkle')).toHaveLength(2)
    act(() => void vi.advanceTimersByTime(FX_MS + 1))
    expect(screen.queryAllByTestId('sparkle')).toHaveLength(0)
  })
  it('is cleared at once when the connection is backtracked', () => {
    const base = createGame(open)
    const { rerender } = render(<Board state={base} dispatch={noop} />)
    rerender(<Board state={connected(base)} dispatch={noop} />)
    rerender(<Board state={withPath(base, 'A', [open.solution.A[0], open.solution.A[1] ?? open.solution.A[0]].slice(0, 1))} dispatch={noop} />)
    expect(screen.queryAllByTestId('sparkle')).toHaveLength(0)
  })
  it('does not replay for a board that starts already connected', () => {
    render(<Board state={connected(createGame(open))} dispatch={noop} />)
    expect(screen.queryAllByTestId('sparkle')).toHaveLength(0)
  })
})
