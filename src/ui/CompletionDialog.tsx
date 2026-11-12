import type { Attempt } from '../profile/types.ts'
import { useEffect } from 'react'
import { useSound } from '../audio/SoundProvider.tsx'
import { Dialog } from './Dialog.tsx'
import { formatDuration } from './format.ts'
import { Treasure } from './fx/Treasure.tsx'
import { CrownRow } from './pixel/CrownRow.tsx'

export type CompletionInfo = {
  attempt: Attempt
  firstClear: boolean
  firstClearStars: number
  total: number
  maxTotal: number
  canGoNext: boolean
}

export function CompletionDialog({
  info,
  onNext,
  onReplay,
  onLevels,
}: {
  info: CompletionInfo
  onNext: () => void
  onReplay: () => void
  onLevels: () => void
}) {
  const { attempt } = info
  const { player } = useSound()
  useEffect(() => {
    // Staggered to match the star-pop animation.
    const timers = Array.from({ length: attempt.stars }, (_, i) =>
      setTimeout(() => player.playSfx({ id: 'star', rate: 1 + i * 0.12 }), 250 + i * 250),
    )
    return () => timers.forEach(clearTimeout)
  }, [attempt.stars, player])
  return (
    <Dialog title="Level complete!" onClose={onLevels}>
      <Treasure seed={attempt.at} />
      <p className="text-center" aria-label={`${attempt.stars} stars`}>
        <CrownRow stars={attempt.stars} popClass="star-pop" />
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        {attempt.moves} moves · {attempt.hintsUsed} hints · {formatDuration(attempt.durationMs)}
      </p>
      <p className="mt-3 text-center font-semibold">
        {info.firstClear
          ? `First clear! +${attempt.stars} ★`
          : `Replay: score unchanged (first clear ${info.firstClearStars} ★)`}
      </p>
      <p className="text-center text-sm">
        Total score {info.total} / {info.maxTotal}
      </p>
      <div className="mt-4 grid gap-2">
        {info.canGoNext && (
          <button data-sfx="next" className="px-btn px-btn--gold" onClick={onNext}>
            Next level
          </button>
        )}
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
