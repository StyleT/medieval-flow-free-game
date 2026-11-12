import { generateLevel } from '../engine/generator.ts'
import { toGrid } from '../engine/levels.ts'
import type { GenerateRequest, GenerateResponse } from './generatorClient.ts'

/** Runs in a Web Worker: one request in, one grid (or an error message) out. */
self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { rows, cols, flows, seed } = event.data
  let response: GenerateResponse
  try {
    const level = generateLevel({ rows, cols, flows, seed, id: 'endless', name: 'Endless', budget: { totalMs: TIME_CAP_MS } })
    response = { grid: toGrid(level) }
  } catch (error) {
    response = { error: error instanceof Error ? error.message : 'generation failed' }
  }
  self.postMessage(response)
}

/** Stop looking for a better candidate after this long (a started proof can still overrun). */
const TIME_CAP_MS = 3000
