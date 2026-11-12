import type { CSSProperties } from 'react'
import { ART, artUrl } from '../art/manifest.ts'
import type { ArtName } from '../art/manifest.ts'

/** Animated strip: CSS steps() over the frames. Static first frame under prefers-reduced-motion. */
export function Sprite({
  name,
  fps = 8,
  once = false,
  delayMs = 0,
  className = '',
  style,
}: {
  name: ArtName
  fps?: number
  once?: boolean
  delayMs?: number
  className?: string
  style?: CSSProperties
}) {
  const { w, h, frames = 1 } = ART[name] as { w: number; h: number; frames?: number }
  return (
    <span
      aria-hidden="true"
      data-sprite={name}
      className={`px-sprite ${className}`}
      style={
        {
          width: `calc(${w} * var(--px))`,
          height: `calc(${h} * var(--px))`,
          backgroundImage: `url(${artUrl(name)})`,
          backgroundSize: `calc(${w * frames} * var(--px)) calc(${h} * var(--px))`,
          '--frames': frames,
          '--last': Math.max(1, frames - 1),
          '--fw': w,
          '--dur': `${(once ? Math.max(1, frames - 1) : frames) / fps}s`,
          '--iter': once ? '1' : 'infinite',
          animationName: once ? 'px-steps-once' : undefined,
          animationTimingFunction: once ? 'steps(var(--last))' : undefined,
          animationFillMode: once ? 'forwards' : undefined,
          animationDelay: delayMs ? `${delayMs}ms` : undefined,
          ...style,
        } as CSSProperties
      }
    />
  )
}
