export type SfxId =
  | 'start'
  | 'tick'
  | 'snip'
  | 'connect'
  | 'solve'
  | 'star'
  | 'hint'
  | 'reset'
  | 'click'
  | 'next'
  | 'confirm'
  | 'cancel'
  | 'error'

export type MusicTrack = 'menu' | 'play'

export type SoundEvent = { id: SfxId; rate?: number }

/** Files live in `public/sounds`; volume is relative to the SFX bus. */
export const SFX: Record<SfxId, { file: string; volume: number }> = {
  start: { file: 'pop-soft.mp3', volume: 0.6 },
  tick: { file: 'tick.mp3', volume: 0.35 },
  snip: { file: 'snip.mp3', volume: 0.5 },
  connect: { file: 'connect.mp3', volume: 0.7 },
  solve: { file: 'solve.mp3', volume: 0.8 },
  star: { file: 'star.mp3', volume: 0.7 },
  hint: { file: 'hint.mp3', volume: 0.6 },
  reset: { file: 'reset.mp3', volume: 0.5 },
  click: { file: 'click.mp3', volume: 0.5 },
  next: { file: 'next.mp3', volume: 0.6 },
  confirm: { file: 'confirm.mp3', volume: 0.6 },
  cancel: { file: 'cancel.mp3', volume: 0.5 },
  error: { file: 'error.mp3', volume: 0.5 },
}

export const MUSIC: Record<MusicTrack, string> = {
  menu: 'music-menu.mp3',
  play: 'music-play.mp3',
}

export const soundUrl = (file: string): string => `${import.meta.env?.BASE_URL ?? '/'}sounds/${file}`

export function musicFor(screen: 'profiles' | 'levels' | 'play' | 'play-generated'): MusicTrack {
  return screen === 'play' || screen === 'play-generated' ? 'play' : 'menu'
}
