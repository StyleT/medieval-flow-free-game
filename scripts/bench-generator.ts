import { generateLevel } from '../src/engine/generator.ts'

const SEEDS = 20
const CASES = [
  { rows: 11, cols: 11, flows: 10 },
  { rows: 15, cols: 15, flows: 14 },
  { rows: 15, cols: 15, flows: 16 },
]

for (const { rows, cols, flows } of CASES) {
  const times: number[] = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    const start = performance.now()
    generateLevel({ rows, cols, flows, seed, id: 'bench', name: 'bench' })
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)]
  console.log(
    `${rows}x${cols}/${flows}: median ${median.toFixed(0)} ms, max ${times[times.length - 1].toFixed(0)} ms (${SEEDS} seeds)`,
  )
}
