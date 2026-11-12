// @vitest-environment node
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ART, FLOW_LETTERS, artEntry, artUrl, gemName } from './manifest.ts'

const file = (name: string, dir: string) => `public/art/${dir}/${name}.png`
const size = (path: string) => {
  const b = readFileSync(path)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

describe('art manifest', () => {
  it('has a PNG on disk for every entry, with the declared size (strips: w × frames)', () => {
    for (const [name, e] of Object.entries(ART)) {
      const path = file(name, e.dir)
      expect(existsSync(path), path).toBe(true)
      const entry = e as { w: number; h: number; frames?: number }
      expect(size(path), name).toEqual({ w: entry.w * (entry.frames ?? 1), h: entry.h })
    }
  })
  it('has a gem for every flow letter A–P', () => {
    expect(FLOW_LETTERS).toHaveLength(16)
    for (const l of FLOW_LETTERS) expect(artEntry(gemName(l)).w).toBeGreaterThan(0)
  })
  it('builds urls under the base path', () => {
    expect(artUrl('gem_A')).toBe('/art/sprites/gem_A.png')
    expect(artUrl('chest')).toBe('/art/anims/chest.png')
    expect(artUrl('scene_hall')).toBe('/art/scenes/scene_hall.png')
  })
  it('throws on unknown names', () => {
    expect(() => artEntry('nope')).toThrow(/Unknown art asset/)
    expect(() => artUrl('')).toThrow()
    expect(() => gemName('Z')).toThrow()
  })
})
