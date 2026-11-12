import { ART, artUrl } from '../art/manifest.ts'
import type { ArtName } from '../art/manifest.ts'

/** Decorative sprite image at an integer pixel scale. Accessible names always come from the text next to it. */
export function PixelIcon({ name, scale = 2, className = '' }: { name: ArtName; scale?: number; className?: string }) {
  const { w, h } = ART[name]
  return (
    <img
      src={artUrl(name)}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`px-icon ${className}`}
      style={{ width: `calc(${w} * var(--px) * ${scale / 3})`, height: `calc(${h} * var(--px) * ${scale / 3})` }}
    />
  )
}
