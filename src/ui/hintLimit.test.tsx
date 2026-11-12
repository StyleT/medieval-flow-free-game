// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { parseLevel } from '../engine/levels.ts'
import { PlayScreen } from './screens/PlayScreen.tsx'

afterEach(cleanup)

// 4 one-column flows of 3 cells: each hint fixes one flow, so 3 hints leave 1 unsolved.
const level = parseLevel({ id: 'h', name: 'H' }, ['ABCD', 'ABCD', 'ABCD'])

it('Hint is disabled after the 3rd hint, with the level still unsolved', () => {
  render(<PlayScreen level={level} now={() => 0} onBack={() => {}} onSolved={() => {}} />)
  const hint = screen.getByRole('button', { name: 'Hint' }) as HTMLButtonElement
  for (let i = 0; i < 3; i++) fireEvent.click(hint)
  expect(hint.disabled).toBe(true)
  expect(screen.getByTestId('hints-left').textContent).toBe('Hints left: 0')
})

it('Hint is disabled once the level is solved', () => {
  const tiny = parseLevel({ id: 't', name: 'T' }, ['AB', 'AB'])
  let solved = 0
  render(<PlayScreen level={tiny} now={() => 0} onBack={() => {}} onSolved={() => solved++} />)
  const hint = screen.getByRole('button', { name: 'Hint' }) as HTMLButtonElement
  fireEvent.click(hint)
  fireEvent.click(hint)
  expect(hint.disabled).toBe(true)
  expect(solved).toBe(1)
})

it('header keeps the moves and hints text, side by side in one plate', () => {
  render(<PlayScreen level={level} now={() => 0} onBack={() => {}} onSolved={() => {}} />)
  const moves = screen.getByTestId('moves')
  const hints = screen.getByTestId('hints-left')
  expect(moves.textContent).toBe(`0 / ${level.optimalMoves}`)
  expect(hints.textContent).toBe('Hints left: 3')
  expect(moves.parentElement).toBe(hints.parentElement)
  expect(moves.parentElement?.className).toContain('px-panel-dark')
  expect(moves.parentElement?.className).toContain('whitespace-nowrap')
})

it('Back and the title never wrap or shrink into the plate', () => {
  render(<PlayScreen level={level} now={() => 0} onBack={() => {}} onSolved={() => {}} />)
  expect(screen.getByRole('button', { name: 'Back' }).className).toContain('px-btn')
  const title = screen.getByRole('heading', { name: 'H' })
  expect(title.className).toContain('truncate')
  expect(title.parentElement?.className).toContain('flex-wrap')
})
