import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { burstParticles } from './burst.ts'
import { Sprite } from '../pixel/Sprite.tsx'

const COINS = 10

/** Chest that opens once, then a burst of coins. Under reduced motion CSS shows the open chest and no coins. */
export function Treasure({ seed = 1 }: { seed?: number }) {
  const coins = useMemo(() => burstParticles(COINS, seed), [seed])
  return (
    <div className="treasure" aria-hidden="true" data-testid="treasure">
      <Sprite name="chest" fps={14} once className="treasure-chest" />
      {coins.map((c, i) => (
        <span
          key={i}
          className="treasure-coin"
          data-testid="coin"
          style={{ '--dx': `${c.dx}px`, '--dy': `${c.dy}px`, '--spin': c.spin, animationDelay: `${420 + c.delay}ms` } as CSSProperties}
        >
          <Sprite name="coin" fps={8} />
        </span>
      ))}
    </div>
  )
}
