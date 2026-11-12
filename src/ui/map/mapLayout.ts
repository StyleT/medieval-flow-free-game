import { mulberry32 } from '../../engine/rng.ts'

/** Map units are art pixels; the page multiplies by --px. */
export const MAP_WIDTH = 160
export const MIN_MAP_WIDTH = 96
export const NODE_SIZE = 32
/** Caption plate width (art px); nodes keep this much room so plates and Stats never leave the map. */
export const PLATE_W = 44
const EDGE = PLATE_W / 2 + 2
/** Height reserved under each node for its caption plate (art px). */
export const PLATE_H = 26
const STEP_Y = 86
const MARGIN = 44
const LANES = [0.25, 0.5, 0.75]

export type Point = { x: number; y: number }

export function mapHeight(count: number): number {
  return count <= 0 ? 0 : MARGIN * 2 + (count - 1) * STEP_Y
}

/** Map width in art px that fits `containerCssPx`, between MIN_MAP_WIDTH and MAP_WIDTH. Bad input gives the minimum. */
export function mapWidthFor(containerCssPx: number, px: number, borderCssPx = 0): number {
  if (!Number.isFinite(containerCssPx) || !Number.isFinite(px) || px <= 0) return MIN_MAP_WIDTH
  const fit = Math.floor((containerCssPx - 2 * borderCssPx) / px)
  return Math.max(MIN_MAP_WIDTH, Math.min(MAP_WIDTH, fit))
}

/** Node centers: level 1 at the top, going down, zig-zagging over 3 lanes with a small sine wobble. */
export function mapNodes(count: number, width = MAP_WIDTH): Point[] {
  if (!Number.isFinite(count) || count <= 0) return []
  return Array.from({ length: Math.floor(count) }, (_, i) => {
    const lane = LANES[[1, 0, 1, 2][i % 4]]
    const x = width * lane + Math.sin(i * 1.7) * 6
    return {
      x: Math.round(Math.min(width - EDGE, Math.max(EDGE, x))),
      y: Math.round(MARGIN + i * STEP_Y),
    }
  })
}

export type Decor = Point & { kind: 'tree_a' | 'tree_b' | 'mountain_a' | 'hut' }
const KINDS: Decor['kind'][] = ['tree_a', 'tree_b', 'tree_a', 'mountain_a', 'hut']
const DECOR_SIZE = 28

/** Scenery scattered reproducibly, away from nodes and the road between them. */
export function decorFor(count: number, seed: number, width = MAP_WIDTH): Decor[] {
  const nodes = mapNodes(count, width)
  if (nodes.length === 0) return []
  const height = mapHeight(count)
  const rng = mulberry32(seed)
  const clear = NODE_SIZE / 2 + PLATE_H + DECOR_SIZE / 2 + 4
  const out: Decor[] = []
  for (let attempt = 0; attempt < count * 14 && out.length < count * 2; attempt++) {
    const p = {
      x: Math.round(DECOR_SIZE / 2 + rng() * (width - DECOR_SIZE)),
      y: Math.round(DECOR_SIZE / 2 + rng() * (height - DECOR_SIZE)),
    }
    const kind = KINDS[Math.floor(rng() * KINDS.length)]
    const nearNode = nodes.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < clear)
    const nearRoad = nodes.some((n, i) => i > 0 && distToSegment(p, nodes[i - 1], n) < DECOR_SIZE / 2 + 4)
    const nearDecor = out.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < DECOR_SIZE)
    if (!nearNode && !nearRoad && !nearDecor) out.push({ ...p, kind })
  }
  return out
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
