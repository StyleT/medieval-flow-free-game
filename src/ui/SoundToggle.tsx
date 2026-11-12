import { useEffect, useRef, useState } from 'react'
import { useSound } from '../audio/SoundProvider.tsx'
import { PixelIcon } from './pixel/PixelIcon.tsx'

function Row({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      data-sfx="none"
      className="flex min-h-11 w-full items-center justify-between gap-4 px-3"
      onClick={() => onChange(!on)}
    >
      <span>{label}</span>
      <span className={on ? 'text-star' : 'text-muted'}>{on ? 'On' : 'Off'}</span>
    </button>
  )
}

/** Music and Sound effects switches. Floats bottom-right on phones, top-right from the `sm` breakpoint up. */
export function SoundToggle() {
  const { settings, setSettings, locked } = useSound()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const waves = (Number(settings.music) + Number(settings.sfx)) as 0 | 1 | 2
  // Browsers play nothing until the first tap; say so, unless the player turned all sound off.
  const showHint = locked && waves > 0

  return (
    <div ref={root} className="sound-toggle">
      {showHint && !open && (
        <p role="status" className="px-panel-dark sound-hint">
          Tap to enable sound
        </p>
      )}
      <button
        aria-label="Sound settings"
        aria-expanded={open}
        className={`px-btn sound-toggle-btn flex items-center justify-center${showHint ? ' sound-toggle-btn--locked' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <PixelIcon name={waves === 0 ? 'speaker_off' : 'speaker_on'} scale={3} />
      </button>
      {open && (
        <div className="px-panel-dark sound-toggle-menu">
          <Row label="Music" on={settings.music} onChange={(music) => setSettings({ ...settings, music })} />
          <Row label="Sound effects" on={settings.sfx} onChange={(sfx) => setSettings({ ...settings, sfx })} />
        </div>
      )}
    </div>
  )
}
