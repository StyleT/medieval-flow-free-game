import type { AudioPlayer } from './audio/audioEngine.ts'
import type { AudioSettings } from './audio/settings.ts'
import type { MusicTrack, SoundEvent } from './audio/soundMap.ts'
import type { Attempt } from './profile/types.ts'

export class FakeStorage implements Storage {
  data = new Map<string, string>()
  throwOnSet = false
  throwOnGet = false
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    if (this.throwOnGet) throw new Error('blocked')
    return this.data.get(key) ?? null
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.throwOnSet) throw new Error('quota')
    this.data.set(key, value)
  }
}

export const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  stars: 3,
  moves: 2,
  hintsUsed: 0,
  durationMs: 5000,
  at: 1000,
  ...over,
})

export type FakePlayer = AudioPlayer & {
  sfx: SoundEvent[]
  music: Array<MusicTrack | null>
  enabled: AudioSettings[]
  ducks: number[]
  hidden: boolean[]
  unlocks: number
}

/** Records every call so UI tests can assert on sounds. */
export function fakePlayer(): FakePlayer {
  const p: FakePlayer = {
    sfx: [],
    music: [],
    enabled: [],
    ducks: [],
    hidden: [],
    unlocks: 0,
    playSfx: (e) => void p.sfx.push(e),
    setMusic: (t) => void p.music.push(t),
    setEnabled: (s) => void p.enabled.push(s),
    duckMusic: (ms) => void p.ducks.push(ms),
    setHidden: (h) => void p.hidden.push(h),
    unlock: () => void p.unlocks++,
  }
  return p
}
