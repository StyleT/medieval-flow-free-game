import Logic from 'logic-solver'
import type { Formula } from 'logic-solver'
import type { ColorId, Level } from './types.ts'

/** `forced`: the flow has one route. `alternative`: another full fill exists. `unknown`: gave up. */
export type FlowVerdict = 'forced' | 'alternative' | 'unknown'
export type Prover = {
  check(color: ColorId): FlowVerdict
  /** Is there any fill other than the reference one? */
  hasAnotherFill(): FlowVerdict
}

const MAX_CUT_ROUNDS = 500

type Edge = readonly [number, number]

/**
 * Encodes "fill the board with one simple path per flow" once; `check` then asks, per flow, for a
 * fill whose route for that flow differs from the reference. Edge variables carry the paths, and
 * detached same-color loops are cut lazily (a cut is valid for every query, so it is kept).
 */
export function createProver(level: Level, options: { deadline?: number } = {}): Prover {
  const { rows, cols } = level
  const edges = gridEdges(rows, cols)
  const solver = new Logic.Solver()
  const name = edgeName
  const index = (cell: { row: number; col: number }) => cell.row * cols + cell.col
  const cells = rows * cols
  const flows = level.pairs.length
  const color = (cell: number, k: number) => `x${cell}_${k}`

  const endOf = new Map<number, number>()
  level.pairs.forEach((p, k) => p.ends.forEach((e) => endOf.set(index(e), k)))
  const blocked = new Set(level.blocked.map(index))

  for (let cell = 0; cell < cells; cell++) {
    if (blocked.has(cell)) continue
    solver.require(Logic.exactlyOne(...Array.from({ length: flows }, (_, k) => color(cell, k))))
    const fixed = endOf.get(cell)
    if (fixed !== undefined) solver.require(color(cell, fixed))
  }

  const usable = edges.filter(([a, b]) => !blocked.has(a) && !blocked.has(b))
  for (const [a, b] of usable) {
    for (let k = 0; k < flows; k++) {
      solver.require(Logic.or(Logic.not(name(a, b)), Logic.not(color(a, k)), color(b, k)))
      solver.require(Logic.or(Logic.not(name(a, b)), color(a, k), Logic.not(color(b, k))))
    }
  }

  const incident: string[][] = Array.from({ length: cells }, () => [])
  for (const [a, b] of usable) {
    incident[a].push(name(a, b))
    incident[b].push(name(a, b))
  }
  for (let cell = 0; cell < cells; cell++) {
    if (blocked.has(cell)) continue
    requireDegree(solver, incident[cell], endOf.has(cell) ? 1 : 2)
  }

  // "flow k leaves its reference route", switched on per query
  level.pairs.forEach((pair, k) => {
    const path = level.solution[pair.color].map(index)
    const route = path.slice(1).map((cell, i) => Logic.not(name(path[i], cell)))
    solver.require(Logic.or(Logic.not(`avoid${k}`), ...route))
  })

  // "some flow leaves its reference route": any other fill
  solver.require(Logic.or(Logic.not('avoidAny'), ...level.pairs.map((_, k) => `leaves${k}`)))
  level.pairs.forEach((_, k) => solver.require(Logic.or(Logic.not(`leaves${k}`), `avoid${k}`)))

  return {
    check(colorId) {
      const k = level.pairs.findIndex((p) => p.color === colorId)
      if (k < 0) throw new Error(`unknown color ${colorId}`)
      return checkFlow(solver, usable, `avoid${k}`, options.deadline)
    },
    hasAnotherFill() {
      return checkFlow(solver, usable, 'avoidAny', options.deadline)
    },
  }
}

function checkFlow(
  solver: InstanceType<typeof Logic.Solver>,
  edges: readonly Edge[],
  avoid: string,
  deadline = Infinity,
): FlowVerdict {
  for (let round = 0; round < MAX_CUT_ROUNDS; round++) {
    if (Date.now() > deadline) return 'unknown'
    const solution = solver.solveAssuming(avoid)
    if (solution === null) return 'forced'
    const loops = detachedLoops(edges, new Set(solution.getTrueVars()))
    if (loops.length === 0) return 'alternative'
    for (const loop of loops) solver.require(Logic.or(...loop.map((e) => Logic.not(e))))
  }
  return 'unknown'
}

/** Edge-name lists of the components in which every cell has degree 2 (no endpoint: a loop). */
export function detachedLoops(edges: readonly Edge[], used: ReadonlySet<string>): string[][] {
  const next = new Map<number, number[]>()
  const link = (from: number, to: number) => next.set(from, [...(next.get(from) ?? []), to])
  const active = edges.filter(([a, b]) => used.has(edgeName(a, b)))
  for (const [a, b] of active) {
    link(a, b)
    link(b, a)
  }

  const seen = new Set<number>()
  const loops: string[][] = []
  for (const start of next.keys()) {
    if (seen.has(start)) continue
    const component = collect(start, next, seen)
    if (!component.every((cell) => next.get(cell)!.length === 2)) continue
    const inside = new Set(component)
    loops.push(active.filter(([a]) => inside.has(a)).map(([a, b]) => edgeName(a, b)))
  }
  return loops
}

function collect(start: number, next: ReadonlyMap<number, number[]>, seen: Set<number>): number[] {
  const component: number[] = []
  const stack = [start]
  seen.add(start)
  while (stack.length > 0) {
    const cell = stack.pop()!
    component.push(cell)
    for (const other of next.get(cell)!) {
      if (seen.has(other)) continue
      seen.add(other)
      stack.push(other)
    }
  }
  return component
}

/** Exactly `degree` (1 or 2) of the edge variables are true. */
function requireDegree(solver: InstanceType<typeof Logic.Solver>, vars: readonly string[], degree: 1 | 2): void {
  if (degree === 1) {
    solver.require(Logic.exactlyOne(...vars))
    return
  }
  for (const rest of combinations(vars, vars.length - 1)) solver.require(Logic.or(...rest)) // at least 2
  for (const triple of combinations(vars, 3)) solver.require(Logic.or(...triple.map((v) => Logic.not(v)))) // at most 2
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (items.length < size) return []
  const [head, ...tail] = items
  return [...combinations(tail, size - 1).map((rest) => [head, ...rest]), ...combinations(tail, size)]
}

function gridEdges(rows: number, cols: number): Edge[] {
  const edges: Edge[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = r * cols + c
      if (c + 1 < cols) edges.push([cell, cell + 1])
      if (r + 1 < rows) edges.push([cell, cell + cols])
    }
  }
  return edges
}

function edgeName(a: number, b: number): string {
  return `e${Math.min(a, b)}_${Math.max(a, b)}`
}

export type { Formula }
