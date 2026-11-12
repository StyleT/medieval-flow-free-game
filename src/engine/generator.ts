import { neighborTable } from './grid.ts'
import { parseLevel } from './levels.ts'
import { mulberry32, randInt } from './rng.ts'
import { analyzeLevel, detourOf, meetsQuota } from './forced.ts'
import type { Quality } from './forced.ts'
import { solve } from './solver.ts'
import type { Level } from './types.ts'

export type GenerateOptions = {
  rows: number
  cols: number
  flows: number
  seed: number
  id: string
  name: string
  mode?: 'unique' | 'open' // default 'open'
  budget?: Partial<Budget>
}

export type Budget = { candidates: number; candidateMs: number; totalMs: number }

const MIN_FLOW_LENGTH = 3
const MAX_FLOWS = 26
const MAX_ATTEMPTS = 200 // unique mode: candidates that are fully checked by the solver
const MAX_DRAWS = 20000 // all random draws, including cheap rejections
const DEFAULT_BUDGET: Budget = { candidates: 24, candidateMs: 2000, totalMs: Infinity }

export function generateLevel(opts: GenerateOptions): Level {
  const { rows, cols, flows } = opts
  if (rows < 2 || cols < 2) throw new Error('board must be at least 2x2')
  if (flows < 1) throw new Error('need at least 1 flow')
  if (flows > MAX_FLOWS) throw new Error(`at most ${MAX_FLOWS} flows`)
  if (MIN_FLOW_LENGTH * flows > rows * cols) throw new Error('too many flows for this board')
  return opts.mode === 'unique' ? generateUnique(opts) : generateOpen(opts)
}

function generateUnique(opts: GenerateOptions): Level {
  let seed = opts.seed
  let solverChecks = 0
  for (let draw = 0; draw < MAX_DRAWS && solverChecks < MAX_ATTEMPTS; draw++) {
    const rng = mulberry32(seed)
    const level = drawCandidate(opts, rng)
    if (level !== null) {
      solverChecks++
      if (solve(level, 2).length === 1) return level
    }
    seed = randInt(rng, 2 ** 31)
  }
  throw new Error('no unique level found')
}

function generateOpen(opts: GenerateOptions): Level {
  const budget = { ...DEFAULT_BUDGET, ...opts.budget }
  const stopAt = Date.now() + budget.totalMs
  let seed = opts.seed
  let analyzed = 0
  let best: { level: Level; score: number } | null = null
  let fallback: Level | null = null // a valid but trivial level, for boards too small to avoid them

  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    if (best !== null && (analyzed >= budget.candidates || Date.now() >= stopAt)) break
    const rng = mulberry32(seed)
    seed = randInt(rng, 2 ** 31)
    const level = drawCandidate(opts, rng)
    if (level === null) continue
    if (tooTrivial(level)) {
      fallback ??= level
      continue
    }

    const quality = analyzeLevel(level, { deadline: Date.now() + budget.candidateMs })
    analyzed++
    if (quality.met) return level
    const score = qualityScore(quality)
    if (best === null || score > best.score) best = { level, score }
  }
  const result = best?.level ?? fallback
  if (result === null) throw new Error('no level found')
  return result
}

const qualityScore = (q: Quality): number =>
  5 * q.forcedDetour + 2 * q.forced.length + 0.1 * q.totalDetour

export { analyzeLevel, detourOf, meetsQuota }
export type { Quality }

/** Steps A and B: one candidate level, or null when the path cannot be cut into valid flows. */
function drawCandidate(opts: GenerateOptions, rng: () => number): Level | null {
  const { rows, cols, flows } = opts
  const snakes = packSnakes(rows, cols, (rows * cols) / flows, rng)
  const shaped = shapeFlows(snakes, rows, cols, flows, rng)
  if (shaped === null) return null
  return tryBuildLevel(opts, shaped)
}

/** Null when the ASCII grid could not be parsed back (should not happen for valid cuts). */
function tryBuildLevel(opts: GenerateOptions, flowCells: number[][]): Level | null {
  try {
    return buildLevel(opts, flowCells)
  } catch {
    return null
  }
}

function buildLevel(opts: GenerateOptions, flowCells: number[][]): Level {
  const firstEnd = (cells: number[]) => Math.min(cells[0], cells[cells.length - 1]) // reading order
  const ordered = [...flowCells].sort((a, b) => firstEnd(a) - firstEnd(b))
  const grid = Array.from({ length: opts.rows }, () => Array<string>(opts.cols).fill('?'))
  ordered.forEach((cells, i) => {
    for (const idx of cells) grid[Math.floor(idx / opts.cols)][idx % opts.cols] = String.fromCharCode(65 + i)
  })
  return parseLevel(
    { id: opts.id, name: opts.name },
    grid.map((line) => line.join('')),
  )
}

// Step A: pack the board with induced snakes
// ---------------------------------------------------------------------------

/**
 * Covers every cell with simple paths that never touch themselves. Each snake starts in the most
 * cramped free cell and grows toward cramped neighbors (so no cell is stranded), with some
 * randomness and a bias to keep going straight. Lengths vary around `targetLength`. Cell indexes.
 */
export function packSnakes(rows: number, cols: number, targetLength: number, rng: () => number): number[][] {
  const near = neighborTable(rows, cols)
  const owner = new Int32Array(rows * cols).fill(-1)
  const freeAround = (cell: number, except: number): number => {
    let count = 0
    for (let d = 0; d < 4; d++) {
      const n = near[cell * 4 + d]
      if (n >= 0 && n !== except && owner[n] === -1) count++
    }
    return count
  }

  const snakes: number[][] = []
  for (;;) {
    let start = -1
    let startScore = Infinity
    for (let cell = 0; cell < owner.length; cell++) {
      if (owner[cell] !== -1) continue
      const score = freeAround(cell, -1) + rng() * 0.9
      if (score < startScore) {
        start = cell
        startScore = score
      }
    }
    if (start === -1) return snakes

    const id = snakes.length
    const snake = [start]
    owner[start] = id
    const length = Math.max(MIN_FLOW_LENGTH, Math.round(targetLength * (0.5 + rng())))
    while (snake.length < length) {
      const head = snake[snake.length - 1]
      const previous = snake.length > 1 ? snake[snake.length - 2] : -1
      const options: { cell: number; score: number }[] = []
      for (let d = 0; d < 4; d++) {
        const n = near[head * 4 + d]
        if (n < 0 || owner[n] !== -1 || touchesSnake(near, owner, n, id, head)) continue
        const straight = previous >= 0 && n - head === head - previous
        const score = freeAround(n, head) + rng() * 1.5 - (straight ? STRAIGHT_BIAS : 0)
        options.push({ cell: n, score })
      }
      if (options.length === 0) break
      const next = options.reduce((x, y) => (y.score < x.score ? y : x))
      snake.push(next.cell)
      owner[next.cell] = id
    }
    snakes.push(snake)
  }
}

const STRAIGHT_BIAS = 0.6

/** True when `cell` borders a cell of snake `id` other than `head`. */
function touchesSnake(near: Int32Array, owner: Int32Array, cell: number, id: number, head: number): boolean {
  for (let d = 0; d < 4; d++) {
    const n = near[cell * 4 + d]
    if (n >= 0 && n !== head && owner[n] === id) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Step B: shape the snakes into exactly the requested number of flows
// ---------------------------------------------------------------------------

type CutContext = { near: Int32Array; mark: Int32Array; stamp: number; rng: () => number }

const areAdjacent = (near: Int32Array, a: number, b: number): boolean =>
  near[a * 4] === b || near[a * 4 + 1] === b || near[a * 4 + 2] === b || near[a * 4 + 3] === b

/**
 * Turns packed snakes into exactly `flows` valid flows (each ≥ 3 cells, never touching itself,
 * ends not adjacent) by joining short snakes and splitting long ones; null when that fails.
 */
export function shapeFlows(
  snakes: number[][],
  rows: number,
  cols: number,
  flows: number,
  rng: () => number,
): number[][] | null {
  const ctx: CutContext = {
    near: neighborTable(rows, cols),
    mark: new Int32Array(rows * cols),
    stamp: 0,
    rng,
  }
  const merged = mergeRuns(snakes, flows, ctx)
  if (merged === null) return null
  const split = splitRuns(merged, flows, ctx)
  return split !== null && split.every((run) => validEnds(run, ctx.near)) ? split : null
}

const validEnds = (run: number[], near: Int32Array): boolean =>
  run.length >= MIN_FLOW_LENGTH && !areAdjacent(near, run[0], run[run.length - 1])

/** True when some cell of the run has a same-run neighbor that is not its path neighbor. */
export function touchesItself(cells: number[], near: Int32Array, mark: Int32Array, stamp: number): boolean {
  for (const c of cells) mark[c] = stamp
  for (let i = 0; i < cells.length; i++) {
    let count = 0
    for (let d = 0; d < 4; d++) {
      const n = near[cells[i] * 4 + d]
      if (n >= 0 && mark[n] === stamp) count++
    }
    if (count !== (i > 0 ? 1 : 0) + (i < cells.length - 1 ? 1 : 0)) return true
  }
  return false
}

type Join = { a: number; b: number; cells: number[] }

/**
 * Joins runs until none is shorter than the minimum and at most `flows` remain. Prefers short
 * runs. Null when no valid join exists.
 */
export function mergeRuns(start: number[][], flows: number, ctx: CutContext): number[][] | null {
  let runs = start
  for (;;) {
    const hasShort = runs.some((r) => r.length < MIN_FLOW_LENGTH)
    if (!hasShort && runs.length <= flows) return runs
    const joined = pickJoin(runs, hasShort, ctx)
    if (joined === null) return null
    runs = runs.filter((_, i) => i !== joined.a && i !== joined.b)
    runs.push(joined.cells)
  }
}

function pickJoin(runs: number[][], shortOnly: boolean, ctx: CutContext): Join | null {
  const { near } = ctx
  const runAt = new Map<number, number>() // end cell → run index
  runs.forEach((r, i) => {
    runAt.set(r[0], i)
    runAt.set(r[r.length - 1], i)
  })

  const options: Join[] = []
  runs.forEach((a, ai) => {
    for (const reversed of [false, true]) {
      const aEnd = reversed ? a[0] : a[a.length - 1]
      for (let d = 0; d < 4; d++) {
        const n = near[aEnd * 4 + d]
        const bi = n >= 0 ? runAt.get(n) : undefined
        if (bi === undefined || bi === ai) continue
        const b = runs[bi]
        if (shortOnly && a.length >= MIN_FLOW_LENGTH && b.length >= MIN_FLOW_LENGTH) continue
        const left = reversed ? [...a].reverse() : a
        const right = b[0] === n ? b : [...b].reverse()
        options.push({ a: ai, b: bi, cells: [...left, ...right] })
      }
    }
  })

  // Weighted toward joining short flows; drop options that would touch themselves.
  while (options.length > 0) {
    const weights = options.map((o) => 1 / (o.cells.length * o.cells.length))
    let roll = ctx.rng() * weights.reduce((x, y) => x + y, 0)
    let pick = 0
    while (pick < options.length - 1 && roll >= weights[pick]) roll -= weights[pick++]
    const option = options[pick]
    if (!touchesItself(option.cells, near, ctx.mark, ++ctx.stamp)) return option
    options.splice(pick, 1)
  }
  return null
}

/** Splits the longest runs until there are `flows` of them; null when no valid split exists. */
export function splitRuns(start: number[][], flows: number, ctx: CutContext): number[][] | null {
  const runs = [...start]
  while (runs.length < flows) {
    const byLength = runs.map((_, i) => i).sort((x, y) => runs[y].length - runs[x].length)
    let done = false
    for (const index of byLength) {
      const cuts = validSplits(runs[index], ctx.near)
      if (cuts.length === 0) continue
      const k = cuts[randInt(ctx.rng, cuts.length)]
      const [run] = runs.splice(index, 1)
      runs.push(run.slice(0, k), run.slice(k))
      done = true
      break
    }
    if (!done) return null
  }
  return runs
}

/** Cut points k so both parts have ≥ 3 cells and non-adjacent ends. */
export function validSplits(run: number[], near: Int32Array): number[] {
  const cuts: number[] = []
  for (let k = MIN_FLOW_LENGTH; k <= run.length - MIN_FLOW_LENGTH; k++) {
    if (!areAdjacent(near, run[0], run[k - 1]) && !areAdjacent(near, run[k], run[run.length - 1])) cuts.push(k)
  }
  return cuts
}

// ---------------------------------------------------------------------------
// Step C: cheap shape metrics
// ---------------------------------------------------------------------------

/** More than half of the flows are straight along the border: nothing to figure out. */
export function tooTrivial(level: Level): boolean {
  const onBorder = (c: { row: number; col: number }) =>
    c.row === 0 || c.col === 0 || c.row === level.rows - 1 || c.col === level.cols - 1
  const trivial = Object.values(level.solution).filter(
    (path) => detourOf(path) === 0 && path.every(onBorder),
  ).length
  return trivial * 2 > level.pairs.length
}
