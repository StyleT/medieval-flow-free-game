import type { GeneratedEntry, RunResult } from '../profile/types.ts'
import { Dialog } from './Dialog.tsx'
import { formatDuration } from './format.ts'
import { Treasure } from './fx/Treasure.tsx'

export type FreeplayInfo = {
  result: RunResult
  best: RunResult // this puzzle's best, including this run
  entry: GeneratedEntry
  optimal: number
  newBest: boolean
  stored: boolean // false when this run could not be written to storage
}

/** Endless puzzles give no stars: moves vs optimal, time, and this puzzle's own records. */
export function FreeplayDialog({
  info,
  generating,
  onNew,
  onReplay,
  onLevels,
}: {
  info: FreeplayInfo
  generating: boolean
  onNew: () => void
  onReplay: () => void
  onLevels: () => void
}) {
  const { result, entry, optimal } = info
  return (
    <Dialog title="Puzzle solved!" onClose={onLevels}>
      <Treasure seed={result.moves + result.durationMs} />
      <p className="text-center text-sm text-muted">
        {result.moves} moves · optimal {optimal} · {result.hintsUsed} hints · {formatDuration(result.durationMs)}
      </p>
      {info.newBest && <p className="px-banner mt-3 text-center font-semibold">New personal best!</p>}
      <p className="mt-3 text-center text-sm">
        Solved {entry.completions} {entry.completions === 1 ? 'time' : 'times'} · best {info.best.moves} moves,{' '}
        {formatDuration(info.best.durationMs)}
      </p>
      {!info.stored && (
        <p role="status" className="mt-2 text-center text-sm text-muted">
          This result won't be saved
        </p>
      )}
      <div className="mt-4 grid gap-2">
        <button className="px-btn px-btn--gold" disabled={generating} onClick={onNew}>
          {generating ? (
            <span role="status" className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="spinner" />
              Generating…
            </span>
          ) : (
            'New puzzle'
          )}
        </button>
        <button className="px-btn" onClick={onReplay}>
          Replay
        </button>
        <button className="px-btn" onClick={onLevels}>
          Levels
        </button>
      </div>
    </Dialog>
  )
}
