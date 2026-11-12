/** Single source of truth for pixel-art files: size of one frame and, for strips, the frame count. */
export type ArtEntry = { dir: 'sprites' | 'anims' | 'scenes'; w: number; h: number; frames?: number }

const sprite = (w: number, h: number): ArtEntry => ({ dir: 'sprites', w, h })
const anim = (w: number, h: number, frames: number): ArtEntry => ({ dir: 'anims', w, h, frames })
const scene = (): ArtEntry => ({ dir: 'scenes', w: 320, h: 180 })

export const FLOW_LETTERS = 'ABCDEFGHIJKLMNOP'.split('')

const gems = Object.fromEntries(FLOW_LETTERS.map((l) => [`gem_${l}`, sprite(22, 20)]))

export const ART = {
  ...gems,
  floor_a: sprite(24, 24),
  floor_b: sprite(24, 24),
  floor_c: sprite(24, 24),
  block: sprite(24, 24),
  gem_shine: anim(24, 24, 6),
  sparkle: anim(24, 24, 5),
  panel: sprite(24, 24),
  panel_dark: sprite(24, 24),
  btn: sprite(24, 16),
  btn_down: sprite(24, 16),
  btn_gold: sprite(24, 16),
  btn_gold_down: sprite(24, 16),
  banner: sprite(24, 16),
  crown: sprite(14, 14),
  crown_empty: sprite(14, 14),
  lock: sprite(12, 12),
  speaker_on: sprite(12, 12),
  speaker_off: sprite(12, 12),
  scroll: sprite(14, 14),
  hourglass: sprite(14, 14),
  arrow_back: sprite(14, 14),
  shield: sprite(14, 14),
  coin: anim(10, 10, 4),
  chest: anim(32, 32, 6),
  scene_castle: scene(),
  scene_hall: scene(),
  scene_dungeon: scene(),
  clouds: sprite(320, 40),
  torch: anim(8, 16, 4),
  banner_wave: anim(12, 24, 6),
  map_tile: sprite(160, 160),
  tree_a: sprite(16, 20),
  tree_b: sprite(14, 20),
  mountain_a: sprite(28, 20),
  hut: sprite(18, 16),
  node_castle: sprite(32, 32),
  node_castle_cleared: sprite(32, 32),
  node_castle_locked: sprite(32, 32),
  node_lock: sprite(8, 8),
  node_current: anim(30, 36, 4),
} as const satisfies Record<string, ArtEntry>

export type ArtName = keyof typeof ART

export function artEntry(name: string): ArtEntry {
  const entry = (ART as Record<string, ArtEntry>)[name]
  if (!entry) throw new Error(`Unknown art asset: ${name}`)
  return entry
}

export const gemName = (letter: string): ArtName => {
  const name = `gem_${letter}`
  artEntry(name)
  return name as ArtName
}

export const artUrl = (name: string): string =>
  `${import.meta.env?.BASE_URL ?? '/'}art/${artEntry(name).dir}/${name}.png`
