import { describe, expect, it } from 'vitest'
import { MAP_WIDTH, MIN_MAP_WIDTH, NODE_SIZE, PLATE_H, PLATE_W, decorFor, distToSegment, mapHeight, mapNodes, mapWidthFor } from './mapLayout.ts'

describe('mapNodes', () => {
  it('goes strictly downward (level 1 at the top) and stays inside the width', () => {
    const nodes = mapNodes(15)
    for (let i = 1; i < nodes.length; i++) expect(nodes[i].y).toBeGreaterThan(nodes[i - 1].y)
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(PLATE_W / 2)
      expect(n.x).toBeLessThanOrEqual(MAP_WIDTH - PLATE_W / 2)
      expect(n.y).toBeGreaterThan(0)
      expect(n.y).toBeLessThan(mapHeight(15))
    }
  })
  it('leaves room for each caption plate between consecutive nodes', () => {
    const nodes = mapNodes(15)
    for (let i = 1; i < nodes.length; i++) expect(nodes[i].y - nodes[i - 1].y).toBeGreaterThanOrEqual(NODE_SIZE + PLATE_H)
  })
  it('is deterministic', () => {
    expect(mapNodes(15)).toEqual(mapNodes(15))
  })
  it('handles 0, 1 and 15 nodes', () => {
    expect(mapNodes(0)).toEqual([])
    expect(mapNodes(1)).toHaveLength(1)
    expect(mapNodes(15)).toHaveLength(15)
    expect(mapHeight(0)).toBe(0)
    expect(mapHeight(1)).toBeGreaterThan(0)
  })
  it('returns [] for negative or invalid counts', () => {
    for (const c of [-1, -100, NaN, -Infinity]) expect(mapNodes(c)).toEqual([])
  })
  it('respects a narrower width', () => {
    for (const n of mapNodes(15, 100)) expect(n.x).toBeLessThanOrEqual(100 - PLATE_W / 2)
  })
  it('uses different lanes so the road winds', () => {
    expect(new Set(mapNodes(15).map((n) => Math.round(n.x / 20))).size).toBeGreaterThan(2)
  })
})

describe('decorFor', () => {
  it('is reproducible per seed and differs between seeds', () => {
    expect(decorFor(15, 7)).toEqual(decorFor(15, 7))
    expect(decorFor(15, 7)).not.toEqual(decorFor(15, 8))
  })
  it('never overlaps a node or the road', () => {
    for (const seed of [1, 2, 3, 99]) {
      const nodes = mapNodes(15)
      for (const d of decorFor(15, seed)) {
        for (const n of nodes) {
          expect(Math.hypot(n.x - d.x, n.y - d.y)).toBeGreaterThan(NODE_SIZE / 2)
          expect(d.y < n.y + NODE_SIZE / 2 + PLATE_H && d.y > n.y - NODE_SIZE / 2 && Math.abs(d.x - n.x) < 24).toBe(false)
        }
        for (let i = 1; i < nodes.length; i++) expect(distToSegment(d, nodes[i - 1], nodes[i])).toBeGreaterThan(10)
      }
    }
  })
  it('keeps decor inside the map and apart from each other', () => {
    const list = decorFor(15, 5)
    expect(list.length).toBeGreaterThan(0)
    for (const d of list) {
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThanOrEqual(MAP_WIDTH)
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeLessThanOrEqual(mapHeight(15))
    }
  })
  it('returns [] for zero or negative counts', () => {
    expect(decorFor(0, 1)).toEqual([])
    expect(decorFor(-3, 1)).toEqual([])
  })
})

describe('distToSegment', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 0 }
  it('measures to the segment interior and its ends', () => {
    expect(distToSegment({ x: 5, y: 3 }, a, b)).toBe(3)
    expect(distToSegment({ x: -4, y: 3 }, a, b)).toBe(5)
    expect(distToSegment({ x: 14, y: 3 }, a, b)).toBe(5)
  })
  it('handles a zero-length segment', () => {
    expect(distToSegment({ x: 3, y: 4 }, a, a)).toBe(5)
  })
})

describe('mapWidthFor', () => {
  it('fits a 393 px phone at 3 px per art pixel', () => {
    const w = mapWidthFor(393 - 32, 3, 3)
    expect(w * 3 + 6).toBeLessThanOrEqual(393 - 32)
    expect(w).toBeGreaterThanOrEqual(MIN_MAP_WIDTH)
    expect(w).toBeLessThan(MAP_WIDTH)
  })
  it('caps at MAP_WIDTH on wide containers', () => {
    expect(mapWidthFor(1200, 3)).toBe(MAP_WIDTH)
    expect(mapWidthFor(288, 2)).toBe(MAP_WIDTH - 16)
    expect(mapWidthFor(320, 2)).toBe(MAP_WIDTH)
  })
  it('floors at MIN_MAP_WIDTH for tiny or zero containers', () => {
    expect(mapWidthFor(0, 3)).toBe(MIN_MAP_WIDTH)
    expect(mapWidthFor(100, 3)).toBe(MIN_MAP_WIDTH)
  })
  it('returns the minimum for invalid input', () => {
    for (const [c, p] of [[NaN, 3], [-50, 3], [400, 0], [400, -1], [400, NaN], [Infinity, 3]]) {
      expect(mapWidthFor(c, p)).toBe(MIN_MAP_WIDTH)
    }
  })
})

describe('layout at every supported width', () => {
  for (const width of [MIN_MAP_WIDTH, 112, 136, MAP_WIDTH]) {
    for (const count of [1, 3, 15]) {
      it(`width ${width}, ${count} levels: nodes stay inside, spaced, and decor stays clear`, () => {
        const nodes = mapNodes(count, width)
        for (const n of nodes) {
          expect(n.x).toBeGreaterThanOrEqual(PLATE_W / 2)
          expect(n.x).toBeLessThanOrEqual(width - PLATE_W / 2)
        }
        for (let i = 1; i < nodes.length; i++) {
          expect(nodes[i].y - nodes[i - 1].y).toBeGreaterThanOrEqual(NODE_SIZE + PLATE_H)
        }
        for (const d of decorFor(count, 3, width)) {
          expect(d.x).toBeGreaterThanOrEqual(0)
          expect(d.x).toBeLessThanOrEqual(width)
          for (const n of nodes) expect(Math.hypot(n.x - d.x, n.y - d.y)).toBeGreaterThan(NODE_SIZE / 2)
        }
      })
    }
  }
})
