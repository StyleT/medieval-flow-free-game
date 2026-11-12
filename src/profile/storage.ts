import { emptySave } from './profiles.ts'
import { CORRUPT_KEY, LEGACY_SAVE_KEY, MAX_GENERATED, SAVE_KEY } from './types.ts'
import type { Attempt, GeneratedEntry, LevelRecord, Profile, RunResult, SaveFile } from './types.ts'

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

const isCount = (x: unknown, min: number, max = Infinity): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max

function isAttempt(x: unknown): x is Attempt {
  return (
    isObject(x) &&
    isCount(x.stars, 1, 3) &&
    isCount(x.moves, 0) &&
    isCount(x.hintsUsed, 0, 3) &&
    typeof x.durationMs === 'number' &&
    x.durationMs >= 0 &&
    typeof x.at === 'number'
  )
}

function isLevelRecord(x: unknown): x is LevelRecord {
  return (
    isObject(x) &&
    isAttempt(x.firstClear) &&
    isAttempt(x.best) &&
    isCount(x.completions, 1) &&
    typeof x.lastPlayedAt === 'number'
  )
}

function isRunResult(x: unknown): x is RunResult {
  return (
    isObject(x) &&
    isCount(x.moves, 0) &&
    isCount(x.hintsUsed, 0, 3) &&
    typeof x.durationMs === 'number' &&
    x.durationMs >= 0 &&
    typeof x.at === 'number'
  )
}

/** Structure only: a bad grid is hidden at play time by `generatedLevel`. */
export function isGeneratedEntry(x: unknown): x is GeneratedEntry {
  return (
    isObject(x) &&
    typeof x.id === 'string' &&
    isCount(x.rows, 2) &&
    isCount(x.cols, 2) &&
    isCount(x.flows, 1) &&
    Array.isArray(x.grid) &&
    x.grid.length === x.rows &&
    x.grid.every((line) => typeof line === 'string' && line.length === x.cols) &&
    typeof x.createdAt === 'number' &&
    isCount(x.completions, 0) &&
    (x.best === null || isRunResult(x.best)) &&
    (x.last === null || isRunResult(x.last))
  )
}

function isProfile(x: unknown, key: string): x is Profile {
  return (
    isObject(x) &&
    x.id === key &&
    typeof x.name === 'string' &&
    typeof x.createdAt === 'number' &&
    isObject(x.levels) &&
    Object.values(x.levels).every(isLevelRecord) &&
    Array.isArray(x.generated) &&
    x.generated.length <= MAX_GENERATED &&
    x.generated.every(isGeneratedEntry)
  )
}

/** Structural guard. Dangling ids are rejected; see `loadSave` for how they are repaired. */
export function isSaveFile(x: unknown): x is SaveFile {
  if (!isObject(x) || x.version !== 2) return false
  if (!isObject(x.profiles) || !Array.isArray(x.profileOrder)) return false
  const profiles = x.profiles
  const ids = Object.keys(profiles)
  if (!ids.every((id) => isProfile(profiles[id], id))) return false
  if (!x.profileOrder.every((id) => typeof id === 'string' && id in profiles)) return false
  if (new Set(x.profileOrder).size !== x.profileOrder.length) return false
  return x.activeProfileId === null || (typeof x.activeProfileId === 'string' && x.activeProfileId in profiles)
}

/** A v1 save has no `generated` list; everything else carries over. */
export function migrateV1(x: unknown): SaveFile | null {
  if (!isObject(x) || x.version !== 1 || !isObject(x.profiles)) return null
  const profiles = Object.fromEntries(
    Object.entries(x.profiles).map(([id, p]) => [id, isObject(p) ? { ...p, generated: [] } : p]),
  )
  const migrated = { ...x, version: 2, profiles }
  return isSaveFile(migrated) ? migrated : null
}

function readKey(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * v2 key → that save. No v2 key but a v1 save → migrated, written as v2 (the v1 key is left alone).
 * Missing → empty. Bad JSON or shape → raw copied to the corrupt key, empty save returned.
 */
export function loadSave(storage: Storage | null): SaveFile {
  if (storage === null) return emptySave()
  const raw = readKey(storage, SAVE_KEY)
  if (raw === null) return loadLegacy(storage)

  const parsed = parse(raw)
  if (isSaveFile(parsed)) return parsed
  quarantine(storage, raw)
  return emptySave()
}

function loadLegacy(storage: Storage): SaveFile {
  const legacy = readKey(storage, LEGACY_SAVE_KEY)
  if (legacy === null) return emptySave()
  const migrated = migrateV1(parse(legacy))
  if (migrated === null) return emptySave()
  writeSave(storage, migrated)
  return migrated
}

function quarantine(storage: Storage, raw: string): void {
  try {
    storage.setItem(CORRUPT_KEY, raw)
  } catch {
    // nothing more we can do
  }
}

/** False when storage is missing, disabled or full. */
export function writeSave(storage: Storage | null, save: SaveFile): boolean {
  if (storage === null) return false
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
