import type { Level } from '../../engine/types.ts'
import { totalScore } from '../../profile/profiles.ts'
import type { GeneratedEntry, LevelId, Profile } from '../../profile/types.ts'
import { LevelMap } from '../map/LevelMap.tsx'
import { EndlessSection } from './EndlessSection.tsx'

export function LevelsScreen({
  profile,
  levels,
  persisted,
  onPlay,
  onStats,
  onSwitch,
  generating,
  generateError,
  onGenerate,
  onPlayGenerated,
  onDeleteGenerated,
}: {
  profile: Profile
  levels: readonly Level[]
  persisted: boolean
  onPlay: (id: LevelId) => void
  onStats: (id: LevelId) => void
  onSwitch: () => void
  generating: boolean
  generateError: string | null
  onGenerate: (size: number) => void
  onPlayGenerated: (entry: GeneratedEntry) => void
  onDeleteGenerated: (id: string) => void
}) {
  return (
    <main className="mx-auto max-w-2xl p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(1rem+var(--dock))]">
      <header className="px-banner mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 sm:mr-14">
        <div>
          <h1 className="text-xl font-bold">{profile.name}</h1>
          <p className="text-sm text-star">
            Total score {totalScore(profile)} / {levels.length * 3}
          </p>
        </div>
        <button className="px-btn" onClick={onSwitch}>
          Switch player
        </button>
      </header>
      {!persisted && (
        <p role="status" className="px-panel-dark mb-3 text-sm">
          Progress won't be saved
        </p>
      )}
      <LevelMap profile={profile} levels={levels} onPlay={onPlay} onStats={onStats} />
      <EndlessSection
          generated={profile.generated}
          generating={generating}
          error={generateError}
          onGenerate={onGenerate}
          onPlay={onPlayGenerated}
          onDelete={onDeleteGenerated}
        />
    </main>
  )
}
