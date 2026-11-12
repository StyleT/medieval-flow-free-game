import { useState } from 'react'
import { flowsFor } from '../../engine/levels.ts'
import { generatedLevel } from '../../profile/profiles.ts'
import type { GeneratedEntry } from '../../profile/types.ts'
import { formatDuration } from '../format.ts'

export const ENDLESS_SIZES = [6, 8, 10, 12, 15] as const

export function EndlessSection({
  generated,
  generating,
  error,
  onGenerate,
  onPlay,
  onDelete,
}: {
  generated: readonly GeneratedEntry[]
  generating: boolean
  error: string | null
  onGenerate: (size: number) => void
  onPlay: (entry: GeneratedEntry) => void
  onDelete: (id: string) => void
}) {
  const [size, setSize] = useState<number>(ENDLESS_SIZES[0])
  // A stored puzzle whose grid no longer parses is hidden, not shown broken.
  const playable = generated.filter((g) => generatedLevel(g) !== null)

  return (
    <section className="px-panel-dark mt-6" aria-labelledby="endless-title">
      <p aria-hidden="true" className="text-sm text-star">Dungeon of Endless Trials</p>
      <h2 id="endless-title" className="font-bold">
        Endless
      </h2>
      <p className="text-sm text-muted">Fresh puzzles, no stars. Sizes and flow counts grow with the board.</p>
      <div role="radiogroup" aria-label="Board size" className="mt-3 flex flex-wrap gap-2">
        {ENDLESS_SIZES.map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={size === n}
            disabled={generating}
            className="px-btn"
            onClick={() => setSize(n)}
          >
            {n}×{n}
          </button>
        ))}
      </div>
      <button
        className="px-btn px-btn--gold mt-3 w-full"
        disabled={generating}
        onClick={() => onGenerate(size)}
      >
        {generating ? (
          <span role="status" className="inline-flex items-center justify-center gap-2">
            <span aria-hidden="true" className="spinner" />
            Generating…
          </span>
        ) : (
          `Generate ${size}×${size} · ${flowsFor(size, size)} flows`
        )}
      </button>
      {error !== null && (
        <p role="alert" className="mt-2 text-sm text-muted">
          {error}
        </p>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer">Auto-generated ({playable.length})</summary>
        <ul className="mt-2 grid gap-2">
          {playable.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 p-2">
              <div className="text-sm">
                <div className="font-semibold">
                  {g.rows}×{g.cols} · {g.flows} flows
                </div>
                <div className="text-muted">
                  {g.best === null
                    ? 'Not solved yet'
                    : `Solved ${g.completions}× · best ${g.best.moves}/${g.flows} moves · ${formatDuration(g.best.durationMs)}`}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-btn px-btn--gold" aria-label={`Play ${g.rows}×${g.cols} puzzle ${g.id}`} onClick={() => onPlay(g)}>
                  Play
                </button>
                <button className="px-btn" aria-label={`Delete ${g.rows}×${g.cols} puzzle ${g.id}`} onClick={() => onDelete(g.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
