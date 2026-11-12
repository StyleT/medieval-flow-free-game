import { describe, expect, it, vi } from 'vitest'
import { createWebAudioPlayer } from './audioEngine.ts'
import type { ContextLike, GainLike, MediaLike, SourceLike, WebAudioDeps } from './audioEngine.ts'

function harness() {
  const sources: SourceLike[] = []
  const medias: Array<MediaLike & { paused: boolean; plays: number }> = []
  const gains: GainLike[] = []
  let time = 0
  const ctx: ContextLike = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    resume: async () => {},
    createGain: () => {
      const g: GainLike = {
        gain: {
          value: 1,
          cancelScheduledValues: () => {},
          setValueAtTime: () => {},
          linearRampToValueAtTime(v) {
            g.gain.value = v
          },
        },
        connect: () => {},
      }
      gains.push(g)
      return g
    },
    createBufferSource: () => {
      const s: SourceLike = { buffer: null, playbackRate: { value: 1 }, connect: () => {}, start: () => {} }
      sources.push(s)
      return s
    },
    createMediaElementSource: () => ({ connect: () => {} }),
    decodeAudioData: async () => ({}),
  }
  const deps: WebAudioDeps = {
    createContext: () => ctx,
    createMedia: () => {
      const m = {
        src: '',
        loop: false,
        preload: '',
        paused: true,
        plays: 0,
        play() {
          m.paused = false
          m.plays++
        },
        pause() {
          m.paused = true
        },
      }
      medias.push(m)
      return m
    },
    fetchBuffer: async () => new ArrayBuffer(1),
    now: () => time,
  }
  const player = createWebAudioPlayer(deps)
  const ready = async () => {
    player.unlock()
    await vi.waitFor(() => {
      player.playSfx({ id: 'click' })
      expect(sources.length).toBeGreaterThan(0)
    })
    sources.length = 0
  }
  return { player, sources, medias, gains, setTime: (t: number) => (time = t), ready }
}

describe('web audio player', () => {
  it('plays nothing before unlock', () => {
    const h = harness()
    h.player.playSfx({ id: 'click' })
    h.player.setMusic('menu')
    expect(h.sources).toHaveLength(0)
    expect(h.medias).toHaveLength(0)
  })
  it('starts the queued music on unlock', async () => {
    const h = harness()
    h.player.setMusic('menu')
    h.player.unlock()
    expect(h.medias).toHaveLength(1)
    expect(h.medias[0].src).toContain('music-menu.mp3')
    expect(h.medias[0].loop).toBe(true)
  })
  it('sfx off → no source is created', async () => {
    const h = harness()
    await h.ready()
    h.player.setEnabled({ music: true, sfx: false })
    h.setTime(1000)
    h.player.playSfx({ id: 'click' })
    expect(h.sources).toHaveLength(0)
  })
  it('applies the playback rate', async () => {
    const h = harness()
    await h.ready()
    h.setTime(1000)
    h.player.playSfx({ id: 'connect', rate: 1.2 })
    expect(h.sources[0].playbackRate.value).toBe(1.2)
  })
  it('drops a second tick within 40 ms and plays one at 40 ms', async () => {
    const h = harness()
    await h.ready()
    h.setTime(1000)
    h.player.playSfx({ id: 'tick' })
    h.setTime(1039)
    h.player.playSfx({ id: 'tick' })
    expect(h.sources).toHaveLength(1)
    h.setTime(1040)
    h.player.playSfx({ id: 'tick' })
    expect(h.sources).toHaveLength(2)
  })
  it('does not throttle other sounds', async () => {
    const h = harness()
    await h.ready()
    h.setTime(1000)
    h.player.playSfx({ id: 'click' })
    h.player.playSfx({ id: 'click' })
    expect(h.sources).toHaveLength(2)
  })
  it('setMusic with the same track is a no-op; a different track crossfades', () => {
    const h = harness()
    h.player.unlock()
    h.player.setMusic('menu')
    h.player.setMusic('menu')
    expect(h.medias).toHaveLength(1)
    h.player.setMusic('play')
    expect(h.medias).toHaveLength(2)
    expect(h.medias[1].src).toContain('music-play.mp3')
  })
  it('music off pauses the element and back on resumes it', () => {
    const h = harness()
    h.player.unlock()
    h.player.setMusic('menu')
    h.player.setEnabled({ music: false, sfx: true })
    expect(h.medias[0].paused).toBe(true)
    h.player.setEnabled({ music: true, sfx: true })
    expect(h.medias[0].paused).toBe(false)
  })
  it('a hidden tab pauses music and visible resumes it', () => {
    const h = harness()
    h.player.unlock()
    h.player.setMusic('menu')
    h.player.setHidden(true)
    expect(h.medias[0].paused).toBe(true)
    h.player.setHidden(false)
    expect(h.medias[0].paused).toBe(false)
  })
  it('setMusic(null) pauses and a later track starts a new bed', () => {
    const h = harness()
    h.player.unlock()
    h.player.setMusic('menu')
    h.player.setMusic(null)
    expect(h.medias[0].paused).toBe(true)
    h.player.setMusic('menu')
    expect(h.medias).toHaveLength(2)
  })
  it('music disabled before unlock stays silent', () => {
    const h = harness()
    h.player.setEnabled({ music: false, sfx: true })
    h.player.setMusic('menu')
    h.player.unlock()
    expect(h.medias).toHaveLength(0)
  })
  it('duck lowers the music bus, then restores it', () => {
    vi.useFakeTimers()
    const h = harness()
    h.player.unlock()
    const musicBus = h.gains[1]
    expect(musicBus.gain.value).toBe(0.35)
    h.player.duckMusic(1000)
    expect(musicBus.gain.value).toBeCloseTo(0.35 * 0.3)
    vi.advanceTimersByTime(1000)
    expect(musicBus.gain.value).toBe(0.35)
    vi.useRealTimers()
  })
  it('duck does nothing while music is off', () => {
    const h = harness()
    h.player.unlock()
    h.player.setEnabled({ music: false, sfx: true })
    h.player.duckMusic(1000)
    expect(h.gains[1].gain.value).toBe(0)
  })
  it('survives a failing context and failing fetches', () => {
    const player = createWebAudioPlayer({
      createContext: () => {
        throw new Error('no audio')
      },
      createMedia: () => {
        throw new Error('unused')
      },
      fetchBuffer: async () => {
        throw new Error('x')
      },
      now: () => 0,
    })
    expect(() => {
      player.unlock()
      player.playSfx({ id: 'click' })
      player.setMusic('menu')
    }).not.toThrow()
  })
})
