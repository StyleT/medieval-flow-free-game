import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { noopPlayer } from './audioEngine.ts'
import type { AudioPlayer } from './audioEngine.ts'
import { loadAudioSettings, saveAudioSettings } from './settings.ts'
import type { AudioSettings } from './settings.ts'
import type { SfxId } from './soundMap.ts'

type SoundContextValue = {
  player: AudioPlayer
  settings: AudioSettings
  setSettings: (s: AudioSettings) => void
  play: (id: SfxId) => void
}

const SoundContext = createContext<SoundContextValue>({
  player: noopPlayer,
  settings: { music: true, sfx: true },
  setSettings: () => {},
  play: () => {},
})

export const useSound = () => useContext(SoundContext)

/** Owns the audio settings, unlocks audio on first input and plays generic button clicks. */
export function SoundProvider({
  player,
  storage,
  children,
}: {
  player: AudioPlayer
  storage: Storage | null
  children: ReactNode
}) {
  const [settings, setLocal] = useState(() => loadAudioSettings(storage))

  // Apply settings to the player before the first paint.
  useEffect(() => {
    player.setEnabled(settings)
  }, [player, settings])

  const setSettings = useCallback(
    (next: AudioSettings) => {
      setLocal(next)
      saveAudioSettings(storage, next)
    },
    [storage],
  )

  const play = useCallback((id: SfxId) => player.playSfx({ id }), [player])

  useEffect(() => {
    const unlock = () => player.unlock()
    const onClick = (e: MouseEvent) => {
      const button = e.target instanceof Element ? e.target.closest('button') : null
      if (!button || (button as HTMLButtonElement).disabled) return
      const sfx = button.dataset.sfx
      if (sfx === 'none') return
      player.playSfx({ id: sfx === 'next' ? 'next' : 'click' })
    }
    const onVisibility = () => player.setHidden(document.visibilityState === 'hidden')
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('keydown', unlock, true)
    // Capture phase: runs before React handlers that may unmount the button.
    document.addEventListener('click', onClick, true)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('keydown', unlock, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [player])

  const value = useMemo(() => ({ player, settings, setSettings, play }), [player, settings, setSettings, play])
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}
