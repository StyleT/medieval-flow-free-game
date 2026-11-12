import type { AudioSettings } from './settings.ts'
import { MUSIC, SFX, soundUrl } from './soundMap.ts'
import type { MusicTrack, SfxId, SoundEvent } from './soundMap.ts'

export interface AudioPlayer {
  playSfx(event: SoundEvent): void
  setMusic(track: MusicTrack | null): void
  setEnabled(settings: AudioSettings): void
  duckMusic(ms: number): void
  /** Pauses the music bed while the tab is hidden. */
  setHidden(hidden: boolean): void
  unlock(): void
}

export const noopPlayer: AudioPlayer = {
  playSfx: () => {},
  setMusic: () => {},
  setEnabled: () => {},
  duckMusic: () => {},
  setHidden: () => {},
  unlock: () => {},
}

export const THROTTLE_MS: Partial<Record<SfxId, number>> = { tick: 40 }
export const CROSSFADE_S = 0.8
export const MUSIC_VOLUME = 0.35
export const DUCK_LEVEL = 0.3

/** The slice of the Web Audio API we use, so tests can fake it. */
export type GainLike = {
  gain: {
    value: number
    cancelScheduledValues(t: number): void
    setValueAtTime(v: number, t: number): void
    linearRampToValueAtTime(v: number, t: number): void
  }
  connect(node: unknown): void
}
export type SourceLike = {
  buffer: unknown
  playbackRate: { value: number }
  connect(node: unknown): void
  start(): void
}
export type ContextLike = {
  currentTime: number
  state: string
  destination: unknown
  resume(): Promise<void>
  createGain(): GainLike
  createBufferSource(): SourceLike
  createMediaElementSource(el: unknown): { connect(node: unknown): void }
  decodeAudioData(data: ArrayBuffer): Promise<unknown>
}
export type MediaLike = {
  src: string
  loop: boolean
  preload: string
  play(): Promise<void> | void
  pause(): void
}

export type WebAudioDeps = {
  createContext: () => ContextLike
  createMedia: () => MediaLike
  fetchBuffer: (url: string) => Promise<ArrayBuffer>
  now: () => number
}

const browserDeps = (): WebAudioDeps => ({
  createContext: () => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    return new Ctor() as unknown as ContextLike
  },
  createMedia: () => new Audio() as unknown as MediaLike,
  fetchBuffer: async (url) => (await fetch(url)).arrayBuffer(),
  now: () => performance.now(),
})

type Bed = { media: MediaLike; gain: GainLike; track: MusicTrack }

export function createWebAudioPlayer(deps: WebAudioDeps = browserDeps()): AudioPlayer {
  let ctx: ContextLike | null = null
  let sfxBus: GainLike | null = null
  let musicBus: GainLike | null = null
  let settings: AudioSettings = { music: true, sfx: true }
  let wanted: MusicTrack | null = null
  let hidden = false
  let bed: Bed | null = null
  const buffers = new Map<SfxId, unknown>()
  const lastPlayed = new Map<SfxId, number>()
  let duckTimer: ReturnType<typeof setTimeout> | null = null

  const setGain = (g: GainLike, value: number, fadeS = 0) => {
    if (!ctx) return
    const t = ctx.currentTime
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(g.gain.value, t)
    g.gain.linearRampToValueAtTime(value, t + fadeS)
  }

  const loadBuffers = () => {
    for (const id of Object.keys(SFX) as SfxId[]) {
      deps
        .fetchBuffer(soundUrl(SFX[id].file))
        .then((data) => ctx!.decodeAudioData(data))
        .then((buf) => buffers.set(id, buf))
        .catch(() => {})
    }
  }

  const startBed = (track: MusicTrack) => {
    if (!ctx || !musicBus) return
    const media = deps.createMedia()
    media.src = soundUrl(MUSIC[track])
    media.loop = true
    media.preload = 'auto'
    const gain = ctx.createGain()
    gain.gain.value = 0
    ctx.createMediaElementSource(media).connect(gain)
    gain.connect(musicBus)
    void Promise.resolve(media.play()).catch(() => {})
    setGain(gain, 1, CROSSFADE_S)
    const old = bed
    bed = { media, gain, track }
    if (old) {
      setGain(old.gain, 0, CROSSFADE_S)
      setTimeout(() => old.media.pause(), CROSSFADE_S * 1000)
    }
  }

  /** Brings the music element in line with `wanted` and the music toggle. */
  const syncMusic = () => {
    if (!ctx) return
    if (!settings.music || hidden || wanted === null) {
      bed?.media.pause()
      if (wanted === null) bed = null
      return
    }
    if (bed && bed.track === wanted) {
      void Promise.resolve(bed.media.play()).catch(() => {})
      return
    }
    startBed(wanted)
  }

  return {
    unlock() {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
        return
      }
      try {
        ctx = deps.createContext()
      } catch {
        return
      }
      sfxBus = ctx.createGain()
      musicBus = ctx.createGain()
      sfxBus.connect(ctx.destination)
      musicBus.connect(ctx.destination)
      sfxBus.gain.value = settings.sfx ? 1 : 0
      musicBus.gain.value = settings.music ? MUSIC_VOLUME : 0
      void ctx.resume().catch(() => {})
      loadBuffers()
      syncMusic()
    },
    playSfx({ id, rate = 1 }) {
      if (!ctx || !sfxBus || !settings.sfx) return
      const buffer = buffers.get(id)
      if (!buffer) return
      const at = deps.now()
      const last = lastPlayed.get(id)
      const gap = THROTTLE_MS[id] ?? 0
      if (last !== undefined && at - last < gap) return
      lastPlayed.set(id, at)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate
      const volume = ctx.createGain()
      volume.gain.value = SFX[id].volume
      source.connect(volume)
      volume.connect(sfxBus)
      source.start()
    },
    setMusic(track) {
      if (track === wanted) return
      wanted = track
      syncMusic()
    },
    setEnabled(next) {
      settings = next
      if (sfxBus) setGain(sfxBus, next.sfx ? 1 : 0)
      if (musicBus) setGain(musicBus, next.music ? MUSIC_VOLUME : 0)
      syncMusic()
    },
    setHidden(next) {
      hidden = next
      syncMusic()
    },
    duckMusic(ms) {
      if (!musicBus || !settings.music) return
      setGain(musicBus, MUSIC_VOLUME * DUCK_LEVEL, 0.1)
      if (duckTimer) clearTimeout(duckTimer)
      duckTimer = setTimeout(() => {
        if (musicBus) setGain(musicBus, settings.music ? MUSIC_VOLUME : 0, 0.5)
      }, ms)
    },
  }
}
