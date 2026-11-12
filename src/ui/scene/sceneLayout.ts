export const SCENE_W = 320
export const SCENE_H = 180

/** Smallest integer scale (≥ 1) at which a 320×180 scene covers the viewport. Bad sizes give 1. */
export function coverScale(vw: number, vh: number, sw = SCENE_W, sh = SCENE_H): number {
  if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw <= 0 || vh <= 0) return 1
  return Math.max(1, Math.ceil(Math.max(vw / sw, vh / sh)))
}

export type SceneName = 'castle' | 'hall' | 'dungeon'
type Overlay = { sprite: 'torch' | 'banner_wave'; x: number; y: number }
export type SceneSpec = { art: 'scene_castle' | 'scene_hall' | 'scene_dungeon'; overlays: Overlay[]; cloudsY: number | null }

/** Overlay positions are in scene pixels. */
export const SCENES: Record<SceneName, SceneSpec> = {
  castle: { art: 'scene_castle', overlays: [{ sprite: 'torch', x: 104, y: 112 }, { sprite: 'torch', x: 208, y: 112 }], cloudsY: 18 },
  hall: {
    art: 'scene_hall',
    overlays: [
      { sprite: 'banner_wave', x: 12, y: 30 }, { sprite: 'banner_wave', x: 296, y: 30 },
      { sprite: 'torch', x: 78, y: 120 }, { sprite: 'torch', x: 238, y: 120 },
    ],
    cloudsY: null,
  },
  dungeon: { art: 'scene_dungeon', overlays: [{ sprite: 'torch', x: 30, y: 100 }, { sprite: 'torch', x: 282, y: 100 }], cloudsY: null },
}

export function sceneFor(screen: 'profiles' | 'levels' | 'play' | 'play-generated'): SceneName {
  if (screen === 'play') return 'hall'
  if (screen === 'play-generated') return 'dungeon'
  return 'castle'
}
