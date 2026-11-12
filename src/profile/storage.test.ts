import { describe, expect, it } from 'vitest'
import { FakeStorage, attempt } from '../test-utils.ts'
import { createProfile, emptySave, recordCompletion } from './profiles.ts'
import { isGeneratedEntry, isSaveFile, loadSave, migrateV1, writeSave } from './storage.ts'
import { CORRUPT_KEY, LEGACY_SAVE_KEY, SAVE_KEY } from './types.ts'

const sample = () => {
  const created = createProfile(emptySave(), 'Ann', 1, 'a')
  if (!created.ok) throw new Error('setup')
  return recordCompletion(created.save, 'a', 'L1', attempt()).save
}

describe('loadSave / writeSave', () => {
  it('round-trips a save', () => {
    const storage = new FakeStorage()
    expect(writeSave(storage, sample())).toBe(true)
    expect(loadSave(storage)).toEqual(sample())
  })
  it('missing key gives an empty save', () => {
    expect(loadSave(new FakeStorage())).toEqual(emptySave())
  })
  it('null storage gives an empty save and write returns false', () => {
    expect(loadSave(null)).toEqual(emptySave())
    expect(writeSave(null, sample())).toBe(false)
  })
  it('bad JSON is copied to the corrupt key and an empty save returned', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, '{nope')
    expect(loadSave(storage)).toEqual(emptySave())
    expect(storage.getItem(CORRUPT_KEY)).toBe('{nope')
  })
  it('a wrong shape is treated as corrupt', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 3 }))
    expect(loadSave(storage)).toEqual(emptySave())
    expect(storage.getItem(CORRUPT_KEY)).not.toBeNull()
  })
  it('survives storage throwing on read, and on write', () => {
    const storage = new FakeStorage()
    storage.throwOnGet = true
    expect(loadSave(storage)).toEqual(emptySave())
    const full = new FakeStorage()
    full.throwOnSet = true
    expect(writeSave(full, sample())).toBe(false)
  })
  it('survives the corrupt-copy write failing', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, 'garbage')
    storage.throwOnSet = true
    expect(loadSave(storage)).toEqual(emptySave())
  })
})

describe('isSaveFile', () => {
  it('accepts valid saves', () => {
    expect(isSaveFile(emptySave())).toBe(true)
    expect(isSaveFile(sample())).toBe(true)
  })
  it('rejects non-objects and wrong versions', () => {
    for (const bad of [null, 5, 'x', [], { ...emptySave(), version: 1 }, { ...emptySave(), version: 3 }]) {
      expect(isSaveFile(bad)).toBe(false)
    }
  })
  it('rejects a dangling active id and dangling order ids', () => {
    expect(isSaveFile({ ...emptySave(), activeProfileId: 'ghost' })).toBe(false)
    expect(isSaveFile({ ...emptySave(), profileOrder: ['ghost'] })).toBe(false)
  })
  it('rejects duplicate order ids and a profile stored under the wrong key', () => {
    const s = sample()
    expect(isSaveFile({ ...s, profileOrder: ['a', 'a'] })).toBe(false)
    expect(isSaveFile({ ...s, profiles: { zzz: s.profiles.a } })).toBe(false)
  })
  it('rejects out-of-range attempt fields', () => {
    const s = sample()
    const bad = (patch: object) =>
      isSaveFile({
        ...s,
        profiles: {
          a: {
            ...s.profiles.a,
            levels: { L1: { ...s.profiles.a.levels.L1, firstClear: { ...attempt(), ...patch } } },
          },
        },
      })
    expect(bad({ stars: 4 })).toBe(false)
    expect(bad({ stars: 0 })).toBe(false)
    expect(bad({ hintsUsed: 4 })).toBe(false)
    expect(bad({ moves: -1 })).toBe(false)
    expect(bad({ durationMs: -1 })).toBe(false)
    expect(bad({ moves: 1.5 })).toBe(false)
    expect(bad({})).toBe(true)
  })
  it('rejects a record with zero completions', () => {
    const s = sample()
    const rec = { ...s.profiles.a.levels.L1, completions: 0 }
    expect(isSaveFile({ ...s, profiles: { a: { ...s.profiles.a, levels: { L1: rec } } } })).toBe(false)
  })
})

const v1Save = () => ({
  version: 1,
  activeProfileId: 'a',
  profileOrder: ['a'],
  profiles: { a: { id: 'a', name: 'Ann', createdAt: 1, levels: { L1: { firstClear: attempt(), best: attempt(), completions: 1, lastPlayedAt: 1 } } } },
})

describe('v1 migration', () => {
  it('migrates a v1 save to v2 with an empty generated list and keeps progress', () => {
    const storage = new FakeStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(v1Save()))
    const loaded = loadSave(storage)
    expect(loaded.version).toBe(2)
    expect(loaded.profiles.a.generated).toEqual([])
    expect(loaded.profiles.a.levels.L1.firstClear.stars).toBe(3)
  })
  it('writes the v2 key and leaves the v1 key untouched', () => {
    const storage = new FakeStorage()
    const raw = JSON.stringify(v1Save())
    storage.setItem(LEGACY_SAVE_KEY, raw)
    loadSave(storage)
    expect(storage.getItem(SAVE_KEY)).not.toBeNull()
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(raw)
  })
  it('prefers v2 when both exist', () => {
    const storage = new FakeStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(v1Save()))
    writeSave(storage, emptySave())
    expect(loadSave(storage)).toEqual(emptySave())
  })
  it('a corrupt v1 save gives an empty save and writes nothing', () => {
    const storage = new FakeStorage()
    storage.setItem(LEGACY_SAVE_KEY, '{nope')
    expect(loadSave(storage)).toEqual(emptySave())
    expect(storage.getItem(SAVE_KEY)).toBeNull()
  })
  it('migrateV1 rejects non-v1 input and a v1 with dangling ids', () => {
    expect(migrateV1(null)).toBeNull()
    expect(migrateV1(emptySave())).toBeNull()
    expect(migrateV1({ ...v1Save(), activeProfileId: 'ghost' })).toBeNull()
  })
})

describe('isGeneratedEntry', () => {
  const good = () => ({
    id: 'g', rows: 2, cols: 2, flows: 2, grid: ['AB', 'AB'], createdAt: 1, completions: 1,
    best: { moves: 2, hintsUsed: 0, durationMs: 1, at: 1 }, last: { moves: 2, hintsUsed: 0, durationMs: 1, at: 1 },
  })
  it('accepts a well-formed entry', () => {
    expect(isGeneratedEntry(good())).toBe(true)
    expect(isGeneratedEntry({ ...good(), completions: 0, best: null, last: null })).toBe(true)
  })
  it('rejects a grid whose size does not match rows x cols, ragged rows and bad numbers', () => {
    expect(isGeneratedEntry({ ...good(), rows: 3 })).toBe(false)
    expect(isGeneratedEntry({ ...good(), grid: ['AB', 'A'] })).toBe(false)
    expect(isGeneratedEntry({ ...good(), grid: 'AB' })).toBe(false)
    expect(isGeneratedEntry({ ...good(), completions: -1 })).toBe(false)
    expect(isGeneratedEntry({ ...good(), best: { ...good().best, hintsUsed: 4 } })).toBe(false)
    expect(isGeneratedEntry(null)).toBe(false)
  })
  it('a save with a malformed generated entry is treated as corrupt', () => {
    const storage = new FakeStorage()
    const s = sample()
    writeSave(storage, { ...s, profiles: { a: { ...s.profiles.a, generated: [{ ...good(), rows: 9 }] } } })
    expect(loadSave(storage)).toEqual(emptySave())
    expect(storage.getItem(CORRUPT_KEY)).not.toBeNull()
  })
})
