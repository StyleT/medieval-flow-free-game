import type { Level } from '../engine/types.ts'

export type ProfileId = string
export type LevelId = Level['id']

export type Attempt = {
  stars: 1 | 2 | 3
  moves: number
  hintsUsed: number // 0..3
  durationMs: number
  at: number // epoch ms
}

export type LevelRecord = {
  firstClear: Attempt // frozen forever; the only input to total score
  best: Attempt // most stars, then fewest moves, then fewest hints
  completions: number
  lastPlayedAt: number
}

/** One finished run of an endless puzzle: no stars. */
export type RunResult = {
  moves: number
  hintsUsed: number // 0..3
  durationMs: number
  at: number // epoch ms
}

/** An endless puzzle, stored when it is generated. Unsolved ones have no runs yet. */
export type GeneratedEntry = {
  id: string
  rows: number
  cols: number
  flows: number
  grid: string[]
  createdAt: number
  completions: number // 0 until first solved
  best: RunResult | null
  last: RunResult | null
}

export const MAX_GENERATED = 50

export type Profile = {
  id: ProfileId
  name: string
  createdAt: number
  levels: Record<LevelId, LevelRecord> // only levels completed at least once
  generated: GeneratedEntry[] // endless puzzles, most recent first, at most MAX_GENERATED
}

export type SaveFile = {
  version: 2
  activeProfileId: ProfileId | null
  profileOrder: ProfileId[] // most recently used first
  profiles: Record<ProfileId, Profile>
}

export const SAVE_KEY = 'flow.save.v2'
export const CORRUPT_KEY = 'flow.save.v2.corrupt'
export const LEGACY_SAVE_KEY = 'flow.save.v1'
export const MAX_NAME_LENGTH = 16
