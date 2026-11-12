import { useCallback, useState } from 'react'
import { loadSave, writeSave } from '../profile/storage.ts'
import type { SaveFile } from '../profile/types.ts'

/** Holds the SaveFile; every update is written through to storage. */
export function useSave(storage: Storage | null) {
  const [save, setSave] = useState<SaveFile>(() => loadSave(storage))
  const [persisted, setPersisted] = useState(true)

  const update = useCallback(
    (fn: (s: SaveFile) => SaveFile) => {
      setSave((current) => {
        const next = fn(current)
        if (next !== current) setPersisted(writeSave(storage, next))
        return next
      })
    },
    [storage],
  )

  return { save, update, persisted }
}
