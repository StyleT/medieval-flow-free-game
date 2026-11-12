import { useCallback, useEffect, useState } from 'react'
import { noopPlayer } from './audio/audioEngine.ts'
import type { AudioPlayer } from './audio/audioEngine.ts'
import { SoundProvider, useSound } from './audio/SoundProvider.tsx'
import { musicFor } from './audio/soundMap.ts'
import { LEVELS, flowsFor, toGrid } from './engine/levels.ts'
import type { Level } from './engine/types.ts'
import {
  createProfile,
  deleteProfile,
  deleteGenerated,
  addGenerated,
  generatedLevel,
  recordCompletion,
  recordGenerated,
  switchProfile,
  totalScore,
  isUnlocked,
} from './profile/profiles.ts'
import { safeLocalStorage } from './profile/storage.ts'
import type { Attempt, GeneratedEntry, LevelId } from './profile/types.ts'
import { CompletionDialog } from './ui/CompletionDialog.tsx'
import type { CompletionInfo } from './ui/CompletionDialog.tsx'
import { FreeplayDialog } from './ui/FreeplayDialog.tsx'
import type { FreeplayInfo } from './ui/FreeplayDialog.tsx'
import { generateInWorker, randomSeed } from './ui/generatorClient.ts'
import type { Generate } from './ui/generatorClient.ts'
import { LevelsScreen } from './ui/screens/LevelsScreen.tsx'
import { PlayScreen } from './ui/screens/PlayScreen.tsx'
import { ProfilesScreen } from './ui/screens/ProfilesScreen.tsx'
import { SceneBackground } from './ui/scene/SceneBackground.tsx'
import { sceneFor } from './ui/scene/sceneLayout.ts'
import { SoundToggle } from './ui/SoundToggle.tsx'
import { StatsSheet } from './ui/StatsSheet.tsx'
import { useSave } from './ui/useSave.ts'

type Screen =
  | { kind: 'profiles' }
  | { kind: 'levels' }
  | { kind: 'play'; levelId: LevelId }
  | { kind: 'play-generated'; level: Level }

export type AppProps = {
  levels?: readonly Level[]
  storage?: Storage | null
  now?: () => number
  newId?: () => string
  generate?: Generate
  newSeed?: () => number
  audio?: AudioPlayer
}

function Game({
  levels = LEVELS,
  storage = safeLocalStorage(),
  now = Date.now,
  newId = () => crypto.randomUUID(),
  generate = generateInWorker,
  newSeed = randomSeed,
}: Omit<AppProps, 'audio'>) {
  const { player, play } = useSound()
  const { save, update, persisted } = useSave(storage)
  const active = save.activeProfileId === null ? undefined : save.profiles[save.activeProfileId]
  const [screen, setScreen] = useState<Screen>(active ? { kind: 'levels' } : { kind: 'profiles' })
  useEffect(() => {
    player.setMusic(musicFor(active === undefined ? 'profiles' : screen.kind))
  }, [player, screen.kind, active])
  const [statsFor, setStatsFor] = useState<LevelId | null>(null)
  const [completion, setCompletion] = useState<CompletionInfo | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [freeplay, setFreeplay] = useState<Omit<FreeplayInfo, 'stored'> | null>(null)

  const profile = active
  const level = screen.kind === 'play' ? levels.find((l) => l.id === screen.levelId) : undefined

  const onSolved = useCallback(
    (attempt: Attempt) => {
      if (!profile || !level) return
      const result = recordCompletion(save, profile.id, level.id, attempt)
      update(() => result.save)
      const updated = result.save.profiles[profile.id]
      const index = levels.findIndex((l) => l.id === level.id)
      setCompletion({
        attempt,
        firstClear: result.firstClear,
        firstClearStars: updated.levels[level.id].firstClear.stars,
        total: totalScore(updated),
        maxTotal: levels.length * 3,
        canGoNext: index + 1 < levels.length && isUnlocked(updated, levels, index + 1),
      })
    },
    [save, profile, level, levels, update],
  )

  /** Generates a puzzle of the given size and opens it; one generation at a time. */
  const startGenerated = (size: number) => {
    if (generating || !profile) return
    setGenerating(true)
    setGenerateError(null)
    generate({ rows: size, cols: size, flows: flowsFor(size, size), seed: newSeed() })
      .then((generated) => {
        update((s) =>
          addGenerated(
            s,
            profile.id,
            { id: generated.id, rows: generated.rows, cols: generated.cols, flows: generated.pairs.length, grid: toGrid(generated) },
            now(),
          ),
        )
        setFreeplay(null)
        setPlayKey((k) => k + 1)
        setScreen({ kind: 'play-generated', level: generated })
      })
      .catch(() => setGenerateError("Couldn't generate a puzzle. Try again."))
      .finally(() => setGenerating(false))
  }

  const onSolvedGenerated = (attempt: Attempt) => {
    if (!profile || screen.kind !== 'play-generated') return
    const { level: played } = screen
    const result = recordGenerated(
      save,
      profile.id,
      { id: played.id, rows: played.rows, cols: played.cols, flows: played.pairs.length, grid: toGrid(played) },
      { moves: attempt.moves, hintsUsed: attempt.hintsUsed, durationMs: attempt.durationMs, at: attempt.at },
    )
    if (result === null) return
    update(() => result.save)
    setFreeplay({ result: result.entry.last!, best: result.best, entry: result.entry, optimal: played.optimalMoves, newBest: result.newBest })
  }

  const playStored = (entry: GeneratedEntry) => {
    const stored = generatedLevel(entry)
    if (stored === null) return
    setFreeplay(null)
    setPlayKey((k) => k + 1)
    setScreen({ kind: 'play-generated', level: stored })
  }

  if (screen.kind === 'profiles' || !profile) {
    return (
      <>
      <SceneBackground scene={sceneFor('profiles')} />
      <ProfilesScreen
        save={save}
        maxTotal={levels.length * 3}
        onCreate={(name) => {
          const created = createProfile(save, name, now(), newId())
          if (!created.ok) return
          update(() => created.save)
          play('confirm')
          setScreen({ kind: 'levels' })
        }}
        onPick={(id) => {
          update((s) => switchProfile(s, id))
          play('confirm')
          setScreen({ kind: 'levels' })
        }}
        onDelete={(id) => {
          update((s) => deleteProfile(s, id))
          play('cancel')
        }}
      />
      </>
    )
  }

  if (screen.kind === 'play-generated') {
    const played = screen.level
    return (
      <>
        <SceneBackground scene={sceneFor('play-generated')} />
        <PlayScreen
          key={`${played.id}-${playKey}`}
          level={played}
          now={now}
          onBack={() => setScreen({ kind: 'levels' })}
          onSolved={onSolvedGenerated}
        />
        {freeplay && (
          <FreeplayDialog
            info={{ ...freeplay, stored: persisted }}
            generating={generating}
            onNew={() => startGenerated(played.rows)}
            onReplay={() => {
              setFreeplay(null)
              setPlayKey((k) => k + 1)
            }}
            onLevels={() => {
              setFreeplay(null)
              setScreen({ kind: 'levels' })
            }}
          />
        )}
      </>
    )
  }

  if (screen.kind === 'play' && level) {
    const index = levels.findIndex((l) => l.id === level.id)
    const nextLevel = levels[index + 1]
    return (
      <>
        <SceneBackground scene={sceneFor('play')} />
        <PlayScreen
          key={`${level.id}-${playKey}`}
          level={level}
          now={now}
          onBack={() => setScreen({ kind: 'levels' })}
          onSolved={onSolved}
        />
        {completion && (
          <CompletionDialog
            info={completion}
            onNext={() => {
              setCompletion(null)
              if (nextLevel) setScreen({ kind: 'play', levelId: nextLevel.id })
            }}
            onReplay={() => {
              setCompletion(null)
              setPlayKey((k) => k + 1)
            }}
            onLevels={() => {
              setCompletion(null)
              setScreen({ kind: 'levels' })
            }}
          />
        )}
      </>
    )
  }

  const statsLevel = statsFor ? levels.find((l) => l.id === statsFor) : undefined
  const statsRecord = statsFor ? profile.levels[statsFor] : undefined
  return (
    <>
      <SceneBackground scene={sceneFor('levels')} dim />
      <LevelsScreen
        profile={profile}
        levels={levels}
        persisted={persisted}
        onPlay={(id) => setScreen({ kind: 'play', levelId: id })}
        onStats={setStatsFor}
        onSwitch={() => setScreen({ kind: 'profiles' })}
        generating={generating}
        generateError={generateError}
        onGenerate={startGenerated}
        onPlayGenerated={playStored}
        onDeleteGenerated={(id) => update((s) => deleteGenerated(s, profile.id, id))}
      />
      {statsLevel && statsRecord && (
        <StatsSheet level={statsLevel} record={statsRecord} onClose={() => setStatsFor(null)} />
      )}
    </>
  )
}

function App({ audio = noopPlayer, ...rest }: AppProps) {
  const storage = rest.storage === undefined ? safeLocalStorage() : rest.storage
  return (
    <SoundProvider player={audio} storage={storage}>
      <Game {...rest} storage={storage} />
      <SoundToggle />
    </SoundProvider>
  )
}

export default App
