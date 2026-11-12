/**
 * Size of one art pixel in CSS px, chosen so it is a whole number of *device* pixels.
 * On a 2x or 3x screen that keeps pixel art crisp; on 1.5x or 2.625x a plain 3px would
 * land on fractional device pixels and shimmer. Small viewports use a smaller base scale.
 */
export function cssPixelSize(viewportWidth: number, dpr: number): number {
  const safeDpr = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1
  const base = viewportWidth < 380 ? 2 : 3
  const devicePixels = Math.max(1, Math.round(base * safeDpr))
  return devicePixels / safeDpr
}

export function applyPixelScale(root: HTMLElement, win: Pick<Window, 'innerWidth' | 'devicePixelRatio'>): void {
  root.style.setProperty('--px', `${cssPixelSize(win.innerWidth, win.devicePixelRatio)}px`)
}
