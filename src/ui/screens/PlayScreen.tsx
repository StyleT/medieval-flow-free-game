import { useEffect, useReducer, useRef } from 'react'
import { createGame, isSolved } from '../../engine/game.ts'
import { MAX_HINTS } from '../../engine/types.ts'
import type { Level } from '../../engine/types.ts'
import { starsFor } from '../../engine/scoring.ts'
import type { Attempt } from '../../profile/types.ts'
import { useSound } from '../../audio/SoundProvider.tsx'
import { soundEventsFor } from '../../audio/soundEvents.ts'
import { Board } from '../Board.tsx'
import { gameReducer } from '../gameReducer.ts'
import { PixelIcon } from '../pixel/PixelIcon.tsx'

export function PlayScreen({
  level,
  now,
  onBack,
  onSolved,
}: {
  level: Level
  now: () => number
  onBack: () => void
  onSolved: (attempt: Attempt) => void
}) {
  const [state, dispatch] = useReducer(gameReducer, level, createGame)
  const { player, play } = useSound()
  const prevState = useRef(state)
  const startedAt = useRef<number | null>(null)
  const reported = useRef(false)

  // Time starts at the first drag or hint.
  const touched = state.active !== null || state.moves > 0 || state.hintsUsed > 0
  if (touched && startedAt.current === null) startedAt.current = now()

  const solved = isSolved(state) && state.active === null
  useEffect(() => {
    if (!solved || reported.current) return
    reported.current = true
    const stars = starsFor(state)
    if (stars === 0) return
    const at = now()
    onSolved({
      stars,
      moves: state.moves,
      hintsUsed: state.hintsUsed,
      durationMs: Math.max(0, at - (startedAt.current ?? at)),
      at,
    })
  }, [solved, state, now, onSolved])

  // Sounds come from diffing consecutive game states.
  useEffect(() => {
    const event = soundEventsFor(prevState.current, state)
    prevState.current = state
    if (event) player.playSfx(event)
  }, [state, player])

  useEffect(() => {
    if (solved) player.duckMusic(3500)
  }, [solved, player])

  const hintsLeft = MAX_HINTS - state.hintsUsed
  const reset = () => {
    reported.current = false
    startedAt.current = null
    play('reset')
    dispatch({ type: 'reset' })
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(max(1rem,env(safe-area-inset-bottom))+var(--dock))]">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:pr-16">
        <button className="px-btn inline-flex items-center gap-1" onClick={onBack}>
          <PixelIcon name="arrow_back" scale={2} />
          Back
        </button>
        <h1 className="px-banner min-w-0 flex-1 truncate px-2 text-center font-bold">{level.name}</h1>
        <div className="px-panel-dark flex w-full items-baseline justify-between gap-3 px-2 text-sm whitespace-nowrap sm:w-auto">
          <div data-testid="moves">
            {state.moves} / {level.optimalMoves}
          </div>
          <div data-testid="hints-left" className="text-muted">
            Hints left: {hintsLeft}
          </div>
        </div>
      </header>
      <Board state={state} dispatch={dispatch} />
      <footer className="flex gap-2">
        <button
          data-sfx="none"
          className="px-btn px-btn--gold inline-flex flex-1 items-center justify-center gap-2"
          disabled={hintsLeft === 0 || isSolved(state)}
          onClick={() => dispatch({ type: 'hint' })}
        >
          <PixelIcon name="scroll" scale={2} />
          Hint
        </button>
        <button data-sfx="none" className="px-btn inline-flex flex-1 items-center justify-center gap-2" onClick={reset}>
          <PixelIcon name="hourglass" scale={2} />
          Reset
        </button>
      </footer>
    </main>
  )
}
