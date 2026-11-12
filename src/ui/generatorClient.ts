import { parseLevel } from '../engine/levels.ts'
import type { Level } from '../engine/types.ts'

export type GenerateRequest = { rows: number; cols: number; flows: number; seed: number }
export type GenerateResponse = { grid: string[] } | { error: string }
export type Generate = (request: GenerateRequest) => Promise<Level>

/** The main thread gives up on a worker that has not answered by then. */
export const GENERATE_TIMEOUT_MS = 20_000

/** Turns a worker answer into a level; rejects on an error answer or an unparsable grid. */
export function levelFromResponse(response: GenerateResponse, name: string): Level {
  if ('error' in response) throw new Error(response.error)
  return parseLevel({ id: `gen-${hashGrid(response.grid)}`, name }, response.grid)
}

/** A short stable id from the grid, so the same puzzle is recognized when played again. */
export function hashGrid(grid: readonly string[]): string {
  let h = 2166136261
  for (const ch of grid.join('/')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0).toString(36)
}

/** Generates in a fresh Web Worker; the worker is terminated when it answers or times out. */
export const generateInWorker: Generate = (request) =>
  new Promise<Level>((resolve, reject) => {
    const worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => {
      clearTimeout(timer)
      worker.terminate()
    }
    const timer = setTimeout(() => {
      finish()
      reject(new Error('generation timed out'))
    }, GENERATE_TIMEOUT_MS)
    worker.onmessage = (event: MessageEvent<GenerateResponse>) => {
      finish()
      try {
        resolve(levelFromResponse(event.data, `${request.rows}×${request.cols}`))
      } catch (error) {
        reject(error)
      }
    }
    worker.onerror = () => {
      finish()
      reject(new Error('generation failed'))
    }
    worker.postMessage(request)
  })

export const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]
