import { describe, expect, it } from 'vitest'
import { parseLevel } from '../engine/levels.ts'
import { attempt } from '../test-utils.ts'
import {
  addGenerated,
  createProfile,
  deleteProfile,
  deleteGenerated,
  emptySave,
  generatedLevel,
  isBetterAttempt,
  isBetterRun,
  recordGenerated,
  isUnlocked,
  recordCompletion,
  switchProfile,
  totalScore,
  validateName,
} from './profiles.ts'
import { MAX_GENERATED } from './types.ts'
import type { GeneratedEntry, RunResult, SaveFile } from './types.ts'

const withProfiles = (): SaveFile => {
  let save = emptySave()
  for (const [name, id] of [['Ann', 'a'], ['Bob', 'b']] as const) {
    const r = createProfile(save, name, 10, id)
    if (r.ok) save = r.save
  }
  return save // active = b, order = [b, a]
}

describe('validateName', () => {
  it('trims and accepts a valid name', () => {
    expect(validateName(emptySave(), '  Ann ')).toEqual({ ok: true, name: 'Ann' })
  })
  it('accepts exactly 16 characters and rejects 17', () => {
    expect(validateName(emptySave(), 'a'.repeat(16)).ok).toBe(true)
    expect(validateName(emptySave(), 'a'.repeat(17))).toEqual({ ok: false, error: 'too-long' })
  })
  it('rejects empty and whitespace-only names', () => {
    expect(validateName(emptySave(), '')).toEqual({ ok: false, error: 'empty' })
    expect(validateName(emptySave(), '   ')).toEqual({ ok: false, error: 'empty' })
  })
  it('rejects duplicates case-insensitively', () => {
    expect(validateName(withProfiles(), 'ANN')).toEqual({ ok: false, error: 'taken' })
    expect(validateName(withProfiles(), ' bob ')).toEqual({ ok: false, error: 'taken' })
  })
})

describe('createProfile', () => {
  it('creates the profile and makes it active and first in order', () => {
    const save = withProfiles()
    expect(save.activeProfileId).toBe('b')
    expect(save.profileOrder).toEqual(['b', 'a'])
    expect(save.profiles.a).toEqual({ id: 'a', name: 'Ann', createdAt: 10, levels: {}, generated: [] })
  })
  it('returns the error and leaves the save untouched on invalid names', () => {
    const save = withProfiles()
    expect(createProfile(save, '', 1, 'c')).toEqual({ ok: false, error: 'empty' })
    expect(createProfile(save, 'ann', 1, 'c')).toEqual({ ok: false, error: 'taken' })
  })
  it('does not mutate its input', () => {
    const save = Object.freeze(emptySave())
    expect(() => createProfile(save, 'Ann', 1, 'a')).not.toThrow()
  })
})

describe('switchProfile and deleteProfile', () => {
  it('switch moves the id to the front', () => {
    const switched = switchProfile(withProfiles(), 'a')
    expect(switched.activeProfileId).toBe('a')
    expect(switched.profileOrder).toEqual(['a', 'b'])
  })
  it('switching to an unknown id is a no-op', () => {
    const save = withProfiles()
    expect(switchProfile(save, 'zzz')).toBe(save)
  })
  it('deleting the active profile clears the active id', () => {
    const next = deleteProfile(withProfiles(), 'b')
    expect(next.activeProfileId).toBeNull()
    expect(next.profileOrder).toEqual(['a'])
    expect(Object.keys(next.profiles)).toEqual(['a'])
  })
  it('deleting another profile keeps the active one', () => {
    const next = deleteProfile(withProfiles(), 'a')
    expect(next.activeProfileId).toBe('b')
  })
  it('deleting an unknown id is a no-op', () => {
    const save = withProfiles()
    expect(deleteProfile(save, 'zzz')).toBe(save)
  })
})

describe('isBetterAttempt', () => {
  it('orders by stars, then moves, then hints', () => {
    expect(isBetterAttempt(attempt({ stars: 3 }), attempt({ stars: 2 }))).toBe(true)
    expect(isBetterAttempt(attempt({ stars: 2 }), attempt({ stars: 3 }))).toBe(false)
    expect(isBetterAttempt(attempt({ moves: 2 }), attempt({ moves: 3 }))).toBe(true)
    expect(isBetterAttempt(attempt({ moves: 3 }), attempt({ moves: 2 }))).toBe(false)
    expect(isBetterAttempt(attempt({ hintsUsed: 0 }), attempt({ hintsUsed: 1 }))).toBe(true)
  })
  it('an identical attempt is not better', () => {
    expect(isBetterAttempt(attempt(), attempt())).toBe(false)
  })
})

describe('recordCompletion', () => {
  it('first clear creates the record', () => {
    const r = recordCompletion(withProfiles(), 'a', 'L1', attempt({ stars: 2 }))
    expect(r.firstClear).toBe(true)
    const rec = r.save.profiles.a.levels.L1
    expect(rec.firstClear.stars).toBe(2)
    expect(rec.best.stars).toBe(2)
    expect(rec.completions).toBe(1)
  })
  it('a replay never touches firstClear but updates best, completions and lastPlayedAt', () => {
    const first = recordCompletion(withProfiles(), 'a', 'L1', attempt({ stars: 1, at: 100 }))
    const replay = recordCompletion(first.save, 'a', 'L1', attempt({ stars: 3, at: 200 }))
    const rec = replay.save.profiles.a.levels.L1
    expect(replay.firstClear).toBe(false)
    expect(rec.firstClear.stars).toBe(1)
    expect(rec.best.stars).toBe(3)
    expect(rec.completions).toBe(2)
    expect(rec.lastPlayedAt).toBe(200)
    expect(totalScore(replay.save.profiles.a)).toBe(1)
  })
  it('a worse replay keeps the existing best', () => {
    const first = recordCompletion(withProfiles(), 'a', 'L1', attempt({ stars: 3 }))
    const replay = recordCompletion(first.save, 'a', 'L1', attempt({ stars: 1, at: 5 }))
    expect(replay.save.profiles.a.levels.L1.best.stars).toBe(3)
    expect(replay.save.profiles.a.levels.L1.completions).toBe(2)
  })
  it('an unknown profile is a no-op', () => {
    const save = withProfiles()
    const r = recordCompletion(save, 'zzz', 'L1', attempt())
    expect(r.save).toBe(save)
    expect(r.firstClear).toBe(false)
  })
})

describe('totalScore and isUnlocked', () => {
  const levels = [1, 2, 3].map((n) => parseLevel({ id: `L${n}`, name: `L${n}` }, ['AA']))
  it('totalScore sums first-clear stars only', () => {
    let save = withProfiles()
    save = recordCompletion(save, 'a', 'L1', attempt({ stars: 3 })).save
    save = recordCompletion(save, 'a', 'L2', attempt({ stars: 2 })).save
    expect(totalScore(save.profiles.a)).toBe(5)
    expect(totalScore(save.profiles.b)).toBe(0)
  })
  it('level 0 is always unlocked; level n needs n-1 completed', () => {
    const save = recordCompletion(withProfiles(), 'a', 'L1', attempt()).save
    const p = save.profiles.a
    expect(isUnlocked(p, levels, 0)).toBe(true)
    expect(isUnlocked(p, levels, 1)).toBe(true)
    expect(isUnlocked(p, levels, 2)).toBe(false)
    expect(isUnlocked(save.profiles.b, levels, 1)).toBe(false)
  })
  it('an out-of-range index is locked', () => {
    expect(isUnlocked(withProfiles().profiles.a, levels, 99)).toBe(false)
  })
})

const run = (over: Partial<RunResult> = {}): RunResult => ({ moves: 3, hintsUsed: 0, durationMs: 9000, at: 100, ...over })
const puzzle = (id = 'g1') => ({ id, rows: 2, cols: 2, flows: 2, grid: ['AB', 'AB'] })

describe('isBetterRun', () => {
  it('compares moves, then hints, then time; equal is not better', () => {
    expect(isBetterRun(run({ moves: 2 }), run())).toBe(true)
    expect(isBetterRun(run({ moves: 4 }), run())).toBe(false)
    expect(isBetterRun(run({ hintsUsed: 0 }), run({ hintsUsed: 1 }))).toBe(true)
    expect(isBetterRun(run({ durationMs: 8000 }), run())).toBe(true)
    expect(isBetterRun(run(), run())).toBe(false)
  })
})

describe('addGenerated', () => {
  it('stores an unsolved puzzle at the front with no runs', () => {
    const save = addGenerated(withProfiles(), 'a', puzzle(), 50)
    expect(save.profiles.a.generated[0]).toMatchObject({ id: 'g1', completions: 0, best: null, last: null, createdAt: 50 })
    expect(totalScore(save.profiles.a)).toBe(0)
  })
  it('a known puzzle keeps its record and moves to the front', () => {
    let save = recordGenerated(withProfiles(), 'a', puzzle('g1'), run())!.save
    save = addGenerated(save, 'a', puzzle('g2'), 60)
    save = addGenerated(save, 'a', puzzle('g1'), 70)
    expect(save.profiles.a.generated.map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(save.profiles.a.generated[0].completions).toBe(1)
  })
  it(`keeps at most ${MAX_GENERATED}, dropping the oldest`, () => {
    let save = withProfiles()
    for (let i = 0; i < MAX_GENERATED + 1; i++) save = addGenerated(save, 'a', puzzle(`g${i}`), i)
    const ids = save.profiles.a.generated.map((g) => g.id)
    expect(ids).toHaveLength(MAX_GENERATED)
    expect(ids).not.toContain('g0')
  })
  it('an unknown profile leaves the save unchanged', () => {
    const save = withProfiles()
    expect(addGenerated(save, 'ghost', puzzle(), 1)).toBe(save)
  })
})

describe('recordGenerated', () => {
  it('solving a stored unsolved puzzle sets its first run and is not a new best', () => {
    const stored = addGenerated(withProfiles(), 'a', puzzle(), 50)
    const out = recordGenerated(stored, 'a', puzzle(), run())!
    expect(out.entry).toMatchObject({ completions: 1, best: run(), last: run(), createdAt: 50 })
    expect(out.newBest).toBe(false)
  })
  it('records a first solve (storing the puzzle if needed), with no score change', () => {
    const save = withProfiles()
    const out = recordGenerated(save, 'a', puzzle(), run())!
    expect(out.newBest).toBe(false)
    expect(out.entry).toMatchObject({ id: 'g1', completions: 1, best: run(), last: run(), createdAt: 100 })
    expect(out.save.profiles.a.generated).toHaveLength(1)
    expect(totalScore(out.save.profiles.a)).toBe(0)
  })
  it('a replay bumps completions, keeps a better best and always sets last', () => {
    const first = recordGenerated(withProfiles(), 'a', puzzle(), run({ moves: 2 }))!.save
    const worse = recordGenerated(first, 'a', puzzle(), run({ moves: 5, at: 200 }))!
    expect(worse.entry).toMatchObject({ completions: 2, best: run({ moves: 2 }), last: run({ moves: 5, at: 200 }) })
    expect(worse.newBest).toBe(false)
    const better = recordGenerated(worse.save, 'a', puzzle(), run({ moves: 1, at: 300 }))!
    expect(better.entry.best?.moves).toBe(1)
    expect(better.newBest).toBe(true)
  })
  it('moves a replayed puzzle to the front', () => {
    let save = recordGenerated(withProfiles(), 'a', puzzle('g1'), run())!.save
    save = recordGenerated(save, 'a', puzzle('g2'), run())!.save
    expect(save.profiles.a.generated.map((g) => g.id)).toEqual(['g2', 'g1'])
    save = recordGenerated(save, 'a', puzzle('g1'), run())!.save
    expect(save.profiles.a.generated.map((g) => g.id)).toEqual(['g1', 'g2'])
  })
  it(`keeps at most ${MAX_GENERATED}, dropping the oldest`, () => {
    let save = withProfiles()
    for (let i = 0; i < MAX_GENERATED + 1; i++) save = recordGenerated(save, 'a', puzzle(`g${i}`), run())!.save
    const ids = save.profiles.a.generated.map((g) => g.id)
    expect(ids).toHaveLength(MAX_GENERATED)
    expect(ids[0]).toBe(`g${MAX_GENERATED}`)
    expect(ids).not.toContain('g0')
  })
  it('returns null for an unknown profile and does not mutate its input', () => {
    const save = withProfiles()
    expect(recordGenerated(save, 'ghost', puzzle(), run())).toBeNull()
    recordGenerated(Object.freeze(save), 'a', puzzle(), run())
  })
})

describe('deleteGenerated', () => {
  const stored = () => recordGenerated(withProfiles(), 'a', puzzle(), run())!.save
  it('removes the puzzle', () => {
    expect(deleteGenerated(stored(), 'a', 'g1').profiles.a.generated).toEqual([])
  })
  it('unknown puzzle or profile leaves the save unchanged', () => {
    const save = stored()
    expect(deleteGenerated(save, 'a', 'nope')).toBe(save)
    expect(deleteGenerated(save, 'ghost', 'g1')).toBe(save)
  })
})

describe('generatedLevel', () => {
  const entry = (grid: string[]): GeneratedEntry => ({ ...puzzle(), grid, createdAt: 1, completions: 1, best: run(), last: run() })
  it('parses a valid grid and hides a broken one', () => {
    expect(generatedLevel(entry(['AB', 'AB']))?.pairs).toHaveLength(2)
    expect(generatedLevel(entry(['AB', 'A']))).toBeNull()
    expect(generatedLevel(entry(['AA', 'AA']))).toBeNull()
  })
})
