import { useEffect, useRef, useState } from 'react'
import type { ColorId, GameState } from '../../engine/types.ts'
import { connectedColors, newlyConnected } from './connectFx.ts'

export const FX_MS = 600

export type ConnectFx = { color: ColorId; key: number }

/** Colors that just got connected stay "active" for FX_MS; backtracking out of a connection clears it at once. */
export function useConnectFx(state: GameState): ConnectFx[] {
  const prev = useRef<ReadonlySet<ColorId>>(connectedColors(state))
  const counter = useRef(0)
  const [active, setActive] = useState<ConnectFx[]>([])

  useEffect(() => {
    const next = connectedColors(state)
    const added = newlyConnected(prev.current, next)
    prev.current = next
    setActive((cur) => {
      const kept = cur.filter((fx) => next.has(fx.color))
      if (added.length === 0 && kept.length === cur.length) return cur
      return [...kept, ...added.map((color) => ({ color, key: ++counter.current }))]
    })
    if (added.length === 0) return
    const timer = setTimeout(() => setActive((cur) => cur.filter((fx) => !added.includes(fx.color))), FX_MS)
    return () => clearTimeout(timer)
  }, [state])

  return active
}
