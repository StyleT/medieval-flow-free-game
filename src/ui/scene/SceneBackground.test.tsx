// @vitest-environment jsdom
/// <reference types="node" />
import { act, cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { SceneBackground } from './SceneBackground.tsx'

afterEach(cleanup)

describe('SceneBackground', () => {
  it('is hidden from assistive tech and never intercepts input', () => {
    render(<SceneBackground scene="hall" />)
    const el = screen.getByTestId('scene')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('')
    expect(readFileSync('src/styles/pixel-ui.css', 'utf8')).toMatch(/\.scene \{[^}]*pointer-events: none/)
  })
  it('renders the scene art and its torch/banner sprites', () => {
    render(<SceneBackground scene="hall" />)
    const el = screen.getByTestId('scene')
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/art/scenes/scene_hall.png')
    expect(el.querySelectorAll('[data-sprite="torch"]')).toHaveLength(2)
    expect(el.querySelectorAll('[data-sprite="banner_wave"]')).toHaveLength(2)
  })
  it('only the castle has clouds', () => {
    const { container, rerender } = render(<SceneBackground scene="castle" />)
    expect(container.querySelector('.scene-clouds')).not.toBeNull()
    rerender(<SceneBackground scene="dungeon" />)
    expect(container.querySelector('.scene-clouds')).toBeNull()
  })
  it('scales by an integer', () => {
    render(<SceneBackground scene="castle" />)
    const box = screen.getByTestId('scene').firstElementChild as HTMLElement
    const scale = Number(/scale\(([\d.]+)\)/.exec(box.style.transform)?.[1])
    expect(Number.isInteger(scale)).toBe(true)
    expect(scale).toBeGreaterThanOrEqual(1)
  })
  it('pauses animations while the tab is hidden and resumes when visible', () => {
    render(<SceneBackground scene="castle" />)
    const el = screen.getByTestId('scene')
    const setVisibility = (v: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: v })
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
    }
    setVisibility('hidden')
    expect(el.className).toContain('scene--paused')
    setVisibility('visible')
    expect(el.className).not.toContain('scene--paused')
  })
  it('turns the animations off under prefers-reduced-motion', () => {
    const css = readFileSync('src/styles/pixel-ui.css', 'utf8')
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.scene-clouds,\s*\.scene-sprite \{\s*animation: none/)
  })
  it('dims the scene when asked', () => {
    render(<SceneBackground scene="castle" dim />)
    expect(screen.getByTestId('scene').className).toContain('scene--dim')
  })
})
