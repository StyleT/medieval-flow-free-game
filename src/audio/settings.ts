export type AudioSettings = { music: boolean; sfx: boolean }

export const AUDIO_KEY = 'flow.audio.v1'
export const DEFAULT_AUDIO: AudioSettings = { music: true, sfx: true }

/**
 * Per-device setting, kept apart from the profile save file. Never throws:
 * a null storage, bad JSON or a wrong shape all land in the catch or the
 * type check and give the defaults.
 */
export function loadAudioSettings(storage: Storage | null): AudioSettings {
  try {
    const parsed = JSON.parse(storage!.getItem(AUDIO_KEY)!) as Partial<AudioSettings> | null
    if (typeof parsed?.music === 'boolean' && typeof parsed.sfx === 'boolean') {
      return { music: parsed.music, sfx: parsed.sfx }
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_AUDIO
}

export function saveAudioSettings(storage: Storage | null, settings: AudioSettings): boolean {
  try {
    storage!.setItem(AUDIO_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
