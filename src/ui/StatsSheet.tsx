import type { Level } from '../engine/types.ts'
import type { LevelRecord } from '../profile/types.ts'
import { Dialog } from './Dialog.tsx'
import { describeAttempt, formatDate } from './format.ts'

export function StatsSheet({
  level,
  record,
  onClose,
}: {
  level: Level
  record: LevelRecord
  onClose: () => void
}) {
  return (
    <Dialog title={`${level.name} stats`} onClose={onClose}>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted">First clear</dt>
          <dd>
            {describeAttempt(record.firstClear)} · {formatDate(record.firstClear.at)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Best run</dt>
          <dd>{describeAttempt(record.best)}</dd>
        </div>
        <div>
          <dt className="text-muted">Completions</dt>
          <dd>{record.completions}</dd>
        </div>
        <div>
          <dt className="text-muted">Last played</dt>
          <dd>{formatDate(record.lastPlayedAt)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">Replays don't change your score.</p>
      <button className="px-btn px-btn--gold mt-4 w-full" onClick={onClose}>
        Close
      </button>
    </Dialog>
  )
}
