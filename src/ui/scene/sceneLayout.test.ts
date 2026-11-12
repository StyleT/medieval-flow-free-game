import { describe, expect, it } from 'vitest'
import { SCENES, SCENE_H, SCENE_W, coverScale, sceneFor } from './sceneLayout.ts'

describe('coverScale', () => {
  it('covers a phone and a desktop viewport', () => {
    const phone = coverScale(390, 844)
    expect(phone * SCENE_W).toBeGreaterThanOrEqual(390)
    expect(phone * SCENE_H).toBeGreaterThanOrEqual(844)
    expect(coverScale(390, 844)).toBe(5)
    expect(coverScale(1920, 1080)).toBe(6)
  })
  it('is exactly 1 for a 320×180 viewport, and 2 one pixel over', () => {
    expect(coverScale(320, 180)).toBe(1)
    expect(coverScale(321, 180)).toBe(2)
    expect(coverScale(320, 181)).toBe(2)
  })
  it('never returns 0 or NaN for empty, negative or invalid sizes', () => {
    for (const [w, h] of [[0, 0], [-5, 100], [100, -5], [10, 10], [NaN, 100], [100, Infinity]]) {
      expect(coverScale(w, h)).toBe(1)
    }
  })
})

describe('scenes', () => {
  it('maps screens to scenes', () => {
    expect(sceneFor('profiles')).toBe('castle')
    expect(sceneFor('levels')).toBe('castle')
    expect(sceneFor('play')).toBe('hall')
    expect(sceneFor('play-generated')).toBe('dungeon')
  })
  it('keeps every overlay inside the scene', () => {
    for (const spec of Object.values(SCENES)) {
      for (const o of spec.overlays) {
        expect(o.x).toBeGreaterThanOrEqual(0)
        expect(o.x).toBeLessThan(SCENE_W)
        expect(o.y).toBeGreaterThanOrEqual(0)
        expect(o.y).toBeLessThan(SCENE_H)
      }
    }
  })
})
