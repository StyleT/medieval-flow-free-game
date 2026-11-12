import { describe, expect, it } from 'vitest'
import { FakeStorage } from '../test-utils.ts'
import { AUDIO_KEY, DEFAULT_AUDIO, loadAudioSettings, saveAudioSettings } from './settings.ts'

describe('audio settings', () => {
  it('uses the documented storage key', () => {
    const s = new FakeStorage()
    saveAudioSettings(s, { music: true, sfx: false })
    expect(s.getItem('flow.audio.v1')).toBe('{"music":true,"sfx":false}')
  })
  it('defaults to both on when missing', () => {
    expect(loadAudioSettings(new FakeStorage())).toEqual({ music: true, sfx: true })
  })
  it('round-trips', () => {
    const s = new FakeStorage()
    expect(saveAudioSettings(s, { music: false, sfx: true })).toBe(true)
    expect(loadAudioSettings(s)).toEqual({ music: false, sfx: true })
    expect(s.getItem(AUDIO_KEY)).toBe('{"music":false,"sfx":true}')
  })
  it('falls back to defaults on bad JSON or wrong shape', () => {
    const s = new FakeStorage()
    for (const raw of ['{nope', '"x"', 'null', '[]', '{"music":1,"sfx":true}', '{"music":true}']) {
      s.setItem(AUDIO_KEY, raw)
      expect(loadAudioSettings(s)).toEqual(DEFAULT_AUDIO)
    }
  })
  it('drops unknown extra fields', () => {
    const s = new FakeStorage()
    s.setItem(AUDIO_KEY, '{"music":false,"sfx":false,"x":1}')
    expect(loadAudioSettings(s)).toEqual({ music: false, sfx: false })
  })
  it('never throws when storage blocks reads or writes, or is null', () => {
    const s = new FakeStorage()
    s.throwOnGet = true
    s.throwOnSet = true
    expect(loadAudioSettings(s)).toEqual(DEFAULT_AUDIO)
    expect(saveAudioSettings(s, DEFAULT_AUDIO)).toBe(false)
    expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO)
    expect(saveAudioSettings(null, DEFAULT_AUDIO)).toBe(false)
  })
})
