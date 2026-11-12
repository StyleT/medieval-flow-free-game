import { useState } from 'react'
import { totalScore, validateName } from '../../profile/profiles.ts'
import type { NameError } from '../../profile/profiles.ts'
import { useSound } from '../../audio/SoundProvider.tsx'
import type { ProfileId, SaveFile } from '../../profile/types.ts'

const ERROR_TEXT: Record<NameError, string> = {
  empty: 'Enter a name',
  'too-long': 'Max 16 characters',
  taken: 'That name is taken',
}

export function ProfilesScreen({
  save,
  maxTotal,
  onCreate,
  onPick,
  onDelete,
}: {
  save: SaveFile
  maxTotal: number
  onCreate: (name: string) => void
  onPick: (id: ProfileId) => void
  onDelete: (id: ProfileId) => void
}) {
  const { play } = useSound()
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState<ProfileId | null>(null)
  const checked = validateName(save, name)
  const error = touched && !checked.ok ? ERROR_TEXT[checked.error] : null

  return (
    <main className="mx-auto max-w-md p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(1rem+var(--dock))]">
      <h1 className="px-banner mb-4 text-center text-2xl font-bold sm:mr-14">Who's playing?</h1>
      <ul className="mb-6 space-y-2">
        {save.profileOrder.map((id) => {
          const profile = save.profiles[id]
          return (
            <li key={id} className="px-panel-dark flex items-center gap-2 p-1">
              <button className="flex-1 px-2 text-left" onClick={() => onPick(id)}>
                <span className="font-semibold">{profile.name}</span>
                <span className="ml-2 text-sm text-muted">
                  {totalScore(profile)} / {maxTotal} ★
                </span>
              </button>
              {confirming === id ? (
                <>
                  <button className="px-btn px-btn--danger" onClick={() => onDelete(id)}>
                    Confirm delete
                  </button>
                  <button className="px-btn" onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="px-btn text-muted"
                  aria-label={`Delete ${profile.name}`}
                  onClick={() => setConfirming(id)}
                >
                  Delete
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <form
        className="px-panel space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (checked.ok) onCreate(checked.name)
          else {
            setTouched(true)
            play('error')
          }
        }}
      >
        <label className="block text-sm text-muted" htmlFor="player-name">
          New player
        </label>
        <input
          id="player-name"
          className="px-panel-dark w-full p-2"
          value={name}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value)
            setTouched(true)
          }}
        />
        <p role="alert" className="min-h-5 text-sm text-danger">
          {error}
        </p>
        <button
          type="submit"
          disabled={!checked.ok}
          className="px-btn px-btn--gold w-full"
        >
          Play
        </button>
      </form>
    </main>
  )
}
