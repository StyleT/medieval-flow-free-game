import type { Level } from '../engine/types.ts'
import { parseLevel } from '../engine/levels.ts'
import { MAX_GENERATED, MAX_NAME_LENGTH } from './types.ts'
import type { Attempt, GeneratedEntry, LevelId, Profile, ProfileId, RunResult, SaveFile } from './types.ts'

export type NameError = 'empty' | 'too-long' | 'taken'

export function emptySave(): SaveFile {
  return { version: 2, activeProfileId: null, profileOrder: [], profiles: {} }
}

export function validateName(
  save: SaveFile,
  raw: string,
): { ok: true; name: string } | { ok: false; error: NameError } {
  const name = raw.trim()
  if (name.length === 0) return { ok: false, error: 'empty' }
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: 'too-long' }
  const lower = name.toLowerCase()
  const taken = Object.values(save.profiles).some((p) => p.name.toLowerCase() === lower)
  return taken ? { ok: false, error: 'taken' } : { ok: true, name }
}

/** The new profile becomes the active one. */
export function createProfile(
  save: SaveFile,
  raw: string,
  now: number,
  id: ProfileId,
): { ok: true; save: SaveFile } | { ok: false; error: NameError } {
  const checked = validateName(save, raw)
  if (!checked.ok) return checked
  const profile: Profile = { id, name: checked.name, createdAt: now, levels: {}, generated: [] }
  return {
    ok: true,
    save: {
      ...save,
      activeProfileId: id,
      profileOrder: [id, ...save.profileOrder.filter((p) => p !== id)],
      profiles: { ...save.profiles, [id]: profile },
    },
  }
}

/** Unknown id → unchanged. Moves the id to the front of `profileOrder`. */
export function switchProfile(save: SaveFile, id: ProfileId): SaveFile {
  if (!(id in save.profiles)) return save
  return {
    ...save,
    activeProfileId: id,
    profileOrder: [id, ...save.profileOrder.filter((p) => p !== id)],
  }
}

export function deleteProfile(save: SaveFile, id: ProfileId): SaveFile {
  if (!(id in save.profiles)) return save
  const { [id]: _removed, ...profiles } = save.profiles
  return {
    ...save,
    activeProfileId: save.activeProfileId === id ? null : save.activeProfileId,
    profileOrder: save.profileOrder.filter((p) => p !== id),
    profiles,
  }
}

/** True when `a` is strictly better: more stars, then fewer moves, then fewer hints. */
export function isBetterAttempt(a: Attempt, b: Attempt): boolean {
  if (a.stars !== b.stars) return a.stars > b.stars
  if (a.moves !== b.moves) return a.moves < b.moves
  return a.hintsUsed < b.hintsUsed
}

/** Replays never touch `firstClear`, so total score is fixed at the first clear. */
export function recordCompletion(
  save: SaveFile,
  profileId: ProfileId,
  levelId: LevelId,
  attempt: Attempt,
): { save: SaveFile; firstClear: boolean } {
  const profile = save.profiles[profileId]
  if (profile === undefined) return { save, firstClear: false }

  const existing = profile.levels[levelId]
  const record = existing
    ? {
        firstClear: existing.firstClear,
        best: isBetterAttempt(attempt, existing.best) ? attempt : existing.best,
        completions: existing.completions + 1,
        lastPlayedAt: attempt.at,
      }
    : { firstClear: attempt, best: attempt, completions: 1, lastPlayedAt: attempt.at }

  const updated: Profile = { ...profile, levels: { ...profile.levels, [levelId]: record } }
  return {
    save: { ...save, profiles: { ...save.profiles, [profileId]: updated } },
    firstClear: existing === undefined,
  }
}

export function totalScore(profile: Profile): number {
  return Object.values(profile.levels).reduce((sum, r) => sum + r.firstClear.stars, 0)
}

/** Level 0 is always open; level n needs level n−1 completed. */
export function isUnlocked(profile: Profile, levels: readonly Level[], index: number): boolean {
  if (index <= 0) return true
  const previous = levels[index - 1]
  return previous !== undefined && previous.id in profile.levels
}

/** True when `a` is strictly better: fewer moves, then fewer hints, then less time. */
export function isBetterRun(a: RunResult, b: RunResult): boolean {
  if (a.moves !== b.moves) return a.moves < b.moves
  if (a.hintsUsed !== b.hintsUsed) return a.hintsUsed < b.hintsUsed
  return a.durationMs < b.durationMs
}

export type NewPuzzle = Pick<GeneratedEntry, 'id' | 'rows' | 'cols' | 'flows' | 'grid'>

/** Stores a freshly generated puzzle (unsolved) at the front; a known puzzle just moves to the front. */
export function addGenerated(save: SaveFile, profileId: ProfileId, puzzle: NewPuzzle, at: number): SaveFile {
  const profile = save.profiles[profileId]
  if (profile === undefined) return save
  const entry: GeneratedEntry = profile.generated.find((g) => g.id === puzzle.id) ?? {
    ...puzzle,
    createdAt: at,
    completions: 0,
    best: null,
    last: null,
  }
  const generated = [entry, ...profile.generated.filter((g) => g.id !== puzzle.id)].slice(0, MAX_GENERATED)
  return { ...save, profiles: { ...save.profiles, [profileId]: { ...profile, generated } } }
}

/**
 * A solve bumps `completions`, keeps the better `best` and sets `last`; the entry moves to the
 * front. A puzzle that was never stored is added first.
 */
export function recordGenerated(
  save: SaveFile,
  profileId: ProfileId,
  puzzle: NewPuzzle,
  result: RunResult,
): { save: SaveFile; entry: GeneratedEntry; best: RunResult; newBest: boolean } | null {
  const profile = save.profiles[profileId]
  if (profile === undefined) return null

  const stored = addGenerated(save, profileId, puzzle, result.at).profiles[profileId].generated[0]
  const previousBest = stored.best
  const best = previousBest !== null && !isBetterRun(result, previousBest) ? previousBest : result
  const entry: GeneratedEntry = { ...stored, completions: stored.completions + 1, best, last: result }
  const generated = [entry, ...profile.generated.filter((g) => g.id !== puzzle.id)].slice(0, MAX_GENERATED)
  return {
    save: { ...save, profiles: { ...save.profiles, [profileId]: { ...profile, generated } } },
    entry,
    best,
    newBest: previousBest !== null && best === result,
  }
}

/** Unknown profile or puzzle → unchanged. */
export function deleteGenerated(save: SaveFile, profileId: ProfileId, puzzleId: string): SaveFile {
  const profile = save.profiles[profileId]
  if (profile === undefined || !profile.generated.some((g) => g.id === puzzleId)) return save
  const updated: Profile = { ...profile, generated: profile.generated.filter((g) => g.id !== puzzleId) }
  return { ...save, profiles: { ...save.profiles, [profileId]: updated } }
}

/** The playable level of a stored puzzle, or null when its grid does not parse. */
export function generatedLevel(entry: GeneratedEntry): Level | null {
  try {
    return parseLevel({ id: entry.id, name: `${entry.rows}×${entry.cols}` }, entry.grid)
  } catch {
    return null
  }
}
