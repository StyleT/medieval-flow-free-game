import type { Attempt } from '../profile/types.ts'

export const starText = (stars: number): string => '★'.repeat(stars) + '☆'.repeat(3 - stars)

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export const formatDate = (at: number): string => new Date(at).toISOString().slice(0, 10)

export const describeAttempt = (a: Attempt): string =>
  `${starText(a.stars)} · ${a.moves} moves · ${a.hintsUsed} hints · ${formatDuration(a.durationMs)}`
