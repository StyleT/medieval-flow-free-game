import { starText } from '../format.ts'
import { PixelIcon } from './PixelIcon.tsx'

/** Three crowns; the ★ text stays for screen readers and tests. */
export function CrownRow({ stars, popClass = '' }: { stars: number; popClass?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < stars ? popClass : ''} style={{ animationDelay: `${250 + i * 250}ms` }}>
          <PixelIcon name={i < stars ? 'crown' : 'crown_empty'} scale={3} />
        </span>
      ))}
      <span className="sr-only-text">{starText(stars)}</span>
    </span>
  )
}
