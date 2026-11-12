import { neighborTable } from './grid.ts'
import type { Level, Paths } from './types.ts'

const EMPTY = -1
const BLOCKED = -2
const ALL_CONNECTED = -1
const DEAD_END = -2

/** Asks for solutions where `flow` does not follow `path` (cell indexes, from ends[0]). */
export type Forbid = { flow: number; path: number[] }
export type SearchOptions = { limit: number; budget: number; forbid?: Forbid }
/** `exhausted` means the whole tree was searched: neither the budget nor the limit stopped it. */
export type SearchResult = { solutions: Paths[]; exhausted: boolean; nodes: number }
export type FlowStatus = 'forced' | 'alternative' | 'unknown'

type Board = {
  cols: number
  grid: Int16Array // color index, EMPTY or BLOCKED
  near: Int32Array // neighbor table, 4 slots per cell
  heads: Int32Array // current head cell index per flow
  targets: Int32Array // target endpoint cell index per flow
  connected: Uint8Array
  paths: number[][] // cell indices per flow, from ends[0]
  emptyCount: number
  // search control
  level: Level
  limit: number
  budget: number
  nodes: number
  aborted: boolean
  found: Paths[]
  forbid: Forbid | null
  deviated: boolean // the forbidden flow has left its reference path
  // flood-fill scratch
  stamp: number
  seen: Int32Array
  stack: Int32Array
}

/** Up to `limit` complete solutions (default 1), paths ordered from `ends[0]`. */
export function solve(level: Level, limit = 1): Paths[] {
  return solveWithBudget(level, { limit, budget: Infinity }).solutions
}

export function solveWithBudget(level: Level, options: SearchOptions): SearchResult {
  const board = createBoard(level, options)
  search(board)
  return {
    solutions: board.found,
    exhausted: !board.aborted && board.found.length < board.limit,
    nodes: board.nodes,
  }
}

/** Does flow `flow` (index into `level.pairs`) have a route other than the reference one? */
export function flowCheck(
  level: Level,
  flow: number,
  budget: number,
): { status: FlowStatus; nodes: number } {
  const reference = level.solution[level.pairs[flow].color].map((c) => c.row * level.cols + c.col)
  const result = solveWithBudget(level, { limit: 1, budget, forbid: { flow, path: reference } })
  const status = result.solutions.length > 0 ? 'alternative' : result.exhausted ? 'forced' : 'unknown'
  return { status, nodes: result.nodes }
}

export function flowStatus(level: Level, flow: number, budget: number): FlowStatus {
  return flowCheck(level, flow, budget).status
}

function createBoard(level: Level, options: SearchOptions): Board {
  const { rows, cols } = level
  const cells = rows * cols
  const grid = new Int16Array(cells).fill(EMPTY)
  const index = (c: { row: number; col: number }) => c.row * cols + c.col
  for (const b of level.blocked) grid[index(b)] = BLOCKED
  level.pairs.forEach((pair, i) => {
    grid[index(pair.ends[0])] = i
    grid[index(pair.ends[1])] = i
  })
  let emptyCount = 0
  for (const v of grid) if (v === EMPTY) emptyCount++
  return {
    cols,
    grid,
    near: neighborTable(rows, cols),
    heads: Int32Array.from(level.pairs, (p) => index(p.ends[0])),
    targets: Int32Array.from(level.pairs, (p) => index(p.ends[1])),
    connected: new Uint8Array(level.pairs.length),
    paths: level.pairs.map((p) => [index(p.ends[0])]),
    emptyCount,
    level,
    limit: options.limit,
    budget: options.budget,
    nodes: 0,
    aborted: false,
    found: [],
    forbid: options.forbid ?? null,
    deviated: false,
    stamp: 0,
    seen: new Int32Array(cells),
    stack: new Int32Array(cells),
  }
}

/** Returns true when the search should stop (limit reached or budget spent). */
function search(b: Board): boolean {
  if (b.nodes >= b.budget) {
    b.aborted = true
    return true
  }
  b.nodes++

  const flow = pickFlow(b)
  if (flow === ALL_CONNECTED) {
    if (b.emptyCount === 0) b.found.push(toPaths(b))
    return b.found.length >= b.limit
  }
  if (flow === DEAD_END) return false

  const forbid = b.forbid !== null && b.forbid.flow === flow ? b.forbid : null
  const depth = b.paths[flow].length // path length before the step
  const wasDeviated = b.deviated
  const previousHead = b.heads[flow]

  for (const next of orderedMoves(b, flow, forbid, depth)) {
    const reachesTarget = next === b.targets[flow]
    const leavesReference =
      forbid !== null && !wasDeviated && (depth >= forbid.path.length || forbid.path[depth] !== next)
    // Finishing while still on the reference path is exactly the route we forbid.
    if (forbid !== null && !wasDeviated && reachesTarget && !leavesReference) continue

    b.heads[flow] = next
    b.paths[flow].push(next)
    if (leavesReference) b.deviated = true
    if (reachesTarget) b.connected[flow] = 1
    else {
      b.grid[next] = flow
      b.emptyCount--
    }

    const stop = isViable(b) && search(b)

    if (reachesTarget) b.connected[flow] = 0
    else {
      b.grid[next] = EMPTY
      b.emptyCount++
    }
    b.deviated = wasDeviated
    b.paths[flow].pop()
    b.heads[flow] = previousHead

    if (stop) return true
  }
  return false
}

function isOpenMove(b: Board, flow: number, cell: number): boolean {
  return cell >= 0 && (b.grid[cell] === EMPTY || cell === b.targets[flow])
}

function countMoves(b: Board, flow: number): number {
  const base = b.heads[flow] * 4
  let count = 0
  for (let d = 0; d < 4; d++) if (isOpenMove(b, flow, b.near[base + d])) count++
  return count
}

/** Off-reference moves come first for the forbidden flow, so an alternative is found sooner. */
function orderedMoves(b: Board, flow: number, forbid: Forbid | null, depth: number): number[] {
  const base = b.heads[flow] * 4
  const moves: number[] = []
  for (let d = 0; d < 4; d++) if (isOpenMove(b, flow, b.near[base + d])) moves.push(b.near[base + d])
  if (forbid === null || b.deviated) return moves
  const offReference = (cell: number) => forbid.path[depth] !== cell
  return [...moves.filter(offReference), ...moves.filter((m) => !offReference(m))]
}

/**
 * The unconnected flow with the fewest moves. A flow with exactly one move goes first, so does the
 * forbidden flow while nothing is forced. DEAD_END when some flow has no move at all.
 */
function pickFlow(b: Board): number {
  let best = ALL_CONNECTED
  let bestMoves = Infinity
  for (let i = 0; i < b.heads.length; i++) {
    if (b.connected[i]) continue
    const moves = countMoves(b, i)
    if (moves === 0) return DEAD_END
    if (moves < bestMoves) {
      best = i
      bestMoves = moves
    }
  }
  const f = b.forbid
  if (f !== null && !b.deviated && !b.connected[f.flow] && bestMoves > 1) return f.flow
  return best
}

function toPaths(b: Board): Paths {
  const result: Paths = {}
  b.level.pairs.forEach((pair, i) => {
    result[pair.color] = b.paths[i].map((idx) => ({
      row: Math.floor(idx / b.cols),
      col: idx % b.cols,
    }))
  })
  return result
}

/**
 * One flood fill over the empty regions checks three necessary conditions:
 *  - dead cell: every empty cell has at least 2 neighbors a pipe could pass through
 *  - stranded: every region borders both the head and the target of one unconnected flow
 *  - reach: every unconnected flow can still join head and target (adjacent, or one shared region)
 * False means the position can never be completed.
 */
function isViable(b: Board): boolean {
  const stamp = ++b.stamp
  const { grid, near, seen, stack, heads, targets, connected } = b

  let open = 0 // unconnected flows
  let reachable = 0 // flows whose head and target are adjacent or share a region
  for (let i = 0; i < heads.length; i++) {
    if (connected[i]) continue
    open |= 1 << i
    const base = heads[i] * 4
    for (let d = 0; d < 4; d++) if (near[base + d] === targets[i]) reachable |= 1 << i
  }

  for (let start = 0; start < grid.length; start++) {
    if (grid[start] !== EMPTY || seen[start] === stamp) continue
    let sp = 0
    stack[sp++] = start
    seen[start] = stamp
    let headBits = 0
    let targetBits = 0
    while (sp > 0) {
      const cell = stack[--sp]
      let usable = 0
      for (let d = 0; d < 4; d++) {
        const n = near[cell * 4 + d]
        if (n < 0) continue
        const g = grid[n]
        if (g === EMPTY) {
          usable++
          if (seen[n] !== stamp) {
            seen[n] = stamp
            stack[sp++] = n
          }
        } else if (g >= 0 && !connected[g]) {
          if (heads[g] === n) {
            headBits |= 1 << g
            usable++
          } else if (targets[g] === n) {
            targetBits |= 1 << g
            usable++
          }
        }
      }
      if (usable < 2) return false
    }
    const servable = headBits & targetBits
    if (servable === 0) return false
    reachable |= servable
  }
  return reachable === open
}
