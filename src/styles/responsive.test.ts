// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ui = readFileSync('src/styles/pixel-ui.css', 'utf8')
const board = readFileSync('src/styles/board.css', 'utf8')
const index = readFileSync('src/index.css', 'utf8')
const rule = (css: string, selector: string): string =>
  new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
const desktop = (css: string): string =>
  [...css.matchAll(/@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1]).join('\n')

describe('responsive layout contract', () => {
  it('bordered buttons never shrink or wrap', () => {
    const px = rule(ui, '.px-btn')
    expect(px).toMatch(/flex: none/)
    expect(px).toMatch(/white-space: nowrap/)
  })
  it('icons keep their size inside flex parents', () => {
    expect(rule(ui, '.px-icon')).toMatch(/flex: none/)
  })
  it('sound control floats bottom-right on phones, honouring the safe area', () => {
    const r = rule(ui, '.sound-toggle')
    expect(r).toMatch(/position: fixed/)
    expect(r).toMatch(/bottom: max\(0\.75rem, env\(safe-area-inset-bottom\)\)/)
    expect(r).toMatch(/right: max\(0\.75rem, env\(safe-area-inset-right\)\)/)
    expect(r).not.toMatch(/\btop:/)
  })
  it('sound menu opens upward on phones and downward from sm up', () => {
    expect(rule(ui, '.sound-toggle-menu')).toMatch(/bottom: 100%/)
    const wide = desktop(ui)
    expect(wide).toMatch(/\.sound-toggle \{[^}]*top: max\(0\.75rem, env\(safe-area-inset-top\)\)/)
    expect(wide).toMatch(/\.sound-toggle-menu \{[^}]*top: 100%/)
  })
  it('the unlock hint is a solid-bordered box in flex flow: no 9-slice, no transform, no absolute offset', () => {
    const hint = rule(ui, '.sound-hint')
    expect(hint).toMatch(/border: var\(--px\) solid/)
    expect(hint).toMatch(/white-space: nowrap/)
    expect(hint).toMatch(/pointer-events: none/)
    expect(hint).not.toMatch(/border-image|transform|position: absolute/)
    expect(rule(ui, '.sound-toggle')).toMatch(/display: flex/)
  })
  it('the locked pulse stops under reduced motion', () => {
    expect(rule(ui, '.sound-toggle-btn--locked')).toMatch(/animation: sound-pulse/)
    expect(ui).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.sound-toggle-btn--locked \{\s*animation: none/)
  })
  it('menu cannot be wider than the viewport', () => {
    expect(rule(ui, '.sound-toggle-menu')).toMatch(/max-width: calc\(100vw - 1\.5rem\)/)
  })
  it('reserves room under content for the floating button on phones only', () => {
    expect(ui).toMatch(/:root \{\s*--dock: 5\.5rem/)
    expect(desktop(ui)).toMatch(/--dock: 0rem/)
  })
  it('the board subtracts its frame from the column width and keeps the dock out of its height budget', () => {
    expect(board).toMatch(/width: min\(calc\(100% - 6 \* var\(--px\)\)/)
    expect(board).toMatch(/--bars-h: calc\([^)]*var\(--dock\)\)/)
  })
  it('the page can never scroll sideways', () => {
    expect(index).toMatch(/html,\s*body \{[^}]*overflow-x: clip/)
  })
})
