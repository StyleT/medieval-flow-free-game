import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Level } from '../../engine/types.ts'
import { isUnlocked } from '../../profile/profiles.ts'
import type { LevelId, Profile } from '../../profile/types.ts'
import { ART, artUrl } from '../art/manifest.ts'
import type { ArtName } from '../art/manifest.ts'
import { CrownRow } from '../pixel/CrownRow.tsx'
import { PixelIcon } from '../pixel/PixelIcon.tsx'
import { Sprite } from '../pixel/Sprite.tsx'
import { MAP_WIDTH, NODE_SIZE, decorFor, mapHeight, mapNodes, mapWidthFor } from './mapLayout.ts'

const px = (n: number) => `calc(${n} * var(--px))`
const MAP_BORDER_PX = 1 // art px, matches .level-map border

/** One art pixel in CSS px (the --px custom property, set from DPR in main.tsx). */
const artPixel = (el: Element): number => parseFloat(getComputedStyle(el).getPropertyValue('--px')) || 3

/** Map width (art px) that fits the parent column; re-measured when the column or --px changes. */
function useFittedWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(MAP_WIDTH)
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const measure = () => {
      const unit = artPixel(el)
      const style = getComputedStyle(parent)
      const inner = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setWidth(mapWidthFor(inner || window.innerWidth, unit, MAP_BORDER_PX * unit))
    }
    measure()
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(parent)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [ref])
  return width
}

/** Kingdom road: one castle per level, winding downward from level 1 at the top. Each node is a real button with the old card's name. */
export function LevelMap({
  profile,
  levels,
  onPlay,
  onStats,
}: {
  profile: Profile
  levels: readonly Level[]
  onPlay: (id: LevelId) => void
  onStats: (id: LevelId) => void
}) {
  const count = levels.length
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useFittedWidth(rootRef)
  const nodes = useMemo(() => mapNodes(count, width), [count, width])
  const decor = useMemo(() => decorFor(count, 2024, width), [count, width])
  const height = mapHeight(count)
  const currentRef = useRef<HTMLLIElement>(null)

  const unlocked = levels.map((_, i) => isUnlocked(profile, levels, i))
  const currentIndex = levels.findIndex((l, i) => unlocked[i] && !profile.levels[l.id])

  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])

  return (
    <div
      ref={rootRef}
      className="level-map mx-auto"
      data-testid="level-map"
      style={{ width: px(width), height: px(height), backgroundImage: `url(${artUrl('map_tile')})`, backgroundSize: `${px(160)} ${px(160)}` }}
    >
      <svg className="level-map-road" viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-hidden="true">
        <polyline
          points={nodes.map((n) => `${n.x},${n.y}`).join(' ')}
          fill="none"
          stroke="#4a2f18"
          strokeWidth={3}
          strokeDasharray="6 5"
          strokeLinecap="square"
          shapeRendering="crispEdges"
        />
      </svg>
      {decor.map((d, i) => {
        const { w, h } = ART[d.kind]
        return (
          <img
            key={i}
            className="px-icon level-map-decor"
            src={artUrl(d.kind)}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{ left: px(d.x - w / 2), top: px(d.y - h / 2), width: px(w), height: px(h) }}
          />
        )
      })}
      <ol className="level-map-nodes">
        {levels.map((level, index) => {
          const record = profile.levels[level.id]
          const open = unlocked[index]
          const n = nodes[index]
          const art: ArtName = !open ? 'node_castle_locked' : record ? 'node_castle_cleared' : 'node_castle'
          const isCurrent = index === currentIndex
          return (
            <li
              key={level.id}
              ref={isCurrent ? currentRef : undefined}
              className="level-map-node"
              style={{ left: px(n.x - NODE_SIZE / 2), top: px(n.y - NODE_SIZE / 2) }}
            >
              <button
                className="level-map-btn"
                disabled={!open}
                aria-label={`${level.name}${open ? '' : ' (locked)'}`}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onPlay(level.id)}
              >
                {isCurrent ? (
                  <Sprite name="node_current" fps={6} className="level-map-bob" />
                ) : (
                  <img className="px-icon" src={artUrl(art)} alt="" aria-hidden="true" draggable={false} style={{ width: px(NODE_SIZE), height: px(NODE_SIZE) }} />
                )}
              </button>
              <div className="level-map-plate">
                <span className="level-map-caption">
                  {level.rows}×{level.cols} · {level.pairs.length} flows
                </span>
                {open ? <CrownRow stars={record?.firstClear.stars ?? 0} /> : <PixelIcon name="lock" scale={3} />}
              </div>
              {record && (
                <button className="px-btn level-map-stats" aria-label={`Stats for ${level.name}`} onClick={() => onStats(level.id)}>
                  Stats
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
